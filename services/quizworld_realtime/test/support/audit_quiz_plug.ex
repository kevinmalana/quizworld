defmodule QuizworldRealtime.AuditQuizPlug do
  import Plug.Conn
  def init(opts), do: opts

  def call(conn, _) do
    conn = fetch_query_params(conn)
    quiz = %{"id" => "archived", "creator_id" => "owner", "is_public" => true, "questions" => []}

    quiz =
      if "archived_at" in String.split(conn.query_params["select"], ","),
        do: Map.put(quiz, "archived_at", "2026-01-01"),
        else: quiz

    conn |> put_resp_content_type("application/json") |> send_resp(200, Jason.encode!([quiz]))
  end
end
