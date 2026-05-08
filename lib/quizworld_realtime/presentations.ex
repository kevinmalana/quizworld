defmodule QuizworldRealtime.Presentations do
  @moduledoc """
  Phoenix-authoritative context for QuizWorld Present.

  Supabase stores durable deck/report data. Phoenix validates presenter/participant
  tokens for live actions and broadcasts realtime state.
  """

  require Logger

  alias QuizworldRealtime.PresentationStore

  @supabase_rest "/rest/v1"

  def start_live(presentation_id, host_id) do
    with {:ok, snapshot} <- get_snapshot(presentation_id),
         true <- snapshot.creator_id == host_id || {:error, :not_host},
         {:ok, presenter_token} <- ensure_live_session(presentation_id) do
      update_presentation(presentation_id, %{
        status: "live",
        current_slide_index: 0,
        finished_at: nil
      })
      |> case do
        {:ok, updated} ->
          PresentationStore.put_live_session(presentation_id, presenter_token)
          PresentationStore.put_snapshot(updated)
          {:ok, updated, presenter_token}

        error ->
          error
      end
    end
  end

  def join_by_code(join_code, participant_name) do
    with {:ok, presentation_id} <- find_live_presentation_by_code(join_code),
         {:ok, participant_id, participant_token} <-
           upsert_participant(presentation_id, participant_name) do
      {:ok,
       %{
         presentation_id: presentation_id,
         participant_id: participant_id,
         participant_token: participant_token
       }}
    end
  end

  def get_snapshot(presentation_id) do
    case PresentationStore.fetch_snapshot(presentation_id) do
      {:ok, snapshot} -> {:ok, snapshot}
      {:error, _} -> get_snapshot_from_supabase(presentation_id)
    end
  end

  defp get_snapshot_from_supabase(presentation_id) do
    with {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
      case Req.get(
             url: "#{base_url}#{@supabase_rest}/presentations",
             params: %{id: "eq.#{presentation_id}", select: "*, slides:slides(*)"},
             headers: headers(api_key),
             receive_timeout: 10_000
           ) do
        {:ok, %{status: 200, body: [pres | _]}} ->
          slides = pres["slides"] || []
          sorted = Enum.sort_by(slides, &(&1["order_index"] || 0))
          current_index = pres["current_slide_index"] || 0

          snapshot = %{
            id: pres["id"],
            creator_id: pres["creator_id"],
            title: pres["title"],
            status: pres["status"],
            join_code: pres["join_code"],
            current_slide_index: current_index,
            slides: sorted,
            total_slides: length(sorted)
          }

          if snapshot.status == "live", do: PresentationStore.put_snapshot(snapshot)
          {:ok, snapshot}

        {:ok, %{status: 200, body: []}} ->
          {:error, :not_found}

        {:ok, %{status: status, body: body}} ->
          Logger.warning("Supabase presentation fetch failed #{status}: #{inspect(body)}")
          {:error, :fetch_failed}

        {:error, reason} ->
          Logger.warning("Supabase presentation fetch error: #{inspect(reason)}")
          {:error, :fetch_failed}
      end
    end
  end

  def next_slide(presentation_id, presenter_token) do
    with :ok <- ensure_presenter_token(presentation_id, presenter_token),
         {:ok, snapshot} <- get_snapshot(presentation_id) do
      new_index = min(snapshot.current_slide_index + 1, max(snapshot.total_slides - 1, 0))
      update_slide_index(presentation_id, new_index)
    end
  end

  def prev_slide(presentation_id, presenter_token) do
    with :ok <- ensure_presenter_token(presentation_id, presenter_token),
         {:ok, snapshot} <- get_snapshot(presentation_id) do
      new_index = max(snapshot.current_slide_index - 1, 0)
      update_slide_index(presentation_id, new_index)
    end
  end

  def goto_slide(presentation_id, index, presenter_token) when is_integer(index) do
    with :ok <- ensure_presenter_token(presentation_id, presenter_token),
         {:ok, snapshot} <- get_snapshot(presentation_id) do
      new_index = max(0, min(index, max(snapshot.total_slides - 1, 0)))
      update_slide_index(presentation_id, new_index)
    end
  end

  def submit_response(presentation_id, %{"slide_id" => slide_id} = payload) do
    participant_id = payload["participant_id"]
    participant_token = payload["participant_token"]

    with :ok <- ensure_participant_token(presentation_id, participant_id, participant_token),
         :ok <- ensure_slide_belongs_to_presentation(presentation_id, slide_id),
         {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
      case Req.get(
             url: "#{base_url}#{@supabase_rest}/slide_responses",
             params: %{
               slide_id: "eq.#{slide_id}",
               participant_id: "eq.#{participant_id}",
               select: "id"
             },
             headers: headers(api_key),
             receive_timeout: 10_000
           ) do
        {:ok, %{status: 200, body: [_ | _]}} ->
          with {:ok, activity} <- refresh_activity(slide_id), do: {:ok, activity.responses}

        _ ->
          insert_slide_response(base_url, api_key, slide_id, participant_id, payload)
      end
    end
  end

  defp insert_slide_response(base_url, api_key, slide_id, participant_id, payload) do
    body = %{
      slide_id: slide_id,
      participant_id: participant_id,
      participant_name: payload["participant_name"] || "Anonymous",
      response_data: payload["response_data"] || %{}
    }

    case Req.post(
           url: "#{base_url}#{@supabase_rest}/slide_responses",
           json: body,
           headers: headers(api_key),
           receive_timeout: 10_000
         ) do
      {:ok, %{status: status}} when status in [200, 201] ->
        with {:ok, activity} <- refresh_activity(slide_id), do: {:ok, activity.responses}

      {:ok, %{status: status, body: resp_body}} ->
        Logger.warning("Supabase response insert failed #{status}: #{inspect(resp_body)}")
        {:error, :insert_failed}

      {:error, reason} ->
        Logger.warning("Supabase response insert error: #{inspect(reason)}")
        {:error, :insert_failed}
    end
  end

  def submit_qna(presentation_id, %{"slide_id" => slide_id} = payload) do
    participant_id = payload["participant_id"]
    participant_token = payload["participant_token"]

    with :ok <- ensure_participant_token(presentation_id, participant_id, participant_token),
         :ok <- ensure_slide_belongs_to_presentation(presentation_id, slide_id),
         {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
      body = %{
        slide_id: slide_id,
        participant_id: participant_id,
        participant_name: payload["participant_name"] || "Anonymous",
        question: payload["question"] || ""
      }

      case Req.post(
             url: "#{base_url}#{@supabase_rest}/qna_questions",
             json: body,
             headers: headers(api_key),
             receive_timeout: 10_000
           ) do
        {:ok, %{status: status}} when status in [200, 201] ->
          with {:ok, activity} <- refresh_activity(slide_id), do: {:ok, activity.questions}

        {:ok, %{status: status, body: resp_body}} ->
          Logger.warning("Supabase QnA insert failed #{status}: #{inspect(resp_body)}")
          {:error, :insert_failed}

        {:error, reason} ->
          Logger.warning("Supabase QnA insert error: #{inspect(reason)}")
          {:error, :insert_failed}
      end
    end
  end

  def upvote_qna(presentation_id, question_id, participant_id, participant_token) do
    with :ok <- ensure_participant_token(presentation_id, participant_id, participant_token),
         {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
      case Req.get(
             url: "#{base_url}#{@supabase_rest}/qna_questions",
             params: %{id: "eq.#{question_id}", select: "upvotes,slide_id"},
             headers: headers(api_key),
             receive_timeout: 10_000
           ) do
        {:ok, %{status: 200, body: [q | _]}} ->
          with :ok <- ensure_slide_belongs_to_presentation(presentation_id, q["slide_id"]),
               :new <- ensure_new_qna_upvote(base_url, api_key, question_id, participant_id) do
            new_count = (q["upvotes"] || 0) + 1

            Req.patch(
              url: "#{base_url}#{@supabase_rest}/qna_questions",
              params: %{id: "eq.#{question_id}"},
              json: %{upvotes: new_count},
              headers: headers(api_key),
              receive_timeout: 10_000
            )

            with {:ok, activity} <- refresh_activity(q["slide_id"]), do: {:ok, activity.questions}
          else
            :existing ->
              with {:ok, activity} <- get_activity(q["slide_id"]), do: {:ok, activity.questions}

            {:error, reason} ->
              {:error, reason}
          end

        _ ->
          {:error, :not_found}
      end
    end
  end

  defp ensure_new_qna_upvote(base_url, api_key, question_id, participant_id) do
    case Req.post(
           url: "#{base_url}#{@supabase_rest}/qna_question_upvotes",
           json: %{question_id: question_id, participant_id: participant_id},
           headers: headers(api_key),
           receive_timeout: 10_000
         ) do
      {:ok, %{status: status}} when status in [200, 201] ->
        :new

      {:ok, %{status: 409}} ->
        :existing

      {:ok, %{status: status, body: body}} ->
        Logger.warning("Supabase QnA upvote insert failed #{status}: #{inspect(body)}")
        {:error, :insert_failed}

      {:error, reason} ->
        Logger.warning("Supabase QnA upvote insert error: #{inspect(reason)}")
        {:error, :insert_failed}
    end
  end

  def slide_activity(presentation_id, slide_id, auth_payload \\ %{}) do
    with :ok <- ensure_activity_access(presentation_id, auth_payload),
         :ok <- ensure_slide_belongs_to_presentation(presentation_id, slide_id),
         {:ok, activity} <- get_activity(slide_id) do
      {:ok, activity}
    end
  end

  def end_presentation(presentation_id, presenter_token) do
    with :ok <- ensure_presenter_token(presentation_id, presenter_token),
         {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
      now = DateTime.utc_now() |> DateTime.to_iso8601()

      Req.patch(
        url: "#{base_url}#{@supabase_rest}/presentations",
        params: %{id: "eq.#{presentation_id}"},
        json: %{status: "finished", finished_at: now},
        headers: headers(api_key),
        receive_timeout: 10_000
      )

      Req.patch(
        url: "#{base_url}#{@supabase_rest}/presentation_live_sessions",
        params: %{presentation_id: "eq.#{presentation_id}"},
        json: %{status: "finished", ended_at: now},
        headers: headers(api_key),
        receive_timeout: 10_000
      )

      PresentationStore.delete_presentation(presentation_id)
      {:ok, :ended}
    end
  end

  defp ensure_live_session(presentation_id) do
    with {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
      case Req.get(
             url: "#{base_url}#{@supabase_rest}/presentation_live_sessions",
             params: %{presentation_id: "eq.#{presentation_id}", select: "presenter_token,status"},
             headers: headers(api_key),
             receive_timeout: 10_000
           ) do
        {:ok, %{status: 200, body: [%{"presenter_token" => token} | _]}} when is_binary(token) ->
          case Req.patch(
                 url: "#{base_url}#{@supabase_rest}/presentation_live_sessions",
                 params: %{presentation_id: "eq.#{presentation_id}"},
                 json: %{status: "live", ended_at: nil},
                 headers: headers(api_key),
                 receive_timeout: 10_000
               ) do
            {:ok, %{status: status}} when status in [200, 204] ->
              PresentationStore.put_live_session(presentation_id, token)
              {:ok, token}

            {:ok, %{status: status, body: body}} ->
              Logger.warning(
                "Supabase live session reactivate failed #{status}: #{inspect(body)}"
              )

              {:error, :update_failed}

            {:error, reason} ->
              Logger.warning("Supabase live session reactivate error: #{inspect(reason)}")
              {:error, :update_failed}
          end

        {:ok, %{status: 200, body: []}} ->
          token = token()

          case Req.post(
                 url: "#{base_url}#{@supabase_rest}/presentation_live_sessions",
                 json: %{presentation_id: presentation_id, presenter_token: token, status: "live"},
                 headers: headers(api_key),
                 receive_timeout: 10_000
               ) do
            {:ok, %{status: status}} when status in [200, 201] ->
              PresentationStore.put_live_session(presentation_id, token)
              {:ok, token}

            {:ok, %{status: status, body: body}} ->
              Logger.warning("Supabase live session insert failed #{status}: #{inspect(body)}")
              {:error, :insert_failed}

            {:error, reason} ->
              Logger.warning("Supabase live session insert error: #{inspect(reason)}")
              {:error, :insert_failed}
          end

        _ ->
          {:error, :fetch_failed}
      end
    end
  end

  defp ensure_presenter_token(presentation_id, presenter_token) when is_binary(presenter_token) do
    if PresentationStore.presenter_token?(presentation_id, presenter_token) do
      :ok
    else
      with {:ok, base_url} <- fetch_env(:supabase_url),
           {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
        case Req.get(
               url: "#{base_url}#{@supabase_rest}/presentation_live_sessions",
               params: %{
                 presentation_id: "eq.#{presentation_id}",
                 presenter_token: "eq.#{presenter_token}",
                 status: "eq.live",
                 select: "id"
               },
               headers: headers(api_key),
               receive_timeout: 10_000
             ) do
          {:ok, %{status: 200, body: [_ | _]}} ->
            PresentationStore.put_live_session(presentation_id, presenter_token)
            :ok

          _ ->
            {:error, :not_presenter}
        end
      end
    end
  end

  defp ensure_presenter_token(_presentation_id, _token), do: {:error, :not_presenter}

  defp ensure_activity_access(presentation_id, %{"presenter_token" => token})
       when is_binary(token) do
    ensure_presenter_token(presentation_id, token)
  end

  defp ensure_activity_access(presentation_id, %{
         "participant_id" => participant_id,
         "participant_token" => participant_token
       }) do
    ensure_participant_token(presentation_id, participant_id, participant_token)
  end

  defp ensure_activity_access(_presentation_id, _payload),
    do: {:error, :invalid_participant_token}

  defp ensure_participant_token(presentation_id, participant_id, participant_token)
       when is_binary(participant_id) and is_binary(participant_token) do
    if PresentationStore.participant_token?(presentation_id, participant_id, participant_token) do
      :ok
    else
      with {:ok, base_url} <- fetch_env(:supabase_url),
           {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
        case Req.get(
               url: "#{base_url}#{@supabase_rest}/presentation_participants",
               params: %{
                 id: "eq.#{participant_id}",
                 presentation_id: "eq.#{presentation_id}",
                 participant_token: "eq.#{participant_token}",
                 select: "id"
               },
               headers: headers(api_key),
               receive_timeout: 10_000
             ) do
          {:ok, %{status: 200, body: [%{"participant_name" => name} | _]}} ->
            PresentationStore.put_participant(
              presentation_id,
              participant_id,
              participant_token,
              name || "Anonymous"
            )

            :ok

          {:ok, %{status: 200, body: [_ | _]}} ->
            PresentationStore.put_participant(presentation_id, participant_id, participant_token)
            :ok

          _ ->
            {:error, :invalid_participant_token}
        end
      end
    end
  end

  defp ensure_participant_token(_presentation_id, _participant_id, _participant_token),
    do: {:error, :invalid_participant_token}

  defp ensure_slide_belongs_to_presentation(presentation_id, slide_id) when is_binary(slide_id) do
    if PresentationStore.slide_belongs?(presentation_id, slide_id) do
      :ok
    else
      with {:ok, base_url} <- fetch_env(:supabase_url),
           {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
        case Req.get(
               url: "#{base_url}#{@supabase_rest}/slides",
               params: %{
                 id: "eq.#{slide_id}",
                 presentation_id: "eq.#{presentation_id}",
                 select: "id"
               },
               headers: headers(api_key),
               receive_timeout: 10_000
             ) do
          {:ok, %{status: 200, body: [_ | _]}} -> :ok
          _ -> {:error, :bad_slide}
        end
      end
    end
  end

  defp ensure_slide_belongs_to_presentation(_presentation_id, _slide_id), do: {:error, :bad_slide}

  defp find_live_presentation_by_code(join_code) do
    normalized =
      join_code |> to_string() |> String.trim() |> String.upcase() |> String.slice(0, 6)

    with {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
      case Req.get(
             url: "#{base_url}#{@supabase_rest}/presentations",
             params: %{join_code: "eq.#{normalized}", status: "eq.live", select: "id"},
             headers: headers(api_key),
             receive_timeout: 10_000
           ) do
        {:ok, %{status: 200, body: [%{"id" => id} | _]}} -> {:ok, id}
        _ -> {:error, :not_found}
      end
    end
  end

  defp upsert_participant(presentation_id, participant_name) do
    participant_id = "pp_" <> token(18)
    participant_token = token()
    name = participant_name |> to_string() |> String.trim() |> String.slice(0, 80)
    safe_name = if name == "", do: "Anonymous", else: name

    with {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
      body = %{
        id: participant_id,
        presentation_id: presentation_id,
        participant_token: participant_token,
        participant_name: safe_name
      }

      case Req.post(
             url: "#{base_url}#{@supabase_rest}/presentation_participants",
             json: body,
             headers: headers(api_key),
             receive_timeout: 10_000
           ) do
        {:ok, %{status: status}} when status in [200, 201] ->
          PresentationStore.put_participant(
            presentation_id,
            participant_id,
            participant_token,
            safe_name
          )

          {:ok, participant_id, participant_token}

        {:ok, %{status: status, body: resp_body}} ->
          Logger.warning("Supabase participant insert failed #{status}: #{inspect(resp_body)}")
          {:error, :insert_failed}

        {:error, reason} ->
          Logger.warning("Supabase participant insert error: #{inspect(reason)}")
          {:error, :insert_failed}
      end
    end
  end

  defp update_slide_index(presentation_id, new_index),
    do: update_presentation(presentation_id, %{current_slide_index: new_index})

  defp update_presentation(presentation_id, patch) do
    with {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
      case Req.patch(
             url: "#{base_url}#{@supabase_rest}/presentations",
             params: %{id: "eq.#{presentation_id}"},
             json: patch,
             headers: headers(api_key),
             receive_timeout: 10_000
           ) do
        {:ok, %{status: 200}} ->
          cached_or_refresh_snapshot(presentation_id, patch)

        {:ok, %{status: 204}} ->
          cached_or_refresh_snapshot(presentation_id, patch)

        {:ok, %{status: status, body: body}} ->
          Logger.warning("Supabase presentation update failed #{status}: #{inspect(body)}")
          {:error, :update_failed}

        {:error, reason} ->
          Logger.warning("Supabase presentation update error: #{inspect(reason)}")
          {:error, :update_failed}
      end
    end
  end

  defp get_slide_responses_from_supabase(slide_id) do
    with {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
      case Req.get(
             url: "#{base_url}#{@supabase_rest}/slide_responses",
             params: %{slide_id: "eq.#{slide_id}", select: "*", order: "created_at.desc"},
             headers: headers(api_key),
             receive_timeout: 10_000
           ) do
        {:ok, %{status: 200, body: responses}} -> {:ok, responses}
        _ -> {:ok, []}
      end
    end
  end

  defp get_activity(slide_id) do
    case PresentationStore.fetch_activity(slide_id) do
      {:ok, activity} -> {:ok, activity}
      {:error, _} -> refresh_activity(slide_id)
    end
  end

  defp refresh_activity(slide_id) do
    with {:ok, responses} <- get_slide_responses_from_supabase(slide_id),
         {:ok, questions} <- get_qna_questions_from_supabase(slide_id) do
      PresentationStore.put_activity(slide_id, responses, questions)
      {:ok, %{responses: responses, questions: questions}}
    end
  end

  defp get_qna_questions_from_supabase(slide_id) do
    with {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
      case Req.get(
             url: "#{base_url}#{@supabase_rest}/qna_questions",
             params: %{slide_id: "eq.#{slide_id}", select: "*", order: "upvotes.desc"},
             headers: headers(api_key),
             receive_timeout: 10_000
           ) do
        {:ok, %{status: 200, body: questions}} -> {:ok, questions}
        _ -> {:ok, []}
      end
    end
  end

  defp refresh_snapshot(presentation_id) do
    with {:ok, snapshot} <- get_snapshot_from_supabase(presentation_id) do
      PresentationStore.put_snapshot(snapshot)
      {:ok, snapshot}
    end
  end

  defp cached_or_refresh_snapshot(presentation_id, patch) do
    case PresentationStore.fetch_snapshot(presentation_id) do
      {:ok, snapshot} ->
        updated = Map.merge(snapshot, patch)
        PresentationStore.put_snapshot(updated)
        {:ok, updated}

      {:error, _} ->
        refresh_snapshot(presentation_id)
    end
  end

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
      {"content-type", "application/json"},
      {"accept", "application/json"},
      {"prefer", "return=representation"}
    ]
  end

  defp token(bytes \\ 32) do
    bytes
    |> :crypto.strong_rand_bytes()
    |> Base.url_encode64(padding: false)
  end
end
