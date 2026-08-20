defmodule QuizworldRealtime.PresentationSnapshotTest do
  use ExUnit.Case, async: true

  alias QuizworldRealtime.PresentationSnapshot

  describe "live state" do
    test "builds durable audience visibility from presentation settings" do
      record = %{
        "id" => "deck-1",
        "creator_id" => "host-1",
        "title" => "Deck",
        "status" => "live",
        "join_code" => "ABC123",
        "current_slide_index" => 0,
        "settings" => %{"results_hidden" => true},
        "slides" => []
      }

      assert %{results_hidden: true, settings: %{"results_hidden" => true}} =
               PresentationSnapshot.from_record(record)
    end

    test "changes visibility without discarding other presentation settings" do
      snapshot = %{settings: %{"theme" => "dark"}, results_hidden: false}

      assert %{settings: %{"theme" => "dark", "results_hidden" => true}, results_hidden: true} =
               PresentationSnapshot.with_results_hidden(snapshot, true)
    end
  end

  describe "for_audience/1" do
    test "removes answer keys from standalone and content-overlay quizzes" do
      snapshot = %{
        id: "deck-1",
        slides: [
          %{
            "id" => "quiz-1",
            "slide_type" => "quiz",
            "content" => %{
              "answers" => [
                %{"id" => "a", "text" => "A", "is_correct" => true},
                %{"id" => "b", "text" => "B", "is_correct" => false}
              ]
            }
          },
          %{
            "id" => "content-1",
            "slide_type" => "content",
            "content" => %{
              "interactive" => %{
                "type" => "quiz",
                "answers" => [
                  %{"id" => "c", "text" => "C", "is_correct" => true},
                  %{"id" => "d", "text" => "D", "is_correct" => false}
                ]
              }
            }
          }
        ]
      }

      safe = PresentationSnapshot.for_audience(snapshot)

      assert get_in(safe, [:slides, Access.at(0), "content", "answers"]) == [
               %{"id" => "a", "text" => "A"},
               %{"id" => "b", "text" => "B"}
             ]

      assert get_in(safe, [:slides, Access.at(1), "content", "interactive", "answers"]) == [
               %{"id" => "c", "text" => "C"},
               %{"id" => "d", "text" => "D"}
             ]
    end

    test "preserves snapshot key style and unrelated content" do
      snapshot = %{
        "id" => "deck-1",
        "slides" => [
          %{
            "slide_type" => "content",
            "content" => %{"text" => "Keep me", "interactive" => %{"type" => "poll"}}
          }
        ]
      }

      assert PresentationSnapshot.for_audience(snapshot) == snapshot
    end

    test "recursively strips answer-key fields at arbitrary nesting" do
      snapshot = %{
        slides: [
          %{
            "content" => %{
              "groups" => [
                %{
                  "answers" => [
                    %{"id" => "a", "is_correct" => true, "meta" => %{"correct_answer_id" => "a"}}
                  ]
                }
              ]
            }
          }
        ]
      }

      [slide] = PresentationSnapshot.for_audience(snapshot).slides
      [group] = slide["content"]["groups"]
      assert group["answers"] == [%{"id" => "a", "meta" => %{}}]
    end
  end
end
