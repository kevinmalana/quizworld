defmodule QuizworldRealtime.AuditRuntimeTest do
  use ExUnit.Case, async: false
  alias QuizworldRealtime.{Game, QuizLoader, ResultSync}

  test "checkpoint failure is observable, retries, and does not reject gameplay" do
    alias QuizworldRealtime.{GameServer, TestGameStore}
    Application.put_env(:quizworld_realtime, :game_store, QuizworldRealtime.AuditCheckpointStore)
    Application.put_env(:quizworld_realtime, :audit_checkpoint_observer, self())
    Application.put_env(:quizworld_realtime, :audit_checkpoint_fail, true)

    on_exit(fn ->
      Application.put_env(:quizworld_realtime, :game_store, TestGameStore)
      Application.delete_env(:quizworld_realtime, :audit_checkpoint_observer)
      Application.delete_env(:quizworld_realtime, :audit_checkpoint_fail)
    end)

    handler = "audit-checkpoint-#{System.unique_integer([:positive])}"

    :ok =
      :telemetry.attach(
        handler,
        [:quizworld_realtime, :checkpoint, :failure],
        &__MODULE__.checkpoint_failure/4,
        self()
      )

    on_exit(fn -> :telemetry.detach(handler) end)
    game = Game.new(%{"pin" => "CHECKPOINT", "questions" => []})

    log =
      ExUnit.CaptureLog.capture_log(fn ->
        {:ok, actor} = GameServer.start_link(game)
        assert_receive :checkpoint_attempt
        assert {:ok, _, _, _} = GameServer.join_player(actor, %{"nickname" => "Still playing"})
        assert_receive :checkpoint_attempt
        Application.put_env(:quizworld_realtime, :audit_checkpoint_fail, false)
        assert_receive :checkpoint_attempt, 1500
        assert %{players: players} = GameServer.snapshot(actor, :host)
        assert length(players) == 1
        assert {:ok, stored} = TestGameStore.fetch_game(game.pin)
        assert map_size(stored.players) == 1
        GenServer.stop(actor)
      end)

    assert log =~ "checkpoint failed"
    assert_receive {:checkpoint_failure, %{count: 1}, %{reason: :simulated_outage}}
    TestGameStore.delete_snapshot(game.pin)
  end

  def checkpoint_failure(_event, measurements, metadata, owner),
    do: send(owner, {:checkpoint_failure, measurements, metadata})

  test "finished state checkpoints before starting asynchronous result persistence" do
    alias QuizworldRealtime.{GameServer, TestGameStore}
    Application.put_env(:quizworld_realtime, :game_store, QuizworldRealtime.AuditCheckpointStore)
    Application.put_env(:quizworld_realtime, :audit_checkpoint_observer, self())
    Application.put_env(:quizworld_realtime, :audit_recovery_observer, self())

    Application.put_env(
      :quizworld_realtime,
      :result_sync_module,
      QuizworldRealtime.AuditRecoverySync
    )

    Application.put_env(:quizworld_realtime, :audit_sync_order_observer, self())

    on_exit(fn ->
      Application.put_env(:quizworld_realtime, :game_store, TestGameStore)

      for key <- [
            :audit_checkpoint_observer,
            :audit_recovery_observer,
            :result_sync_module,
            :audit_sync_order_observer
          ],
          do: Application.delete_env(:quizworld_realtime, key)
    end)

    game = Game.new(%{"pin" => "ORDERING", "questions" => []})
    game = %{game | status: "finished", result_sync_status: :pending}
    {:ok, actor} = GameServer.start_link(game)
    assert_receive :checkpoint_attempt
    assert_receive {:recovering, _, task}

    assert_receive {:sync_started_after_checkpoint,
                    {:ok, %{status: "finished", result_sync_status: status}}}

    assert status in [:pending, :in_flight]
    send(task, {:complete, :ok})
    GenServer.stop(actor)
    TestGameStore.delete_snapshot(game.pin)
  end

  test "host loader fetches archive status before authorizing service-role records" do
    server =
      start_supervised!(
        {Bandit, plug: QuizworldRealtime.AuditQuizPlug, port: 0, ip: {127, 0, 0, 1}}
      )

    {:ok, {_ip, port}} = ThousandIsland.listener_info(server)
    old_url = Application.get_env(:quizworld_realtime, :supabase_url)
    old_key = Application.get_env(:quizworld_realtime, :supabase_service_role_key)
    Application.put_env(:quizworld_realtime, :supabase_url, "http://127.0.0.1:#{port}")
    Application.put_env(:quizworld_realtime, :supabase_service_role_key, "local-test-key")

    on_exit(fn ->
      Application.put_env(:quizworld_realtime, :supabase_url, old_url)
      Application.put_env(:quizworld_realtime, :supabase_service_role_key, old_key)
    end)

    assert {:error, :quiz_forbidden} = QuizLoader.load_for_host("archived", "other")
    assert {:ok, %{"quiz_id" => "archived"}} = QuizLoader.load_for_host("archived", "owner")
  end

  test "archived public quizzes are hostable only by their owner" do
    quiz = %{"creator_id" => "owner", "is_public" => true, "archived_at" => "2026-01-01"}
    assert {:ok, ^quiz} = QuizLoader.authorize_record(quiz, "owner")
    assert {:error, :quiz_forbidden} = QuizLoader.authorize_record(quiz, "other")
  end

  test "survival reports exclude never-played scored questions and polls" do
    question = %{
      "id" => "q1",
      "text" => "One",
      "answers" => [
        %{"id" => "yes", "text" => "Yes", "is_correct" => true},
        %{"id" => "no", "text" => "No", "is_correct" => false}
      ]
    }

    game =
      Game.new(%{
        "pin" => "SURVIVE",
        "game_mode" => "survival",
        "questions" => [
          question,
          %{question | "id" => "q2"},
          Map.merge(question, %{"id" => "poll", "question_type" => "poll"})
        ]
      })

    {:ok, game, token, player} = Game.join_player(game, %{"nickname" => "Only"})
    host = Game.host_token(game)
    {:ok, game} = Game.start(game, host)
    {:ok, game} = Game.submit_answer(game, player, token, "yes", 0)
    {:ok, game} = Game.reveal_current_question(game, host)
    {:ok, game} = Game.advance(game, host)
    assert game.status == "finished"
    assert {:ok, payload} = ResultSync.build_result_payload(game)
    assert payload.p_results.question_count == 1
    assert payload.p_results.scored_question_count == 1
    assert [%{question_id: "q1"}] = payload.p_results.question_breakdown
  end
end
