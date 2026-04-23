defmodule QuizworldRealtime.GamesTest do
  use ExUnit.Case, async: true

  alias QuizworldRealtime.Games

  describe "topic/1" do
    test "generates a valid pubsub topic" do
      assert Games.topic("ABC123") == "game:ABC123"
    end

    test "sanitizes colons from pin" do
      assert Games.topic("AB:C12:3") == "game:ABC123"
    end

    test "sanitizes asterisks from pin" do
      assert Games.topic("ABC*123") == "game:ABC123"
    end

    test "sanitizes whitespace from pin" do
      assert Games.topic("AB C 12 3") == "game:ABC123"
    end

    test "truncates overly long pins" do
      long_pin = String.duplicate("A", 100)
      topic = Games.topic(long_pin)
      assert String.length(topic) <= 48
      assert String.starts_with?(topic, "game:")
    end
  end

  describe "sanitize_pin/1" do
    test "uppercases and sanitizes pin" do
      assert Games.sanitize_pin("abc123") == "ABC123"
    end

    test "removes colons, asterisks, and whitespace" do
      assert Games.sanitize_pin("AB:C* 12 3") == "ABC123"
    end

    test "truncates to max 20 characters" do
      assert String.length(Games.sanitize_pin(String.duplicate("A", 50))) == 20
    end

    test "handles integer input" do
      assert Games.sanitize_pin(123_456) == "123456"
    end

    test "handles nil gracefully" do
      assert Games.sanitize_pin(nil) == ""
    end
  end

  describe "pin normalization across session operations" do
    defp base_attrs(pin) do
      %{
        "pin" => pin,
        "host_id" => "host_123",
        "quiz_id" => "quiz_123",
        "questions" => [
          %{
            "id" => "q1",
            "text" => "What is 2 + 2?",
            "order_index" => 0,
            "answers" => [
              %{"id" => "a1", "text" => "3", "is_correct" => false},
              %{"id" => "a2", "text" => "4", "is_correct" => true}
            ]
          }
        ]
      }
    end

    test "create_session sanitizes provided pins before storing the game" do
      assert {:ok, snapshot, _host_token} = Games.create_session(base_attrs("ab c:12*3"))
      assert snapshot.pin == "ABC123"
      assert {:ok, fetched} = Games.snapshot("abc 123")
      assert fetched.pin == "ABC123"
    end

    test "join/start/answer/reconnect accept unsanitized user input pins" do
      assert {:ok, snapshot, host_token} = Games.create_session(base_attrs("xy z:98*7"))

      assert {:ok, joined, player_token, player_id} =
               Games.join_player(" xy:z 987* ", %{"nickname" => "Mia"})

      assert joined.pin == snapshot.pin

      assert {:ok, started} = Games.start_game("xyz987", host_token)
      assert started.status == "active"

      assert {:ok, answered} =
               Games.submit_answer("x y z 9 8 7", player_id, player_token, "a2", 500)

      assert length(answered.current_answers) == 1

      assert {:ok, revealed} = Games.reveal_current_question("x:y*z 987", host_token)
      assert revealed.status == "reveal"

      assert {:ok, finished} = Games.advance("X Y Z 9 8 7", host_token)
      assert finished.status == "finished"

      assert {:ok, reconnected} = Games.reconnect_player("XY:Z*987", player_id, player_token)
      assert reconnected.pin == snapshot.pin
    end
  end
end
