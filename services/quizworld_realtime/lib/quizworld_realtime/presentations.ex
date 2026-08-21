defmodule QuizworldRealtime.Presentations do
  @moduledoc """
  Phoenix-authoritative context for QuizWorld Present.

  Supabase stores durable deck/report data. Phoenix validates presenter/participant
  tokens for live actions and broadcasts realtime state.
  """

  require Logger

  alias QuizworldRealtime.PresentationSnapshot
  alias QuizworldRealtime.PresentationStore

  @supabase_rest "/rest/v1"

  def start_live(presentation_id, host_id) do
    with {:ok, snapshot} <- get_snapshot_from_supabase(presentation_id, nil),
         true <- snapshot.creator_id == host_id || {:error, :not_host},
         {:ok, run_id, presenter_token} <- create_live_session(presentation_id),
         {:ok, updated} <- get_snapshot_from_supabase(presentation_id, run_id) do
      PresentationStore.put_live_session(presentation_id, run_id, presenter_token)
      PresentationStore.put_snapshot(updated)
      {:ok, updated, presenter_token}
    end
  end

  def join_by_code(join_code, participant_name) do
    with {:ok, presentation_id, run_id} <- find_live_presentation_by_code(join_code),
         {:ok, participant_id, participant_token} <-
           insert_participant(presentation_id, run_id, participant_name) do
      {:ok,
       %{
         presentation_id: presentation_id,
         run_id: run_id,
         participant_id: participant_id,
         participant_token: participant_token
       }}
    end
  end

  def get_snapshot(presentation_id) do
    with {:ok, run_id, _token} <- active_run(presentation_id) do
      case PresentationStore.fetch_snapshot(presentation_id, run_id) do
        {:ok, snapshot} -> {:ok, snapshot}
        {:error, _} -> get_snapshot_from_supabase(presentation_id, run_id)
      end
    end
  end

  # The presentation channel calls this during WebSocket join before assigning
  # presenter privileges. Never infer a presenter role from the mere presence
  # of a token in an untrusted client payload.
  def presenter_authorized?(presentation_id, presenter_token) when is_binary(presenter_token) do
    ensure_presenter_token(presentation_id, presenter_token) == :ok
  end

  def presenter_authorized?(_presentation_id, _presenter_token), do: false

  def participant_authorized?(presentation_id, participant_id, participant_token) do
    match?(
      {:ok, _run_id},
      ensure_participant_token(presentation_id, participant_id, participant_token)
    )
  end

  def public_activity(activity, results_hidden) do
    responses = activity[:responses] || activity["responses"] || []
    questions = activity[:questions] || activity["questions"] || []

    %{
      response_count: length(responses),
      aggregates: if(results_hidden, do: %{}, else: aggregate_responses(responses)),
      questions: Enum.map(questions, &Map.take(&1, ["id", "question", "upvotes", "slide_id"]))
    }
  end

  def public_slide_activity(presentation_id, slide_id) do
    with {:ok, run_id, _} <- active_run(presentation_id),
         :ok <- ensure_slide_belongs_to_run(presentation_id, run_id, slide_id),
         {:ok, activity} <- get_activity(slide_id),
         {:ok, snapshot} <- get_snapshot(presentation_id) do
      {:ok, public_activity(activity, snapshot.results_hidden)}
    end
  end

  defp aggregate_responses(responses) do
    poll_counts =
      Enum.reduce(responses, %{}, fn row, counts ->
        option_id = get_in(row, ["response_data", "option_id"])
        if is_binary(option_id), do: Map.update(counts, option_id, 1, &(&1 + 1)), else: counts
      end)

    answer_counts =
      Enum.reduce(responses, %{}, fn row, counts ->
        answer_id = get_in(row, ["response_data", "answer_id"])
        if is_binary(answer_id), do: Map.update(counts, answer_id, 1, &(&1 + 1)), else: counts
      end)

    word_counts =
      Enum.reduce(responses, %{}, fn row, counts ->
        words = get_in(row, ["response_data", "words"])

        if is_binary(words) do
          words
          |> String.split(~r/[\s,]+/, trim: true)
          |> Enum.filter(&(String.length(&1) > 1))
          |> Enum.reduce(counts, fn word, acc ->
            Map.update(acc, String.downcase(word), 1, &(&1 + 1))
          end)
        else
          counts
        end
      end)

    sorted_words =
      word_counts
      |> Enum.sort_by(fn {_word, count} -> -count end)
      |> Enum.take(30)

    scale_values =
      responses
      |> Enum.map(&get_in(&1, ["response_data", "value"]))
      |> Enum.filter(&is_number/1)

    scale_avg =
      case scale_values do
        [] -> 0
        values -> Float.round(Enum.sum(values) / length(values), 1)
      end

    %{
      "poll_counts" => poll_counts,
      "answer_counts" => answer_counts,
      "sorted_words" => sorted_words,
      "scale_values" => scale_values,
      "scale_avg" => scale_avg
    }
  end

  def reveal_quiz(presentation_id, slide_id, presenter_token) do
    with :ok <- ensure_presenter_token(presentation_id, presenter_token),
         {:ok, snapshot} <- get_snapshot(presentation_id),
         {:ok, correct_ids, reveals} <- reveal_for_snapshot(snapshot, slide_id),
         {:ok, run_id, _} <- active_run(presentation_id) do
      updated = Map.put(snapshot, :quiz_reveals, reveals)

      with :ok <- persist_run_state(presentation_id, run_id, %{quiz_reveals: reveals}) do
        PresentationStore.put_snapshot(updated)
        {:ok, updated, correct_ids}
      end
    else
      nil -> {:error, :bad_slide}
      false -> {:error, :bad_slide}
      {:error, _} = error -> error
      _ -> {:error, :bad_slide}
    end
  end

  @doc false
  def reveal_for_snapshot(snapshot, slide_id) do
    with %{} = slide <- Enum.at(snapshot.slides, snapshot.current_slide_index),
         ^slide_id <- slide["id"] || slide[:id],
         {:ok, answers} <- quiz_answers_for_slide(slide) do
      correct_ids =
        for answer <- answers,
            (answer["is_correct"] || answer[:is_correct]) == true,
            do: answer["id"] || answer[:id]

      {:ok, correct_ids, Map.put(snapshot[:quiz_reveals] || %{}, slide_id, correct_ids)}
    else
      _ -> {:error, :bad_slide}
    end
  end

  defp quiz_answers_for_slide(slide) do
    type = slide["slide_type"] || slide[:slide_type]
    content = slide["content"] || slide[:content] || %{}
    interactive = content["interactive"] || content[:interactive] || %{}

    cond do
      type == "quiz" ->
        {:ok, content["answers"] || content[:answers] || []}

      type == "content" and (interactive["type"] || interactive[:type]) == "quiz" ->
        {:ok, interactive["answers"] || interactive[:answers] || []}

      true ->
        {:error, :bad_slide}
    end
  end

  defp persist_run_state(presentation_id, run_id, state) do
    with {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
      case Req.patch(
             url: "#{base_url}#{@supabase_rest}/presentation_live_sessions",
             params: %{id: "eq.#{run_id}", presentation_id: "eq.#{presentation_id}"},
             json: %{state: state},
             headers: headers(api_key),
             receive_timeout: 10_000
           ) do
        {:ok, %{status: status}} when status in [200, 204] -> :ok
        _ -> {:error, :update_failed}
      end
    end
  end

  defp get_snapshot_from_supabase(presentation_id, run_id) do
    with {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
      case Req.get(
             url: "#{base_url}#{@supabase_rest}/presentations",
             params: %{id: "eq.#{presentation_id}", select: "*, slides:slides(*)"},
             headers: headers(api_key),
             receive_timeout: 10_000
           ) do
        {:ok, %{status: 200, body: [pres | _]}} ->
          state =
            if run_id, do: load_run_state(base_url, api_key, presentation_id, run_id), else: %{}

          snapshot =
            pres
            |> PresentationSnapshot.from_record()
            |> Map.put(:run_id, run_id)
            |> Map.put(:quiz_reveals, state["quiz_reveals"] || %{})

          if snapshot.status == "live" and run_id, do: PresentationStore.put_snapshot(snapshot)
          {:ok, snapshot}

        {:ok, %{status: 200, body: []}} ->
          {:error, :not_found}

        {:ok, %{status: status, body: _body}} ->
          Logger.warning("Supabase presentation fetch failed with status #{status}")
          {:error, :fetch_failed}

        {:error, _reason} ->
          Logger.warning("Supabase presentation fetch transport error")
          {:error, :fetch_failed}
      end
    end
  end

  defp load_run_state(base_url, api_key, presentation_id, run_id) do
    case Req.get(
           url: "#{base_url}#{@supabase_rest}/presentation_live_sessions",
           params: %{
             id: "eq.#{run_id}",
             presentation_id: "eq.#{presentation_id}",
             select: "state"
           },
           headers: headers(api_key),
           receive_timeout: 10_000
         ) do
      {:ok, %{status: 200, body: [%{"state" => state} | _]}} when is_map(state) -> state
      _ -> %{}
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

  def set_results_hidden(presentation_id, hidden, presenter_token) when is_boolean(hidden) do
    with :ok <- ensure_presenter_token(presentation_id, presenter_token),
         {:ok, snapshot} <- get_snapshot(presentation_id) do
      updated = PresentationSnapshot.with_results_hidden(snapshot, hidden)

      with {:ok, _} <- update_presentation(presentation_id, %{settings: updated.settings}) do
        PresentationStore.put_snapshot(updated)
        {:ok, updated}
      end
    end
  end

  def submit_response(presentation_id, %{"slide_id" => slide_id} = payload) do
    participant_id = payload["participant_id"]
    participant_token = payload["participant_token"]

    with {:ok, run_id} <-
           ensure_participant_token(presentation_id, participant_id, participant_token),
         :ok <- ensure_slide_belongs_to_run(presentation_id, run_id, slide_id),
         {:ok, slide} <- ensure_current_slide(presentation_id, slide_id),
         {:ok, response_data} <- validate_response_for_slide(slide, payload["response_data"]),
         {:ok, participant_name} <- participant_name(presentation_id, run_id, participant_id),
         {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
      server_payload = %{"participant_name" => participant_name, "response_data" => response_data}

      case Req.get(
             url: "#{base_url}#{@supabase_rest}/slide_responses",
             params: %{
               slide_id: "eq.#{slide_id}",
               run_id: "eq.#{run_id}",
               participant_id: "eq.#{participant_id}",
               select: "id"
             },
             headers: headers(api_key),
             receive_timeout: 10_000
           ) do
        {:ok, %{status: 200, body: [_ | _]}} ->
          with {:ok, activity} <- refresh_activity(slide_id), do: {:ok, activity.responses}

        _ ->
          insert_slide_response(
            base_url,
            api_key,
            run_id,
            slide_id,
            participant_id,
            server_payload
          )
      end
    end
  end

  defp insert_slide_response(
         base_url,
         api_key,
         run_id,
         slide_id,
         participant_id,
         payload
       ) do
    body = %{
      run_id: run_id,
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

      {:ok, %{status: 409}} ->
        with {:ok, activity} <- refresh_activity(slide_id), do: {:ok, activity.responses}

      {:ok, %{status: status, body: _resp_body}} ->
        Logger.warning("Supabase response insert failed with status #{status}")
        {:error, :insert_failed}

      {:error, _reason} ->
        Logger.warning("Supabase response insert transport error")
        {:error, :insert_failed}
    end
  end

  def submit_qna(presentation_id, %{"slide_id" => slide_id} = payload) do
    participant_id = payload["participant_id"]
    participant_token = payload["participant_token"]

    with {:ok, run_id} <-
           ensure_participant_token(presentation_id, participant_id, participant_token),
         :ok <- ensure_slide_belongs_to_run(presentation_id, run_id, slide_id),
         {:ok, slide} <- ensure_current_slide(presentation_id, slide_id),
         {:ok, question} <- validate_qna_for_slide(slide, payload["question"]),
         {:ok, participant_name} <- participant_name(presentation_id, run_id, participant_id),
         {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
      body = %{
        presentation_id: presentation_id,
        run_id: run_id,
        slide_id: slide_id,
        participant_id: participant_id,
        participant_name: participant_name,
        question: question
      }

      case Req.post(
             url: "#{base_url}#{@supabase_rest}/qna_questions",
             json: body,
             headers: headers(api_key),
             receive_timeout: 10_000
           ) do
        {:ok, %{status: status}} when status in [200, 201] ->
          with {:ok, activity} <- refresh_activity(slide_id), do: {:ok, activity.questions}

        {:ok, %{status: status, body: _resp_body}} ->
          Logger.warning("Supabase QnA insert failed with status #{status}")
          {:error, :insert_failed}

        {:error, _reason} ->
          Logger.warning("Supabase QnA insert transport error")
          {:error, :insert_failed}
      end
    end
  end

  def upvote_qna(presentation_id, question_id, participant_id, participant_token) do
    with {:ok, run_id} <-
           ensure_participant_token(presentation_id, participant_id, participant_token),
         {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
      case Req.post(
             url: "#{base_url}#{@supabase_rest}/rpc/upvote_presentation_qna",
             json: %{
               p_presentation_id: presentation_id,
               p_run_id: run_id,
               p_question_id: question_id,
               p_participant_id: participant_id
             },
             headers: headers(api_key),
             receive_timeout: 10_000
           ) do
        {:ok, %{status: 200, body: %{"slide_id" => slide_id}}} ->
          with {:ok, activity} <- refresh_activity(slide_id),
               do: {:ok, slide_id, activity.questions}

        {:ok, %{status: status}} ->
          Logger.warning("Supabase QnA upvote RPC failed with status #{status}")
          {:error, :insert_failed}

        {:error, _reason} ->
          Logger.warning("Supabase QnA upvote RPC transport failed")
          {:error, :insert_failed}
      end
    end
  end

  def slide_activity(presentation_id, slide_id, auth_payload \\ %{}) do
    with {:ok, role} <- ensure_activity_access(presentation_id, auth_payload),
         {:ok, snapshot} <- get_snapshot(presentation_id) do
      case role do
        :presenter ->
          with {:ok, run_id, _} <- active_run(presentation_id),
               :ok <- ensure_slide_belongs_to_run(presentation_id, run_id, slide_id),
               {:ok, activity} <- get_activity(presentation_id, run_id, slide_id) do
            {:ok, activity}
          end

        {:participant, participant_id, run_id} ->
          with :ok <- ensure_slide_belongs_to_run(presentation_id, run_id, slide_id),
               {:ok, activity} <- get_activity(presentation_id, run_id, slide_id) do
            shaped =
              activity
              |> public_activity(snapshot.results_hidden)
              |> Map.put(
                :own_response,
                Enum.find(activity.responses || [], &(&1["participant_id"] == participant_id))
              )

            {:ok, shaped}
          end
      end
    end
  end

  def end_presentation(presentation_id, presenter_token) do
    with :ok <- ensure_presenter_token(presentation_id, presenter_token),
         {:ok, run_id, _} <- active_run(presentation_id),
         {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
      case Req.post(
             url: "#{base_url}#{@supabase_rest}/rpc/finish_presentation_run",
             json: %{
               p_presentation_id: presentation_id,
               p_run_id: run_id,
               p_presenter_token: presenter_token
             },
             headers: headers(api_key),
             receive_timeout: 10_000
           ) do
        {:ok, %{status: 200}} ->
          PresentationStore.delete_presentation(presentation_id, run_id)
          {:ok, :ended}

        {:ok, %{status: status}} ->
          Logger.warning("Supabase presentation finish RPC failed with status #{status}")
          {:error, :update_failed}

        {:error, _reason} ->
          Logger.warning("Supabase presentation finish RPC transport error")
          {:error, :update_failed}
      end
    end
  end

  # A live session is an immutable run. Starting never mutates or deletes an
  # earlier run's participants, responses, or Q&A rows.
  defp create_live_session(presentation_id) do
    with {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
      presenter_token = token()

      case Req.post(
             url: "#{base_url}#{@supabase_rest}/rpc/start_presentation_run",
             json: %{
               p_presentation_id: presentation_id,
               p_presenter_token: presenter_token
             },
             headers: headers(api_key),
             receive_timeout: 10_000
           ) do
        {:ok, %{status: 200, body: %{"run_id" => run_id}}} ->
          {:ok, run_id, presenter_token}

        {:ok, %{status: status}} ->
          Logger.warning("Supabase presentation start RPC failed with status #{status}")
          {:error, :insert_failed}

        {:error, _reason} ->
          Logger.warning("Supabase presentation start RPC transport error")
          {:error, :insert_failed}
      end
    end
  end

  defp active_run(presentation_id) do
    case PresentationStore.get_live_session(presentation_id) do
      {:ok, run_id, token} -> {:ok, run_id, token}
      _ -> fetch_active_run(presentation_id)
    end
  end

  defp fetch_active_run(presentation_id) do
    with {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key),
         {:ok, %{status: 200, body: [%{"id" => run_id, "presenter_token" => token} | _]}} <-
           Req.get(
             url: "#{base_url}#{@supabase_rest}/presentation_live_sessions",
             params: %{
               presentation_id: "eq.#{presentation_id}",
               status: "eq.live",
               select: "id,presenter_token",
               order: "started_at.desc",
               limit: 1
             },
             headers: headers(api_key),
             receive_timeout: 10_000
           ) do
      PresentationStore.put_live_session(presentation_id, run_id, token)
      {:ok, run_id, token}
    else
      _ -> {:error, :not_found}
    end
  end

  defp ensure_presenter_token(presentation_id, presenter_token) when is_binary(presenter_token) do
    with {:ok, run_id, _} <- active_run(presentation_id) do
      if PresentationStore.presenter_token?(presentation_id, run_id, presenter_token) do
        :ok
      else
        with {:ok, base_url} <- fetch_env(:supabase_url),
             {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
          case Req.get(
                 url: "#{base_url}#{@supabase_rest}/presentation_live_sessions",
                 params: %{
                   presentation_id: "eq.#{presentation_id}",
                   id: "eq.#{run_id}",
                   presenter_token: "eq.#{presenter_token}",
                   status: "eq.live",
                   select: "id"
                 },
                 headers: headers(api_key),
                 receive_timeout: 10_000
               ) do
            {:ok, %{status: 200, body: [_ | _]}} ->
              PresentationStore.put_live_session(presentation_id, run_id, presenter_token)
              :ok

            _ ->
              {:error, :not_presenter}
          end
        end
      end
    end
  end

  defp ensure_presenter_token(_presentation_id, _token), do: {:error, :not_presenter}

  defp ensure_activity_access(presentation_id, %{"presenter_token" => token})
       when is_binary(token) do
    case ensure_presenter_token(presentation_id, token) do
      :ok -> {:ok, :presenter}
      error -> error
    end
  end

  defp ensure_activity_access(presentation_id, %{
         "participant_id" => participant_id,
         "participant_token" => participant_token
       }) do
    case ensure_participant_token(presentation_id, participant_id, participant_token) do
      {:ok, run_id} -> {:ok, {:participant, participant_id, run_id}}
      error -> error
    end
  end

  defp ensure_activity_access(_presentation_id, _payload),
    do: {:error, :invalid_participant_token}

  defp ensure_participant_token(presentation_id, participant_id, participant_token)
       when is_binary(participant_id) and is_binary(participant_token) do
    with {:ok, run_id, _} <- active_run(presentation_id) do
      if PresentationStore.participant_token?(
           presentation_id,
           run_id,
           participant_id,
           participant_token
         ) do
        {:ok, run_id}
      else
        with {:ok, base_url} <- fetch_env(:supabase_url),
             {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
          case Req.get(
                 url: "#{base_url}#{@supabase_rest}/presentation_participants",
                 params: %{
                   id: "eq.#{participant_id}",
                   presentation_id: "eq.#{presentation_id}",
                   run_id: "eq.#{run_id}",
                   participant_token: "eq.#{participant_token}",
                   select: "id,participant_name"
                 },
                 headers: headers(api_key),
                 receive_timeout: 10_000
               ) do
            {:ok, %{status: 200, body: [%{"participant_name" => name} | _]}} ->
              PresentationStore.put_participant(
                presentation_id,
                participant_id,
                participant_token,
                name || "Anonymous",
                run_id
              )

              {:ok, run_id}

            {:ok, %{status: 200, body: [_ | _]}} ->
              PresentationStore.put_participant(
                presentation_id,
                participant_id,
                participant_token,
                "Anonymous",
                run_id
              )

              {:ok, run_id}

            _ ->
              {:error, :invalid_participant_token}
          end
        end
      end
    end
  end

  defp ensure_participant_token(_presentation_id, _participant_id, _participant_token),
    do: {:error, :invalid_participant_token}

  defp participant_name(presentation_id, run_id, participant_id) do
    with {:ok, participant} <-
           PresentationStore.fetch_participant(presentation_id, run_id, participant_id),
         name when is_binary(name) <- participant["participant_name"] do
      {:ok, name |> String.trim() |> String.slice(0, 80)}
    else
      _ -> {:error, :invalid_participant_token}
    end
  end

  defp ensure_current_slide(presentation_id, slide_id) do
    with {:ok, snapshot} <- get_snapshot(presentation_id),
         %{} = slide <- Enum.at(snapshot.slides, snapshot.current_slide_index),
         ^slide_id <- slide["id"] || slide[:id] do
      {:ok, slide}
    else
      _ -> {:error, :stale_slide}
    end
  end

  @doc false
  def validate_response_for_slide(slide, response_data) when is_map(response_data) do
    type = slide["slide_type"] || slide[:slide_type]
    content = slide["content"] || slide[:content] || %{}
    interactive = content["interactive"] || content[:interactive]
    definition = if is_map(interactive), do: interactive, else: content

    response_type =
      if is_map(interactive), do: interactive["type"] || interactive[:type], else: type

    case response_type do
      "poll" ->
        validate_choice(
          response_data,
          definition["options"] || definition[:options] || [],
          "option_id"
        )

      "quiz" ->
        validate_choice(
          response_data,
          definition["answers"] || definition[:answers] || [],
          "answer_id"
        )

      "open_text" ->
        validate_short_text(response_data, "text", 2_000)

      "word_cloud" ->
        validate_short_text(response_data, "words", 80)

      "scale" ->
        value = response_data["value"]
        min_value = definition["min"] || definition[:min] || 1
        max_value = definition["max"] || definition[:max] || 10

        if is_number(value) and value >= min_value and value <= max_value,
          do: {:ok, %{"value" => value}},
          else: {:error, :bad_response}

      _ ->
        {:error, :bad_response}
    end
  end

  def validate_response_for_slide(_slide, _response_data), do: {:error, :bad_response}

  defp validate_choice(response_data, choices, key) do
    choice_id = response_data[key]
    valid_ids = Enum.map(choices, &(&1["id"] || &1[:id]))

    if is_binary(choice_id) and choice_id in valid_ids,
      do: {:ok, %{key => choice_id}},
      else: {:error, :bad_response}
  end

  defp validate_short_text(response_data, key, max_length) do
    value = response_data[key]
    trimmed = if is_binary(value), do: String.trim(value), else: ""

    if trimmed != "" and String.length(trimmed) <= max_length,
      do: {:ok, %{key => trimmed}},
      else: {:error, :bad_response}
  end

  @doc false
  def validate_qna_for_slide(slide, question) do
    type = slide["slide_type"] || slide[:slide_type]
    content = slide["content"] || slide[:content] || %{}
    interactive = content["interactive"] || content[:interactive] || %{}

    is_qna =
      type == "qna" or
        (type == "content" and (interactive["type"] || interactive[:type]) == "qna")

    trimmed = if is_binary(question), do: String.trim(question), else: ""

    if is_qna and trimmed != "" and String.length(trimmed) <= 500,
      do: {:ok, trimmed},
      else: {:error, :bad_response}
  end

  defp ensure_slide_belongs_to_run(presentation_id, run_id, slide_id)
       when is_binary(run_id) and is_binary(slide_id) do
    with {:ok, ^run_id, _} <- active_run(presentation_id) do
      if PresentationStore.slide_belongs?(presentation_id, run_id, slide_id) do
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
    else
      _ -> {:error, :invalid_participant_token}
    end
  end

  defp ensure_slide_belongs_to_run(_presentation_id, _run_id, _slide_id), do: {:error, :bad_slide}

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
        {:ok, %{status: 200, body: [%{"id" => id} | _]}} ->
          case active_run(id) do
            {:ok, run_id, _} -> {:ok, id, run_id}
            _ -> {:error, :not_found}
          end

        _ ->
          {:error, :not_found}
      end
    end
  end

  defp insert_participant(presentation_id, run_id, participant_name) do
    participant_id = "pp_" <> token(18)
    participant_token = token()
    name = participant_name |> to_string() |> String.trim() |> String.slice(0, 80)
    safe_name = if name == "", do: "Anonymous", else: name

    with {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
      body = %{
        id: participant_id,
        presentation_id: presentation_id,
        run_id: run_id,
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
            safe_name,
            run_id
          )

          {:ok, participant_id, participant_token}

        {:ok, %{status: status, body: _resp_body}} ->
          Logger.warning("Supabase participant insert failed with status #{status}")
          {:error, :insert_failed}

        {:error, _reason} ->
          Logger.warning("Supabase participant insert transport error")
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

        {:ok, %{status: status, body: _body}} ->
          Logger.warning("Supabase presentation update failed with status #{status}")
          {:error, :update_failed}

        {:error, _reason} ->
          Logger.warning("Supabase presentation update transport error")
          {:error, :update_failed}
      end
    end
  end

  defp get_slide_responses_from_supabase(slide_id, run_id) do
    with {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
      case Req.get(
             url: "#{base_url}#{@supabase_rest}/slide_responses",
             params: %{
               slide_id: "eq.#{slide_id}",
               run_id: "eq.#{run_id}",
               select: "*",
               order: "created_at.desc"
             },
             headers: headers(api_key),
             receive_timeout: 10_000
           ) do
        {:ok, %{status: 200, body: responses}} ->
          {:ok, responses}

        {:ok, %{status: status, body: _body}} ->
          Logger.warning("Supabase slide responses fetch failed with status #{status}")
          {:error, :activity_unavailable}

        {:error, _reason} ->
          Logger.warning("Supabase slide responses fetch transport error")
          {:error, :activity_unavailable}
      end
    end
  end

  defp get_activity(presentation_id, run_id, slide_id) do
    case PresentationStore.fetch_activity(presentation_id, run_id, slide_id) do
      {:ok, activity} -> {:ok, activity}
      {:error, _} -> refresh_activity(presentation_id, run_id, slide_id)
    end
  end

  defp get_activity(slide_id) do
    with {:ok, presentation_id, run_id} <- context_for_slide(slide_id) do
      get_activity(presentation_id, run_id, slide_id)
    end
  end

  defp refresh_activity(presentation_id, run_id, slide_id) do
    with {:ok, responses} <- get_slide_responses_from_supabase(slide_id, run_id),
         {:ok, questions} <- get_qna_questions_from_supabase(slide_id, run_id) do
      PresentationStore.put_activity(presentation_id, run_id, slide_id, responses, questions)
      {:ok, %{responses: responses, questions: questions}}
    end
  end

  defp refresh_activity(slide_id) do
    with {:ok, presentation_id, run_id} <- context_for_slide(slide_id) do
      refresh_activity(presentation_id, run_id, slide_id)
    end
  end

  defp context_for_slide(slide_id) do
    with {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key),
         {:ok, %{status: 200, body: [%{"presentation_id" => presentation_id} | _]}} <-
           Req.get(
             url: "#{base_url}#{@supabase_rest}/slides",
             params: %{id: "eq.#{slide_id}", select: "presentation_id"},
             headers: headers(api_key),
             receive_timeout: 10_000
           ),
         {:ok, run_id, _} <- active_run(presentation_id) do
      {:ok, presentation_id, run_id}
    else
      _ -> {:error, :bad_slide}
    end
  end

  defp get_qna_questions_from_supabase(slide_id, run_id) do
    with {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
      case Req.get(
             url: "#{base_url}#{@supabase_rest}/qna_questions",
             params: %{
               slide_id: "eq.#{slide_id}",
               run_id: "eq.#{run_id}",
               select: "*",
               order: "upvotes.desc"
             },
             headers: headers(api_key),
             receive_timeout: 10_000
           ) do
        {:ok, %{status: 200, body: questions}} ->
          {:ok, questions}

        {:ok, %{status: status, body: _body}} ->
          Logger.warning("Supabase QnA fetch failed with status #{status}")
          {:error, :activity_unavailable}

        {:error, _reason} ->
          Logger.warning("Supabase QnA fetch transport error")
          {:error, :activity_unavailable}
      end
    end
  end

  defp refresh_snapshot(presentation_id) do
    with {:ok, run_id, _} <- active_run(presentation_id),
         {:ok, snapshot} <- get_snapshot_from_supabase(presentation_id, run_id) do
      PresentationStore.put_snapshot(snapshot)
      {:ok, snapshot}
    end
  end

  defp cached_or_refresh_snapshot(presentation_id, patch) do
    with {:ok, run_id, _} <- active_run(presentation_id) do
      case PresentationStore.fetch_snapshot(presentation_id, run_id) do
        {:ok, snapshot} ->
          updated = Map.merge(snapshot, patch)
          PresentationStore.put_snapshot(updated)
          {:ok, updated}

        {:error, _} ->
          refresh_snapshot(presentation_id)
      end
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
