defmodule QuizworldRealtime.RoundInvariantsTest do
  use ExUnit.Case, async: false

  alias QuizworldRealtime.{Game, GameServer, Games, TestGameStore}

  setup do
    TestGameStore.reset()
    pin = "INV" <> Integer.to_string(System.unique_integer([:positive]))

    game =
      Game.new(%{
        "pin" => pin,
        "host_id" => "local-host",
        "quiz_id" => "local-quiz",
        "questions" =>
          Enum.map(1..2, fn index ->
            %{
              "id" => "q#{index}",
              "text" => "Question #{index}",
              "order_index" => index,
              "time_limit" => 60,
              "points" => 1000,
              "answers" => [%{"id" => "a#{index}", "text" => "Yes", "is_correct" => true}]
            }
          end)
      })

    {:ok, game, token, id} = Game.join_player(game, %{"nickname" => "Answerer"})
    {:ok, game, _, _} = Game.join_player(game, %{"nickname" => "Non-answerer"})
    {:ok, game} = Game.start(game, Game.host_token(game))
    on_exit(fn -> TestGameStore.delete_snapshot(pin) end)
    %{game: game, pin: pin, id: id, token: token, host_token: Game.host_token(game)}
  end

  test "a recovered expired round is revealed once without reopening its answer window", ctx do
    {:ok, answered} = Game.submit_answer(ctx.game, ctx.id, ctx.token, "a1", 0)
    expired = %{answered | question_started_at: DateTime.add(DateTime.utc_now(), -61, :second)}
    pid = start_supervised!({GameServer, expired})

    before = GameServer.snapshot(ctx.pin, :host)
    assert before.status == "reveal"
    assert [%{points_awarded: points}] = before.current_answers
    assert points > 0
    send(pid, {:question_timeout, 0})
    assert GameServer.snapshot(ctx.pin, :host) == before
    assert {:error, :invalid_state} = Games.submit_answer(ctx.pin, ctx.id, ctx.token, "a1", 0)
  end

  test "deadline validation rejects a queued answer even before the timer message is processed",
       ctx do
    pid = start_supervised!({GameServer, ctx.game})
    :ok = :sys.suspend(pid)

    :sys.replace_state(pid, fn game ->
      %{game | question_started_at: DateTime.add(DateTime.utc_now(), -61, :second)}
    end)

    caller = Task.async(fn -> Games.submit_answer(ctx.pin, ctx.id, ctx.token, "a1", 0) end)
    :ok = :sys.resume(pid)

    assert Task.await(caller) == {:error, :answer_window_closed}
    snapshot = GameServer.snapshot(ctx.pin, :host)
    assert snapshot.status == "active"
    assert snapshot.current_answers == []
  end

  test "concurrent duplicates lock one answer and repeated reveal cannot award twice", ctx do
    pid = start_supervised!({GameServer, ctx.game})

    outcomes =
      1..24
      |> Task.async_stream(fn _ -> Games.submit_answer(ctx.pin, ctx.id, ctx.token, "a1", 0) end,
        max_concurrency: 24,
        timeout: 5000
      )
      |> Enum.map(fn {:ok, result} -> result end)

    assert Enum.count(outcomes, &match?({:ok, _}, &1)) == 1
    assert Enum.count(outcomes, &(&1 == {:error, :already_answered})) == 23
    assert {:ok, revealed} = Games.reveal_current_question(ctx.pin, ctx.host_token)
    assert [%{points_awarded: points}] = revealed.current_answers
    assert Enum.find(revealed.players, &(&1.id == ctx.id)).score == points
    assert {:error, :invalid_state} = Games.reveal_current_question(ctx.pin, ctx.host_token)
    send(pid, {:question_timeout, 0})
    assert GameServer.snapshot(ctx.pin, :host) == revealed
  end

  test "previous-round timer messages do not reveal or advance the current round", ctx do
    pid = start_supervised!({GameServer, ctx.game})
    {:ok, _} = Games.reveal_current_question(ctx.pin, ctx.host_token)
    {:ok, active} = Games.advance(ctx.pin, ctx.host_token)
    assert active.current_question_index == 1
    assert active.status == "active"
    send(pid, {:question_timeout, 0})
    send(pid, {:auto_advance, 0})
    assert GameServer.snapshot(ctx.pin, :host) == active
  end
end
