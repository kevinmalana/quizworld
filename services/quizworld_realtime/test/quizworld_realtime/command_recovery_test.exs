defmodule QuizworldRealtime.CommandRecoveryTest do
  use ExUnit.Case, async: false

  alias QuizworldRealtime.{Games, TestGameStore}

  setup do
    TestGameStore.reset()
    pin = "REC" <> Integer.to_string(System.unique_integer([:positive]))

    {:ok, _, host_token} =
      Games.create_session(%{
        "pin" => pin,
        "host_id" => "local-host",
        "quiz_id" => "local-quiz",
        "questions" => [
          %{
            "id" => "q1",
            "text" => "Local recovery fixture",
            "time_limit" => 60,
            "answers" => [%{"id" => "a1", "text" => "Yes", "is_correct" => true}]
          }
        ]
      })

    {:ok, _, player_token, player_id} = Games.join_player(pin, %{"nickname" => "Answerer"})
    {:ok, _, _, _} = Games.join_player(pin, %{"nickname" => "Non-answerer"})
    {:ok, _} = Games.start_game(pin, host_token)
    [{pid, _}] = Registry.lookup(QuizworldRealtime.GameRegistry, pin)

    on_exit(fn ->
      case Registry.lookup(QuizworldRealtime.GameRegistry, pin) do
        [{current, _}] ->
          # A failed assertion must not leave a suspended room behind.
          :sys.resume(current)
          DynamicSupervisor.terminate_child(QuizworldRealtime.GameSupervisor, current)

        [] ->
          :ok
      end

      TestGameStore.delete_snapshot(pin)
    end)

    %{
      pin: pin,
      pid: pid,
      host_token: host_token,
      player_id: player_id,
      player_token: player_token
    }
  end

  test "authorization and its private snapshot belong to the same room instance", ctx do
    {:ok, original} = TestGameStore.fetch_game(ctx.pin)

    replacement =
      QuizworldRealtime.Game.new(%{
        "pin" => ctx.pin,
        "host_id" => "different-host",
        "quiz_id" => "private-replacement-quiz",
        "questions" => []
      })

    # Kill the actual actor immediately after a standalone authorization reply.
    # If snapshot retrieval is a second call, it restores a different room using
    # an authorization decision made against the old credentials.
    :ok =
      :sys.install(
        ctx.pid,
        {fn state, event, _extra ->
           case event do
             {:out, {:ok, :host}, _, _} ->
               TestGameStore.persist_game(replacement)
               Process.exit(self(), :kill)

             _ ->
               state
           end
         end, nil}
      )

    assert {:ok, snapshot, :host} =
             Games.authorized_snapshot(ctx.pin, %{"host_token" => ctx.host_token})

    assert snapshot.quiz_id == original.quiz_id
    assert snapshot.players != []
  end

  test "a timed-out answer is not replayed and remains reconcilable", ctx do
    :ok = :sys.suspend(ctx.pid)

    result = Games.submit_answer(ctx.pin, ctx.player_id, ctx.player_token, "a1", 0)
    {:messages, messages} = Process.info(ctx.pid, :messages)

    queued_answers =
      Enum.count(messages, fn
        {:"$gen_call", _, {:submit_answer, _, _, _, _}} -> true
        _ -> false
      end)

    # Resume before assertions, including on the unfixed implementation.
    :ok = :sys.resume(ctx.pid)
    assert {:ok, recovered} = Games.reconnect_player(ctx.pin, ctx.player_id, ctx.player_token)
    assert length(recovered.current_answers) == 1
    assert result == {:error, :timeout}
    assert queued_answers == 1
  end

  test "a room exit after dispatch does not replay an uncertain command", ctx do
    :ok = :sys.suspend(ctx.pid)

    caller =
      Task.async(fn -> Games.submit_answer(ctx.pin, ctx.player_id, ctx.player_token, "a1", 0) end)

    await_queued_answer(ctx.pid)
    Process.exit(ctx.pid, :kill)

    assert Task.await(caller) == {:error, :unavailable}
    assert {:ok, recovered} = Games.reconnect_player(ctx.pin, ctx.player_id, ctx.player_token)
    assert recovered.current_answers == []
  end

  test "a genuinely absent actor restores before dispatching an answer", ctx do
    :ok = DynamicSupervisor.terminate_child(QuizworldRealtime.GameSupervisor, ctx.pid)

    assert {:ok, %{status: "active"}} =
             Games.submit_answer(ctx.pin, ctx.player_id, ctx.player_token, "a1", 0)

    assert {:ok, game} = TestGameStore.fetch_game(ctx.pin)
    assert map_size(game.answers["q1"]) == 1

    assert {:error, :already_answered} =
             Games.submit_answer(ctx.pin, ctx.player_id, ctx.player_token, "a1", 0)
  end

  test "authorized snapshots fail closed for replaced room credentials", ctx do
    :ok = DynamicSupervisor.terminate_child(QuizworldRealtime.GameSupervisor, ctx.pid)

    replacement =
      QuizworldRealtime.Game.new(%{
        "pin" => ctx.pin,
        "host_id" => "different-host",
        "quiz_id" => "private-replacement-quiz",
        "questions" => []
      })

    :ok = TestGameStore.persist_game(replacement)

    assert {:error, :invalid_token} =
             Games.authorized_snapshot(ctx.pin, %{"host_token" => ctx.host_token})

    assert {:error, :invalid_token} =
             Games.authorized_snapshot(ctx.pin, %{
               "player_id" => ctx.player_id,
               "player_token" => ctx.player_token
             })

    assert {:ok, %{quiz_id: "private-replacement-quiz"}, :public} =
             Games.authorized_snapshot(ctx.pin, %{})
  end

  test "atomic snapshots retain independent and composed credential checks", ctx do
    player = %{"player_id" => ctx.player_id, "player_token" => ctx.player_token}
    host_player = Map.put(player, "host_token", ctx.host_token)

    assert {:ok, public, :public} = Games.authorized_snapshot(ctx.pin, %{})
    refute Map.has_key?(public, :current_answers)
    refute Map.has_key?(public, :question_history)
    assert {:ok, own, {:player, id}} = Games.authorized_snapshot(ctx.pin, player)
    assert id == ctx.player_id
    assert Map.keys(own.correct_counts) == [id]
    refute Map.has_key?(own, :question_history)
    assert {:ok, host, :host_player} = Games.authorized_snapshot(ctx.pin, host_player)
    assert Map.has_key?(host, :question_history)
    assert map_size(host.correct_counts) == 2
    assert host.updated_at == own.updated_at

    for invalid <- [
          Map.put(host_player, "host_token", "invalid"),
          Map.put(host_player, "player_token", "invalid")
        ] do
      assert {:error, :invalid_token} = Games.authorized_snapshot(ctx.pin, invalid)
    end
  end

  test "a snapshot timeout remains an error rather than a successful private snapshot", ctx do
    :ok = :sys.suspend(ctx.pid)
    result = Games.authorized_snapshot(ctx.pin, %{"host_token" => ctx.host_token})
    {:messages, messages} = Process.info(ctx.pid, :messages)
    :ok = :sys.resume(ctx.pid)
    assert result == {:error, :timeout}
    assert Enum.count(messages, &match?({:"$gen_call", _, _}, &1)) == 1
  end

  defp await_queued_answer(pid, attempts \\ 100)
  defp await_queued_answer(_pid, 0), do: flunk("answer was not dispatched")

  defp await_queued_answer(pid, attempts) do
    {:messages, messages} = Process.info(pid, :messages)

    if Enum.any?(messages, &match?({:"$gen_call", _, {:submit_answer, _, _, _, _}}, &1)) do
      :ok
    else
      Process.sleep(1)
      await_queued_answer(pid, attempts - 1)
    end
  end
end
