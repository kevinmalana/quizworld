defmodule QuizworldRealtime.StateStore do
  @ttl_seconds 21_600

  def persist_snapshot(snapshot) do
    case Process.whereis(QuizworldRealtime.Redis) do
      nil ->
        :ok

      _pid ->
        payload = Jason.encode!(snapshot)
        Redix.command(QuizworldRealtime.Redis, ["SET", key(snapshot.pin), payload, "EX", Integer.to_string(@ttl_seconds)])
        :ok
    end
  rescue
    _ -> :ok
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
end
