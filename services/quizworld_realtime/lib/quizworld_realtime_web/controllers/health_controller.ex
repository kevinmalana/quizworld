defmodule QuizworldRealtimeWeb.HealthController do
  use QuizworldRealtimeWeb, :controller

  def index(conn, _params) do
    json(conn, %{
      status: "ok",
      service: "quizworld_realtime",
      redis: Process.whereis(QuizworldRealtime.Redis) != nil
    })
  end
end
