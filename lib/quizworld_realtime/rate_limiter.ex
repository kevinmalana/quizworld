defmodule QuizworldRealtime.RateLimiter do
  @moduledoc """
  Small Redis-backed fixed-window limiter for Phoenix API routes.

  Falls back open if Redis is unavailable so realtime gameplay never breaks due to
  limiter infrastructure. Limits are intentionally conservative and endpoint-specific.
  """

  @limits %{
    "POST:/api/sessions" => {20, 60},
    "POST:/api/sessions/*/join" => {30, 60},
    "POST:/api/sessions/*/start" => {20, 60},
    "POST:/api/sessions/*/reveal" => {60, 60},
    "POST:/api/sessions/*/advance" => {60, 60},
    "POST:/api/sessions/*/answer" => {240, 60},
    "POST:/api/presentations/join" => {40, 60},
    "POST:/api/presentations/*/start" => {20, 60}
  }

  def check(method, path, client_id) do
    with {max, window_seconds} <- Map.get(@limits, route_key(method, path)),
         pid when not is_nil(pid) <- Process.whereis(QuizworldRealtime.Redis) do
      key = key(method, path, client_id)

      case Redix.pipeline(pid, [
             ["INCR", key],
             ["EXPIRE", key, Integer.to_string(window_seconds), "NX"]
           ]) do
        {:ok, [count, _]} when is_integer(count) and count <= max -> :ok
        {:ok, [count, _]} when is_integer(count) -> {:error, retry_after(key, window_seconds)}
        _ -> :ok
      end
    else
      nil -> :ok
      _ -> :ok
    end
  rescue
    _ -> :ok
  end

  defp retry_after(key, fallback) do
    case Process.whereis(QuizworldRealtime.Redis) do
      nil ->
        fallback

      pid ->
        case Redix.command(pid, ["TTL", key]) do
          {:ok, ttl} when is_integer(ttl) and ttl > 0 -> ttl
          _ -> fallback
        end
    end
  rescue
    _ -> fallback
  end

  defp route_key(method, path) do
    method = String.upcase(to_string(method))

    cond do
      method == "POST" and path == "/api/sessions" ->
        "POST:/api/sessions"

      method == "POST" and Regex.match?(~r|^/api/sessions/[^/]+/join$|, path) ->
        "POST:/api/sessions/*/join"

      method == "POST" and Regex.match?(~r|^/api/sessions/[^/]+/start$|, path) ->
        "POST:/api/sessions/*/start"

      method == "POST" and Regex.match?(~r|^/api/sessions/[^/]+/reveal$|, path) ->
        "POST:/api/sessions/*/reveal"

      method == "POST" and Regex.match?(~r|^/api/sessions/[^/]+/advance$|, path) ->
        "POST:/api/sessions/*/advance"

      method == "POST" and Regex.match?(~r|^/api/sessions/[^/]+/answer$|, path) ->
        "POST:/api/sessions/*/answer"

      method == "POST" and path == "/api/presentations/join" ->
        "POST:/api/presentations/join"

      method == "POST" and Regex.match?(~r|^/api/presentations/[^/]+/start$|, path) ->
        "POST:/api/presentations/*/start"

      true ->
        nil
    end
  end

  defp key(method, path, client_id) do
    route = route_key(method, path) || "unknown"
    client_hash = :crypto.hash(:sha256, to_string(client_id)) |> Base.encode16(case: :lower)
    "quizworld:rate:" <> route <> ":" <> client_hash
  end
end
