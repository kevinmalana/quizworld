defmodule QuizworldRealtime.Auth do
  @user_path "/auth/v1/user"

  def authenticate_bearer(conn) do
    with ["Bearer " <> token] <- Plug.Conn.get_req_header(conn, "authorization"),
         {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key),
         {:ok, response} <- request_user(base_url, api_key, token),
         200 <- response.status,
         %{"id" => user_id} <- response.body do
      {:ok, user_id}
    else
      [] -> {:error, :missing_bearer_token}
      401 -> {:error, :invalid_bearer_token}
      403 -> {:error, :invalid_bearer_token}
      {:error, :missing_config} -> {:error, :missing_config}
      {:ok, response} -> {:error, {:unexpected_status, response.status}}
      _ -> {:error, :invalid_bearer_token}
    end
  end

  defp request_user(base_url, api_key, token) do
    Req.get(
      url: String.trim_trailing(base_url, "/") <> @user_path,
      headers: [
        {"authorization", "Bearer " <> token},
        {"apikey", api_key},
        {"accept", "application/json"}
      ],
      receive_timeout: 10_000
    )
  end

  defp fetch_env(key) do
    case Application.get_env(:quizworld_realtime, key) do
      nil -> {:error, :missing_config}
      "" -> {:error, :missing_config}
      value -> {:ok, value}
    end
  end
end
