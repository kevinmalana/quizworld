defmodule QuizworldRealtime.StateStore do
  @behaviour QuizworldRealtime.GameStore
  alias QuizworldRealtime.Game

  @ttl_seconds 21_600
  @version 1
  @index "quizworld:pending_results"

  # A pending completion is an outbox entry keyed by immutable game instance,
  # not PIN. PIN reuse/room cleanup must never erase an unsent report.
  @persist """
  redis.call('SET', KEYS[1], ARGV[1])
  if ARGV[3] == 'pending' then
    redis.call('SET', KEYS[2], ARGV[1])
    redis.call('SADD', KEYS[3], ARGV[2])
  else
    redis.call('EXPIRE', KEYS[1], ARGV[4])
    if ARGV[3] == 'succeeded' then
      redis.call('DEL', KEYS[2])
      redis.call('SREM', KEYS[3], ARGV[2])
    end
  end
  return 1
  """

  def persist_game(%Game{} = game) do
    status =
      cond do
        game.status == "finished" and game.result_sync_status != :succeeded -> "pending"
        game.result_sync_status == :succeeded -> "succeeded"
        true -> "active"
      end

    case command([
           "EVAL",
           @persist,
           "3",
           key(game.pin),
           pending_key(game.instance_id),
           @index,
           encode(game),
           game.instance_id,
           status,
           @ttl_seconds
         ]) do
      {:ok, 1} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  def fetch_game(pin) do
    with {:ok, payload} when is_binary(payload) <- command(["GET", key(pin)]) do
      decode_game(payload)
    else
      {:ok, nil} -> {:error, :not_found}
      error -> error
    end
  end

  def delete_snapshot(pin) do
    case command(["DEL", key(pin)]) do
      {:ok, _} -> :ok
      error -> error
    end
  end

  # Incremental legacy migration: adopt still-existing v1 pending snapshots
  # without racing a live actor's newer checkpoint. Never use KEYS/block Redis.
  def discover_pending(cursor) do
    with {:ok, [next, keys]} <-
           command(["SCAN", cursor, "MATCH", "quizworld:games:*", "COUNT", "50"]) do
      result =
        Enum.reduce_while(keys, :ok, fn key, :ok ->
          case promote_legacy(key) do
            :ok -> {:cont, :ok}
            error -> {:halt, error}
          end
        end)

      if result == :ok, do: {:ok, next}, else: result
    end
  end

  def pending_batch(cursor) do
    command(["SSCAN", @index, cursor, "COUNT", "50"])
  end

  def fetch_pending(id) do
    with {:ok, payload} when is_binary(payload) <- command(["GET", pending_key(id)]),
         {:ok, game} <- decode_game(payload) do
      {:ok, game, payload}
    else
      {:ok, nil} -> {:error, :not_found}
      error -> error
    end
  end

  # Only acknowledge the exact payload sent. A newer checkpoint or a reused PIN
  # must not be overwritten by a delayed recovery task.
  def acknowledge_pending(id, game, payload) do
    script = """
    if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
    if redis.call('GET', KEYS[3]) == ARGV[1] then
      redis.call('SET', KEYS[3], ARGV[3], 'EX', ARGV[4])
    end
    redis.call('DEL', KEYS[1])
    redis.call('SREM', KEYS[2], ARGV[2])
    return 1
    """

    succeeded = %{game | result_sync_status: :succeeded, result_sync_ref: nil}

    case command([
           "EVAL",
           script,
           "3",
           pending_key(id),
           @index,
           key(game.pin),
           payload,
           id,
           encode(succeeded),
           @ttl_seconds
         ]) do
      {:ok, _} -> :ok
      error -> error
    end
  end

  defp promote_legacy(key) do
    with {:ok, payload} when is_binary(payload) <- command(["GET", key]),
         {:ok, %Game{status: "finished", result_sync_status: status} = game} <-
           decode_game(payload),
         true <- status != :succeeded do
      # CAS adoption gives pre-instance-ID snapshots a stable identity, without
      # overwriting a live actor that won recovery in the meantime.
      id =
        Map.get(game, :instance_id) ||
          "legacy_" <> Base.url_encode64(:crypto.hash(:sha256, payload), padding: false)

      adopted = game |> Map.put(:instance_id, id) |> encode()

      script = """
      if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
      redis.call('SET', KEYS[1], ARGV[3])
      redis.call('SET', KEYS[2], ARGV[3])
      redis.call('SADD', KEYS[3], ARGV[2])
      return 1
      """

      case command(["EVAL", script, "3", key, pending_key(id), @index, payload, id, adopted]) do
        {:ok, _} -> :ok
        error -> error
      end
    else
      {:error, :not_found} -> :ok
      {:error, _} = error -> error
      _ -> :ok
    end
  end

  defp command(args) do
    case Process.whereis(QuizworldRealtime.Redis) do
      nil -> {:error, :redis_unavailable}
      pid -> Redix.command(pid, args, timeout: 1_000)
    end
  rescue
    error -> {:error, error}
  catch
    :exit, reason -> {:error, reason}
  end

  defp key(pin), do: "quizworld:games:" <> pin
  defp pending_key(id), do: @index <> ":" <> to_string(id)
  defp encode(game), do: :erlang.term_to_binary({@version, Game.for_persistence(game)})

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
