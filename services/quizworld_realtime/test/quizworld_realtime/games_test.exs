defmodule QuizworldRealtime.GamesTest do
  use ExUnit.Case, async: false

  alias QuizworldRealtime.Games

  defp question do
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
  end

  test "a game transition publishes exactly one session update" do
    pin = "T" <> Integer.to_string(System.unique_integer([:positive]))
    topic = Games.topic(pin)
    Phoenix.PubSub.subscribe(QuizworldRealtime.PubSub, topic)

    assert {:ok, _snapshot, _host_token} =
             Games.create_session(%{
               "pin" => pin,
               "host_id" => "host_test",
               "quiz_id" => "quiz_test",
               "questions" => [question()],
               "game_mode" => "classic"
             })

    assert_receive {:session_updated, _created_snapshot}

    assert {:ok, joined_snapshot, _player_token, _player_id} =
             Games.join_player(pin, %{"nickname" => "Mia", "avatar" => "🦊"})

    assert_receive {:session_updated, ^joined_snapshot}
    refute_receive {:session_updated, ^joined_snapshot}, 100
  end

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
end
