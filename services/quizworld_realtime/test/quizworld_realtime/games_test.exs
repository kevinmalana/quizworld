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
      assert Games.sanitize_pin(123456) == "123456"
    end

    test "handles nil gracefully" do
      assert Games.sanitize_pin(nil) == ""
    end
  end
end
