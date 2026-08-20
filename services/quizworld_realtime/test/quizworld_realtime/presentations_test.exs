defmodule QuizworldRealtime.PresentationsTest do
  use ExUnit.Case, async: true

  alias QuizworldRealtime.Presentations

  test "public activity exposes counts and allowed aggregates without raw rows" do
    activity = %{
      responses: [
        %{
          "participant_name" => "Mia",
          "response_data" => %{"answer_id" => "a", "body" => "secret"}
        },
        %{"participant_name" => "Bob", "response_data" => %{"answer_id" => "a"}}
      ],
      questions: [
        %{"id" => "q", "question" => "Safe question", "upvotes" => 2, "participant_name" => "Mia"}
      ]
    }

    assert %{response_count: 2, aggregates: %{"a" => 2}, questions: [question]} =
             Presentations.public_activity(activity, false)

    refute Map.has_key?(question, "participant_name")
    refute inspect(Presentations.public_activity(activity, false)) =~ "secret"
    assert Presentations.public_activity(activity, true).aggregates == %{}
  end

  test "quiz reveal is derived from the authoritative current slide and kept in run state" do
    snapshot = %{
      current_slide_index: 0,
      quiz_reveals: %{},
      slides: [
        %{
          "id" => "current",
          "slide_type" => "quiz",
          "content" => %{
            "answers" => [
              %{"id" => "a", "is_correct" => true},
              %{"id" => "b", "is_correct" => false}
            ]
          }
        }
      ]
    }

    assert {:ok, ["a"], %{"current" => ["a"]}} =
             Presentations.reveal_for_snapshot(snapshot, "current")

    assert {:error, :bad_slide} = Presentations.reveal_for_snapshot(snapshot, "other")
  end
end
