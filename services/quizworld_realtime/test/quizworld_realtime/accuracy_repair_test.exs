defmodule QuizworldRealtime.AccuracyRepairTest do
  use ExUnit.Case, async: true
  alias QuizworldRealtime.Game

  test "finished aggregates count final scored question once and scope correctness to role" do
    game =
      Game.new(%{
        "pin" => "234567",
        "host_id" => "host",
        "quiz_id" => "quiz",
        "questions" => [
          %{
            "id" => "poll",
            "text" => "Vote",
            "question_type" => "poll",
            "answers" => [%{"id" => "vote", "text" => "Vote"}]
          },
          %{
            "id" => "q",
            "text" => "Question",
            "order_index" => 1,
            "answers" => [%{"id" => "right", "text" => "Right", "is_correct" => true}]
          }
        ]
      })

    {:ok, game, token, id} = Game.join_player(game, %{"nickname" => "One"})
    {:ok, game, other_token, other_id} = Game.join_player(game, %{"nickname" => "Two"})
    {:ok, game} = Game.start(game, game.host_token)
    {:ok, game} = Game.submit_answer(game, id, token, "vote", 0)
    {:ok, game} = Game.reveal_current_question(game, game.host_token)
    assert Game.snapshot(game).scored_question_count == 0
    {:ok, game} = Game.advance(game, game.host_token)
    assert Game.snapshot(game).correct_counts == %{id => 0, other_id => 0}
    {:ok, game} = Game.submit_answer(game, id, token, "right", 0)
    {:ok, game} = Game.submit_answer(game, other_id, other_token, "right", 0)
    {:ok, game} = Game.reveal_current_question(game, game.host_token)
    revealed = Game.snapshot(game)
    {:ok, game} = Game.advance(game, game.host_token)
    host = Game.snapshot(game)
    assert host.correct_counts == %{id => 1, other_id => 1}
    assert host.correct_counts == revealed.correct_counts
    assert host.scored_question_count == 1
    assert length(host.question_history) == 2
    assert Enum.map(host.question_history, & &1["question_type"]) == ["poll", "multiple_choice"]
    player = Game.snapshot_for_role(host, {:player, id})
    assert player.correct_counts == %{id => 1}
    refute Map.has_key?(player, :question_history)
    assert Enum.all?(player.current_answers, &(&1.player_id == id))
    public = Game.snapshot_for_role(host, :public)
    refute Map.has_key?(public, :correct_counts)
    refute Map.has_key?(public, :question_history)
    refute Map.has_key?(public, :current_answers)
    assert Game.snapshot(game) == host
  end
end
