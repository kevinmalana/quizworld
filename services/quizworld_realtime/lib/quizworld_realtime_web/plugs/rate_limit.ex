defmodule QuizworldRealtimeWeb.Plugs.RateLimit do
  @moduledoc "Redis-backed API rate limiting for high-write realtime endpoints."

  import Plug.Conn
  alias QuizworldRealtime.RateLimiter

  def init(opts), do: opts

  def call(conn, _opts) do
    client_id = client_id(conn)

    case RateLimiter.check(conn.method, conn.request_path, client_id) do
      :ok ->
        conn

      {:error, retry_after} ->
        conn
        |> put_resp_header("retry-after", Integer.to_string(retry_after))
        |> put_resp_content_type("application/json")
        |> send_resp(429, Jason.encode!(%{error: "Too many requests. Please try again shortly."}))
        |> halt()
    end
  end

  defp client_id(conn) do
    forwarded_for = get_req_header(conn, "x-forwarded-for") |> List.first()
    real_ip = get_req_header(conn, "x-real-ip") |> List.first()

    forwarded_for
    |> first_forwarded_ip()
    |> blank_to_nil()
    |> Kernel.||(blank_to_nil(real_ip))
    |> Kernel.||(format_peer(conn.remote_ip))
  end

  defp first_forwarded_ip(nil), do: nil

  defp first_forwarded_ip(value),
    do: value |> String.split(",") |> List.first() |> to_string() |> String.trim()

  defp blank_to_nil(nil), do: nil

  defp blank_to_nil(value) do
    value = String.trim(to_string(value))
    if value == "", do: nil, else: value
  end

  defp format_peer({a, b, c, d}), do: Enum.join([a, b, c, d], ".")
  defp format_peer(peer), do: inspect(peer)
end
