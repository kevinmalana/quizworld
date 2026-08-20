defmodule QuizworldRealtime.ResultSync do
  require Logger

  @rpc_path "/rest/v1/rpc/record_game_result"

  def persist_finished_game(game) do
    with {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, service_role_key} <- fetch_env(:supabase_service_role_key),
         {:ok, body} <- build_body(game),
         {:ok, response} <- request(base_url, service_role_key, body) do
      case response.status do
        200 ->
          :ok

        204 ->
          :ok

        status ->
          Logger.warning(
            "Supabase result sync returned status #{status}: #{inspect(response.body)}"
          )

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
    question_breakdown = build_question_breakdown(game)

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
         finished_status: game.status,
         # Game mode data
         game_mode: game.game_mode || "classic",
         eliminated: MapSet.to_list(game.eliminated || MapSet.new()),
         teams:
           Enum.into(game.teams || %{}, %{}, fn {k, v} -> {k, Map.drop(v, [:__struct__])} end),
         team_assignments: game.team_assignments || %{},
         question_breakdown: question_breakdown
       },
       p_finished_at: DateTime.utc_now()
     }}
  rescue
    error -> {:error, error}
  end

  defp build_question_breakdown(game) do
    questions = game.questions || []
    answers_map = game.answers || %{}

    questions
    |> Enum.with_index()
    |> Enum.map(fn {question, index} ->
      question_id = question["id"]
      question_answers = question["answers"] || []
      player_answers = Map.get(answers_map, question_id, %{})
      total_responses = map_size(player_answers)

      correct_answer = Enum.find(question_answers, fn a -> Map.get(a, "is_correct", false) end)

      responses =
        Enum.map(player_answers, fn {player_id, row} ->
          player = Map.get(game.players || %{}, player_id)

          %{
            player_id: player_id,
            nickname: if(player, do: player.nickname, else: "Unknown"),
            avatar: if(player, do: Map.get(player, :avatar), else: nil),
            answer_id: row.answer_id,
            is_correct: row.is_correct,
            points_awarded: row.points_awarded,
            response_time_ms: row.response_time_ms
          }
        end)

      correct_count = Enum.count(responses, & &1.is_correct)

      avg_response_time =
        if total_responses > 0 do
          round(Enum.sum(Enum.map(responses, & &1.response_time_ms)) / total_responses)
        else
          0
        end

      # Answer distribution
      distribution =
        Enum.map(question_answers, fn answer ->
          count = Enum.count(responses, fn r -> r.answer_id == answer["id"] end)

          %{
            answer_id: answer["id"],
            text: answer["text"],
            is_correct: Map.get(answer, "is_correct", false),
            count: count,
            percentage: if(total_responses > 0, do: round(count / total_responses * 100), else: 0)
          }
        end)

      # Difficulty classification
      accuracy = if(total_responses > 0, do: correct_count / total_responses, else: 0)

      difficulty =
        cond do
          accuracy >= 0.8 -> "easy"
          accuracy >= 0.5 -> "medium"
          true -> "hard"
        end

      %{
        index: index,
        question_id: question_id,
        text: question["text"],
        correct_answer_text: if(correct_answer, do: correct_answer["text"], else: nil),
        time_limit: question["time_limit"] || 20,
        points: question["points"] || 1000,
        total_responses: total_responses,
        correct_count: correct_count,
        accuracy_pct:
          if(total_responses > 0, do: round(correct_count / total_responses * 100), else: 0),
        avg_response_time_ms: avg_response_time,
        difficulty: difficulty,
        distribution: distribution,
        responses: responses
      }
    end)
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
