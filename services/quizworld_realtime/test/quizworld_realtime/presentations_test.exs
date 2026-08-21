defmodule QuizworldRealtime.PresentationsTest do
  use ExUnit.Case, async: true

  alias QuizworldRealtime.Presentations

  test "public activity exposes counts and allowed aggregates without raw rows" do
    activity = %{
      responses: [
        %{
          "participant_name" => "Mia",
          "response_data" => %{
            "answer_id" => "a",
            "option_id" => "poll-a",
            "words" => "Blue blue",
            "value" => 4,
            "body" => "secret"
          }
        },
        %{
          "participant_name" => "Bob",
          "response_data" => %{
            "answer_id" => "a",
            "option_id" => "poll-b",
            "words" => "Green",
            "value" => 8
          }
        }
      ],
      questions: [
        %{"id" => "q", "question" => "Safe question", "upvotes" => 2, "participant_name" => "Mia"}
      ]
    }

    assert %{
             response_count: 2,
             aggregates: %{
               "answer_counts" => %{"a" => 2},
               "poll_counts" => %{"poll-a" => 1, "poll-b" => 1},
               "sorted_words" => [{"blue", 2}, {"green", 1}],
               "scale_values" => [4, 8],
               "scale_avg" => 6.0
             },
             questions: [question]
           } = Presentations.public_activity(activity, false)

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

  test "response validation binds payloads to the current slide definition" do
    poll = %{
      "slide_type" => "poll",
      "content" => %{"options" => [%{"id" => "yes"}, %{"id" => "no"}]}
    }

    assert {:ok, %{"option_id" => "yes"}} =
             Presentations.validate_response_for_slide(poll, %{
               "option_id" => "yes",
               "extra" => "discarded"
             })

    assert {:error, :bad_response} =
             Presentations.validate_response_for_slide(poll, %{"option_id" => "forged"})

    scale = %{"slide_type" => "scale", "content" => %{"min" => 1, "max" => 5}}

    assert {:ok, %{"value" => 4}} =
             Presentations.validate_response_for_slide(scale, %{"value" => 4})

    assert {:error, :bad_response} =
             Presentations.validate_response_for_slide(scale, %{"value" => 9})
  end

  test "Q&A validation accepts only Q&A slides and bounded non-empty text" do
    qna = %{"slide_type" => "qna", "content" => %{}}

    assert {:ok, "A useful question?"} =
             Presentations.validate_qna_for_slide(qna, "  A useful question?  ")

    assert {:error, :bad_response} = Presentations.validate_qna_for_slide(qna, "")

    assert {:error, :bad_response} =
             Presentations.validate_qna_for_slide(
               %{"slide_type" => "poll", "content" => %{}},
               "Wrong slide"
             )
  end

  test "quiz reveal supports a nested interactive quiz overlay" do
    snapshot = %{
      current_slide_index: 0,
      quiz_reveals: %{},
      slides: [
        %{
          "id" => "overlay",
          "slide_type" => "content",
          "content" => %{
            "interactive" => %{
              "type" => "quiz",
              "answers" => [
                %{"id" => "correct", "is_correct" => true},
                %{"id" => "wrong", "is_correct" => false}
              ]
            }
          }
        }
      ]
    }

    assert {:ok, ["correct"], %{"overlay" => ["correct"]}} =
             Presentations.reveal_for_snapshot(snapshot, "overlay")
  end
end
