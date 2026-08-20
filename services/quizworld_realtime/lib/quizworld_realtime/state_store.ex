defmodule QuizworldRealtime.StateStore do
  @behaviour QuizworldRealtime.GameStore

  alias QuizworldRealtime.Game

  @ttl_seconds 21_600
  @version 1

  def persist_game(%Game{} = game) do
    case Process.whereis(QuizworldRealtime.Redis) do
      nil ->
        :ok

      _pid ->
        payload = :erlang.term_to_binary({@version, Game.for_persistence(game)})

        Redix.command(QuizworldRealtime.Redis, [
          "SET",
          key(game.pin),
          payload,
          "EX",
          Integer.to_string(@ttl_seconds)
        ])

        :ok
    end
  rescue
    _ -> :ok
  end

  def fetch_game(pin) do
    case Process.whereis(QuizworldRealtime.Redis) do
      nil ->
        {:error, :not_found}

      _pid ->
        case Redix.command(QuizworldRealtime.Redis, ["GET", key(pin)]) do
          {:ok, nil} -> {:error, :not_found}
          {:ok, payload} -> decode_game(payload)
          _ -> {:error, :not_found}
        end
    end
  rescue
    _ -> {:error, :not_found}
  end

  def delete_snapshot(pin) do
    case Process.whereis(QuizworldRealtime.Redis) do
      nil ->
        :ok

      _pid ->
        Redix.command(QuizworldRealtime.Redis, ["DEL", key(pin)])
        :ok
    end
  rescue
    _ -> :ok
  end

  defp key(pin), do: "quizworld:games:" <> pin

  defp decode_game(payload) when is_binary(payload) do
    case :erlang.binary_to_term(payload, [:safe]) do
      {@version, %Game{} = game} -> {:ok, game}
      %Game{} = game -> {:ok, game}
      _ -> {:error, :not_found}
    end
  rescue
    _ -> {:error, :not_found}
  end
end
