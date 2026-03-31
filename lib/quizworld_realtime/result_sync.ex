defmodule QuizworldRealtime.ResultSync do
  require Logger

  @rpc_path "/rest/v1/rpc/record_game_result"

  def persist_finished_game(game) do
    with {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, service_role_key} <- fetch_env(:supabase_service_role_key),
         {:ok, body} <- build_body(game),
         {:ok, response} <- request(base_url, service_role_key, body) do
      case response.status do
        200 -> :ok
        204 -> :ok
        status ->
          Logger.warning("Supabase result sync returned status #{status}: #{inspect(response.body)}")
          {:error, :unexpected_status}
      end
    else
      {:error, :missing_config} ->
        Logger.debug("Skipping result sync: Supabase service credentials are not configured.")
        :ok

      {:error, reason} ->
        Logger.warning("Supabase result sync failed: #{inspect(reason)}")
        {:error, reason}
    end
  end

  defp fetch_env(key) do
    case Application.get_env(:quizworld_realtime, key) do
      nil -> {:error, :missing_config}
      "" -> {:error, :missing_config}
      value -> {:ok, value}
    end
  end

  defp build_body(game) do
    {:ok,
     %{
       p_pin: game.pin,
       p_quiz_id: game.quiz_id,
       p_host_id: game.host_id,
       p_player_count: map_size(game.players || %{}),
       p_results: %{
         players:
           Enum.map(Map.values(game.players || %{}), fn player ->
             %{
               id: player.id,
               nickname: player.nickname,
               avatar: Map.get(player, :avatar) || Map.get(player, "avatar"),
               score: player.score
             }
           end),
         question_count: length(game.questions || []),
         finished_status: game.status
       },
       p_finished_at: DateTime.utc_now()
     }}
  rescue
    error -> {:error, error}
  end

  defp request(base_url, service_role_key, body) do
    Req.post(
      url: String.trim_trailing(base_url, "/") <> @rpc_path,
      json: body,
      headers: headers(service_role_key),
      receive_timeout: 10_000
    )
  end

  defp headers(service_role_key) do
    [
      {"content-type", "application/json"},
      {"apikey", service_role_key},
      {"authorization", "Bearer " <> service_role_key}
    ]
  end
end
