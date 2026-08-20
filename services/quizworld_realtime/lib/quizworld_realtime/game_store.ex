defmodule QuizworldRealtime.GameStore do
  @moduledoc false

  @callback persist_game(struct()) :: :ok
  @callback fetch_game(String.t()) :: {:ok, struct()} | {:error, :not_found}
  @callback delete_snapshot(String.t()) :: :ok

  def backend do
    Application.get_env(:quizworld_realtime, :game_store, QuizworldRealtime.StateStore)
  end
end
