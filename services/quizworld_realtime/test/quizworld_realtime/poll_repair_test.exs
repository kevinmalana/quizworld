defmodule QuizworldRealtime.PollRepairTest do
  use ExUnit.Case, async: true
  alias QuizworldRealtime.Game

  for mode <- ["classic", "survival", "team"] do
    test "#{mode}: polls record votes without scoring or eliminating non-voters" do
      game =
        Game.new(%{
          "pin" => "123456",
          "host_id" => "host",
          "quiz_id" => "quiz",
          "game_mode" => unquote(mode),
          "questions" => [
            %{
              "id" => "poll",
              "text" => "Your preference?",
              "question_type" => "poll",
              "answers" => [
                %{"id" => "yes", "text" => "Yes", "is_correct" => true},
                %{"id" => "no", "text" => "No", "is_correct" => false}
              ]
            },
            %{
              "id" => "next",
              "text" => "Next",
              "order_index" => 1,
              "answers" => [%{"id" => "right", "text" => "Right", "is_correct" => true}]
            }
          ]
        })

      {:ok, game, token, id} = Game.join_player(game, %{"nickname" => "Voter"})
      {:ok, game, _, _} = Game.join_player(game, %{"nickname" => "Abstainer"})
      {:ok, game} = Game.start(game, game.host_token)
      assert Game.snapshot(game).current_question["question_type"] == "poll"
      {:ok, game} = Game.submit_answer(game, id, token, "yes", 0)
      {:ok, game} = Game.reveal_current_question(game, game.host_token)
      assert game.answers["poll"][id].is_correct == nil
      assert game.answers["poll"][id].points_awarded == 0
      assert Enum.all?(game.players, fn {_, p} -> p.score == 0 end)
      assert Enum.all?(game.teams, fn {_, t} -> t.score == 0 end)
      assert MapSet.size(game.eliminated) == 0

      assert Enum.sum(Enum.map(Game.snapshot(game).current_question["answers"], & &1["count"])) ==
               1

      {:ok, next} = Game.advance(game, game.host_token)
      assert next.status == "active"
    end
  end
end
