defmodule QuizworldRealtimeWeb.HealthController do
  use QuizworldRealtimeWeb, :controller

  def index(conn, _params) do
    json(conn, %{
      status: "ok",
      service: "quizworld_realtime",
      redis: Process.whereis(QuizworldRealtime.Redis) != nil,
      build_sha: System.get_env("RENDER_GIT_COMMIT"),
      capabilities: ["poll_neutral_results_v1", "private_finished_aggregates_v1"]
    })
  end
end
