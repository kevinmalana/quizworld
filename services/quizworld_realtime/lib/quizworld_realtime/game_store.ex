defmodule QuizworldRealtime.GameStore do
  @moduledoc false

  @callback persist_game(struct()) :: :ok | {:error, term()}
  @callback fetch_game(String.t()) :: {:ok, struct()} | {:error, term()}
  @callback delete_snapshot(String.t()) :: :ok | {:error, term()}

  def backend do
    Application.get_env(:quizworld_realtime, :game_store, QuizworldRealtime.StateStore)
  end
end
