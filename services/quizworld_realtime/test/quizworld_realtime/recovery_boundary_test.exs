defmodule QuizworldRealtime.RecoveryBarrierStore do
  alias QuizworldRealtime.TestGameStore

  def persist_game(game) do
    if observer = Process.get(:write_observer), do: send(observer, {:caller_wrote, self()})
    TestGameStore.persist_game(game)
  end

  def delete_snapshot(pin), do: TestGameStore.delete_snapshot(pin)

  def fetch_game(pin) do
    value = TestGameStore.fetch_game(pin)

    if owner = Process.get(:fetch_barrier) do
      Process.delete(:fetch_barrier)
      send(owner, {:fetched, self()})

      receive do
        :continue -> :ok
      after
        5000 -> raise "barrier timed out"
      end
    end

    value
  end
end

defmodule QuizworldRealtime.RecoveryBoundaryTest do
  use ExUnit.Case, async: false
  alias QuizworldRealtime.{Games, GameServer, TestGameStore, RecoveryBarrierStore}

  setup do
    pin = "BOUNDARY#{System.unique_integer([:positive])}"

    {:ok, _, host} =
      Games.create_session(%{
        "pin" => pin,
        "host_id" => "host",
        "quiz_id" => "local",
        "questions" => [
          %{
            "id" => "q",
            "text" => "Local",
            "time_limit" => 60,
            "answers" => [%{"id" => "a", "text" => "A", "is_correct" => true}]
          }
        ]
      })

    on_exit(fn ->
      Application.put_env(:quizworld_realtime, :game_store, TestGameStore)

      for {pid, _} <- Registry.lookup(QuizworldRealtime.GameRegistry, pin),
          do: DynamicSupervisor.terminate_child(QuizworldRealtime.GameSupervisor, pid)

      TestGameStore.delete_snapshot(pin)
    end)

    %{pin: pin, host: host}
  end

  defp actor(pin), do: Registry.lookup(QuizworldRealtime.GameRegistry, pin) |> hd() |> elem(0)

  test "an actor exiting noproc after dispatch is uncertain and never replayed", ctx do
    {:ok, _, token, player} = Games.join_player(ctx.pin, %{"nickname" => "Answerer"})
    {:ok, _, _, _} = Games.join_player(ctx.pin, %{"nickname" => "Pending"})
    {:ok, _} = Games.start_game(ctx.pin, ctx.host)
    # This test deliberately injects an abnormal exit reason. Give it a real,
    # registered actor outside the shared supervisor's restart budget so fault
    # cases in other modules cannot shut down one another's application.
    {:ok, stored_before} = TestGameStore.fetch_game(ctx.pin)
    :ok = DynamicSupervisor.terminate_child(QuizworldRealtime.GameSupervisor, actor(ctx.pin))
    {:ok, pid} = GameServer.start_link(stored_before)
    Process.unlink(pid)
    :ok = :sys.suspend(pid)
    caller = Task.async(fn -> Games.submit_answer(ctx.pin, player, token, "a", 0) end)
    wait_for_call(pid, 200)
    Process.exit(pid, :noproc)
    assert {:error, :unavailable} = Task.await(caller)
    {:ok, stored} = TestGameStore.fetch_game(ctx.pin)
    assert Map.get(stored.answers, "q", %{}) == %{}
  end

  defp wait_for_call(_pid, 0), do: flunk("no queued command")

  defp wait_for_call(pid, attempts) do
    {:messages, messages} = Process.info(pid, :messages)

    if Enum.any?(messages, &match?({:"$gen_call", _, {:submit_answer, _, _, _, _}}, &1)) do
      :ok
    else
      Process.sleep(1)
      wait_for_call(pid, attempts - 1)
    end
  end

  test "already-delivered legacy cleanup cannot delete renewed activity", ctx do
    {:ok, _, _, _} = Games.join_player(ctx.pin, %{"nickname" => "Ready"})
    pid = actor(ctx.pin)
    old_ref = :sys.get_state(pid).cleanup_timer_ref
    {:ok, %{status: "active"}} = Games.start_game(ctx.pin, ctx.host)
    assert :sys.get_state(pid).cleanup_timer_ref != old_ref
    send(pid, :session_cleanup)
    send(pid, {:timeout, old_ref, :session_cleanup})
    assert {:ok, %{status: "active"}} = Games.snapshot(ctx.pin)
    assert {:ok, %{status: "active"}} = TestGameStore.fetch_game(ctx.pin)
    current_ref = :sys.get_state(pid).cleanup_timer_ref
    monitor = Process.monitor(pid)
    send(pid, {:timeout, current_ref, :session_cleanup})
    assert_receive {:DOWN, ^monitor, :process, ^pid, :normal}, 1000
    assert {:error, :not_found} = TestGameStore.fetch_game(ctx.pin)
  end

  for form <- [:missing, nil] do
    @legacy_form form
    test "lagging #{@legacy_form || "nil"} legacy restore cannot overwrite the owner's restart identity",
         ctx do
      {:ok, stored} = TestGameStore.fetch_game(ctx.pin)
      :ok = DynamicSupervisor.terminate_child(QuizworldRealtime.GameSupervisor, actor(ctx.pin))

      legacy =
        if @legacy_form == :missing,
          do: Map.delete(stored, :instance_id),
          else: Map.put(stored, :instance_id, nil)

      TestGameStore.persist_game(legacy)
      Application.put_env(:quizworld_realtime, :game_store, RecoveryBarrierStore)
      observer = self()
      credentials = %{"host_token" => ctx.host}

      recovery =
        Task.async(fn ->
          Process.put(:fetch_barrier, observer)
          Process.put(:write_observer, observer)
          Games.authorized_snapshot(ctx.pin, credentials)
        end)

      assert_receive {:fetched, caller}, 1000
      assert {:ok, first, :host} = Games.authorized_snapshot(ctx.pin, credentials)
      owner = actor(ctx.pin)
      {:ok, _, token, player} = Games.join_player(ctx.pin, %{"nickname" => "Acknowledged"})
      send(caller, :continue)
      assert {:ok, latest, :host} = Task.await(recovery)
      refute_receive {:caller_wrote, ^caller}
      assert latest.game_instance_id == first.game_instance_id
      assert Enum.any?(latest.players, &(&1.id == player))
      assert {:ok, persisted} = TestGameStore.fetch_game(ctx.pin)
      assert persisted.instance_id == first.game_instance_id
      assert Map.has_key?(persisted.players, player)

      # Inspect the actual supervisor's immutable args, not a reconstructed spec.
      {{GameServer, :start_link, [restart_ref]}, :transient, _, :worker, _} =
        :sys.get_state(QuizworldRealtime.GameSupervisor).children[owner]

      assert restart_ref["instance_id"] == persisted.instance_id
      :ok = DynamicSupervisor.terminate_child(QuizworldRealtime.GameSupervisor, owner)

      assert {:stop, :not_found} =
               GameServer.init(%{restart_ref | "instance_id" => "different-modern-instance"})

      assert {:ok, restored, {:player, ^player}} =
               Games.authorized_snapshot(
                 ctx.pin,
                 %{"player_id" => player, "player_token" => token}
               )

      assert restored.game_instance_id == first.game_instance_id
      assert Enum.any?(restored.players, &(&1.id == player))
    end
  end

  test "lagging restore never overwrites state persisted by the winning actor", ctx do
    {:ok, stored} = TestGameStore.fetch_game(ctx.pin)
    :ok = DynamicSupervisor.terminate_child(QuizworldRealtime.GameSupervisor, actor(ctx.pin))
    Application.put_env(:quizworld_realtime, :game_store, RecoveryBarrierStore)
    owner = self()

    recovery =
      Task.async(fn ->
        Process.put(:fetch_barrier, owner)
        Games.snapshot(ctx.pin)
      end)

    assert_receive {:fetched, caller}, 1000

    {:ok, _pid} =
      DynamicSupervisor.start_child(QuizworldRealtime.GameSupervisor, {GameServer, stored})

    {:ok, _, _, player} = Games.join_player(ctx.pin, %{"nickname" => "Acknowledged"})
    send(caller, :continue)
    assert {:ok, public} = Task.await(recovery)
    assert Enum.any?(public.players, &(&1.id == player))
    {:ok, after_restore} = TestGameStore.fetch_game(ctx.pin)
    assert Map.has_key?(after_restore.players, player)
    :ok = DynamicSupervisor.terminate_child(QuizworldRealtime.GameSupervisor, actor(ctx.pin))
    assert {:ok, recovered} = Games.snapshot(ctx.pin)
    assert Enum.any?(recovered.players, &(&1.id == player))
  end
end
