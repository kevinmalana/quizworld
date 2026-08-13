defmodule QuizworldRealtime.Application do
  use Application
  require Logger

  def start(_type, _args) do
    warn_if_prod_without_redis()

    children =
      [
        {Phoenix.PubSub, name: QuizworldRealtime.PubSub},
        QuizworldRealtime.Presence,
        {Registry, keys: :unique, name: QuizworldRealtime.GameRegistry},
        {DynamicSupervisor, strategy: :one_for_one, name: QuizworldRealtime.GameSupervisor},
        # 2026-08-13: Task.Supervisor for background sync tasks.
        # Previously `Task.start/1` was used for result-sync, which is fire-and-forget
        # with no monitoring. With Task.Supervisor + Logger.metadata, failures are
        # visible in process listings and we can add retries/metrics later.
        {Task.Supervisor, name: QuizworldRealtime.TaskSupervisor}
      ] ++ redis_child() ++ [QuizworldRealtimeWeb.Endpoint]

    opts = [strategy: :one_for_one, name: QuizworldRealtime.Supervisor]
    Supervisor.start_link(children, opts)
  end

  def config_change(changed, _new, removed) do
    QuizworldRealtimeWeb.Endpoint.config_change(changed, removed)
    :ok
  end

  defp redis_child do
    case Application.get_env(:quizworld_realtime, :redis_url) do
      nil -> []
      "" -> []
      redis_url -> [{Redix, {redis_url, [name: QuizworldRealtime.Redis]}}]
    end
  end

  defp warn_if_prod_without_redis do
    if Application.get_env(:quizworld_realtime, :redis_url) in [nil, ""] and
         Application.get_env(:quizworld_realtime, QuizworldRealtimeWeb.Endpoint, [])[:server] do
      Logger.warning("Redis is not configured. Single-node Phoenix can still run, but multi-node production realtime is not safe without shared state.")
    end
  end
end
