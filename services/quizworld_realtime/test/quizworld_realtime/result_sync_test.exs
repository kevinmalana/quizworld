defmodule QuizworldRealtime.ResultSyncTest do
  use ExUnit.Case, async: true

  alias QuizworldRealtime.Game
  alias QuizworldRealtime.ResultSync

  test "finished-game payload preserves per-question report analytics" do
    game =
      Game.new(%{
        "pin" => "REPORT",
        "host_id" => "00000000-0000-0000-0000-000000000001",
        "quiz_id" => "00000000-0000-0000-0000-000000000002",
        "questions" => [
          %{
            "id" => "q1",
            "text" => "What is 2 + 2?",
            "time_limit" => 20,
            "points" => 1_000,
            "order_index" => 0,
            "answers" => [
              %{"id" => "a1", "text" => "4", "is_correct" => true},
              %{"id" => "a2", "text" => "5", "is_correct" => false}
            ]
          }
        ]
      })

    {:ok, game, player_token, player_id} =
      Game.join_player(game, %{"nickname" => "Mia", "avatar" => "🦊"})

    host_token = Game.host_token(game)
    {:ok, game} = Game.start(game, host_token)
    {:ok, game} = Game.submit_answer(game, player_id, player_token, "a1", 0)
    {:ok, game} = Game.reveal_current_question(game, host_token)
    {:ok, game} = Game.advance(game, host_token)

    assert game.result_sync_status == :pending

    assert {:ok, payload} = ResultSync.build_result_payload(game)
    assert payload.p_game_instance_id == game.instance_id
    assert payload.p_results.question_count == 1
    assert [question] = payload.p_results.question_breakdown
    assert question.question_id == "q1"
    assert question.correct_count == 1
    assert question.total_responses == 1
    assert [%{answer_id: "a1", is_correct: true}] = question.responses
    assert Enum.find(question.distribution, &(&1.answer_id == "a1")).count == 1
  end
end
