defmodule QuizworldRealtime.QuizLoaderTest do
  use ExUnit.Case, async: true

  alias QuizworldRealtime.QuizLoader

  test "allows the owner and public quiz reuse but rejects another user's private quiz" do
    private = %{"id" => "quiz", "creator_id" => "owner", "is_public" => false}
    public = %{private | "is_public" => true}

    assert {:ok, ^private} = QuizLoader.authorize_record(private, "owner")
    assert {:ok, ^public} = QuizLoader.authorize_record(public, "other")
    assert {:error, :quiz_forbidden} = QuizLoader.authorize_record(private, "other")
  end
end
