defmodule QuizworldRealtimeWeb.Plugs.CORS do
  @behaviour Plug

  import Plug.Conn

  def init(opts), do: opts

  def call(conn, _opts) do
    allowed_origins =
      Application.get_env(:quizworld_realtime, :allowed_origins, ["http://localhost:3000"])

    origin = get_req_header(conn, "origin") |> List.first()

    conn =
      if origin && origin in allowed_origins do
        conn
        |> put_resp_header("access-control-allow-origin", origin)
        |> put_resp_header("access-control-allow-credentials", "true")
        |> put_resp_header("access-control-allow-headers", "authorization,content-type,accept")
        |> put_resp_header("access-control-allow-methods", "GET,POST,OPTIONS")
        |> put_resp_header("vary", "Origin")
      else
        conn
      end

    if conn.method == "OPTIONS" do
      conn
      |> send_resp(204, "")
      |> halt()
    else
      conn
    end
  end
end
