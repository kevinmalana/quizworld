defmodule QuizworldRealtimeWeb.HealthControllerTest do
  use ExUnit.Case, async: false
  import Phoenix.ConnTest
  @endpoint QuizworldRealtimeWeb.Endpoint

  test "health exposes nonsecret deployed revision while retaining existing health fields" do
    previous = System.get_env("RENDER_GIT_COMMIT")

    on_exit(fn ->
      if previous,
        do: System.put_env("RENDER_GIT_COMMIT", previous),
        else: System.delete_env("RENDER_GIT_COMMIT")
    end)

    System.put_env("RENDER_GIT_COMMIT", String.duplicate("a", 40))
    body = build_conn() |> get("/api/health") |> json_response(200)
    assert body["status"] == "ok"
    assert body["service"] == "quizworld_realtime"
    assert is_boolean(body["redis"])
    assert body["build_sha"] == String.duplicate("a", 40)
    assert body["capabilities"] == ["poll_neutral_results_v1", "private_finished_aggregates_v1"]
    System.delete_env("RENDER_GIT_COMMIT")
    assert (build_conn() |> get("/api/health") |> json_response(200))["build_sha"] == nil
  end
end
