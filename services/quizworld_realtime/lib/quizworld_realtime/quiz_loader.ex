defmodule QuizworldRealtime.QuizLoader do
  @moduledoc false

  require Logger

  @supabase_rest "/rest/v1"

  def load_for_host(quiz_id, user_id) when is_binary(quiz_id) and is_binary(user_id) do
    with {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key),
         {:ok, %{status: 200, body: [quiz | _]}} <-
           Req.get(
             url: "#{base_url}#{@supabase_rest}/quizzes",
             params: %{
               id: "eq.#{quiz_id}",
               select:
                 "id,creator_id,is_public,category,questions(id,text,image_url,video_url,question_type,time_limit,points,order_index,shuffle_answers,answers(id,text,image_url,is_correct,order_index))"
             },
             headers: headers(api_key),
             receive_timeout: 10_000
           ),
         {:ok, authorized} <- authorize_record(quiz, user_id) do
      {:ok,
       %{
         "quiz_id" => authorized["id"],
         "category" => authorized["category"],
         "questions" => authorized["questions"] || []
       }}
    else
      {:ok, %{status: 200, body: []}} ->
        {:error, :quiz_not_found}

      {:ok, %{status: status}} ->
        Logger.warning("Supabase quiz load failed with status #{status}")
        {:error, :quiz_unavailable}

      {:error, reason} ->
        {:error, reason}

      _ ->
        {:error, :quiz_unavailable}
    end
  end

  def load_for_host(_, _), do: {:error, :quiz_not_found}

  @doc false
  def authorize_record(%{"creator_id" => creator_id} = quiz, user_id) do
    if creator_id == user_id or quiz["is_public"] == true,
      do: {:ok, quiz},
      else: {:error, :quiz_forbidden}
  end

  def authorize_record(_, _), do: {:error, :quiz_not_found}

  defp fetch_env(key) do
    case Application.get_env(:quizworld_realtime, key) do
      nil -> {:error, :missing_config}
      "" -> {:error, :missing_config}
      value -> {:ok, value}
    end
  end

  defp headers(api_key) do
    [
      {"apikey", api_key},
      {"authorization", "Bearer " <> api_key},
      {"accept", "application/json"}
    ]
  end
end
