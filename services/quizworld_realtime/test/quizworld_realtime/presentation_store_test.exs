defmodule QuizworldRealtime.PresentationStoreTest do
  use ExUnit.Case, async: true

  alias QuizworldRealtime.PresentationStore

  test "a token from an earlier run cannot authorize the current run" do
    active = {:ok, "run-2", "fresh-token"}

    assert PresentationStore.live_credentials_match?(active, "run-2", "fresh-token")
    refute PresentationStore.live_credentials_match?(active, "run-1", "fresh-token")
    refute PresentationStore.live_credentials_match?(active, "run-2", "stale-token")
  end
end
