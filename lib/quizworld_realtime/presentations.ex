defmodule QuizworldRealtime.Presentations do
  @moduledoc """
  Context module for QuizWorld Present.
  Reads/writes presentation state from Supabase and broadcasts via Phoenix PubSub.
  """

  require Logger

  @supabase_rest "/rest/v1"

  def get_snapshot(presentation_id) do
    with {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
      # Fetch presentation + slides
      case Req.get(
        url: "#{base_url}#{@supabase_rest}/presentations",
        params: %{id: "eq.#{presentation_id}", select: "*", slides: "select(*,order_index)"},
        headers: headers(api_key),
        receive_timeout: 10_000
      ) do
        {:ok, %{status: 200, body: [pres | _]}} ->
          slides = pres["slides"] || []
          sorted = Enum.sort_by(slides, & &1["order_index"])
          current_index = pres["current_slide_index"] || 0

          {:ok,
           %{
             id: pres["id"],
             title: pres["title"],
             status: pres["status"],
             join_code: pres["join_code"],
             current_slide_index: current_index,
             slides: sorted,
             total_slides: length(sorted)
           }}

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

  def next_slide(presentation_id) do
    with {:ok, snapshot} <- get_snapshot(presentation_id) do
      new_index = min(snapshot.current_slide_index + 1, snapshot.total_slides - 1)
      update_slide_index(presentation_id, new_index)
    end
  end

  def prev_slide(presentation_id) do
    with {:ok, snapshot} <- get_snapshot(presentation_id) do
      new_index = max(snapshot.current_slide_index - 1, 0)
      update_slide_index(presentation_id, new_index)
    end
  end

  def goto_slide(presentation_id, index) when is_integer(index) do
    with {:ok, snapshot} <- get_snapshot(presentation_id) do
      new_index = max(0, min(index, snapshot.total_slides - 1))
      update_slide_index(presentation_id, new_index)
    end
  end

  def submit_response(presentation_id, %{"slide_id" => slide_id} = payload) do
    with {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
      body = %{
        slide_id: slide_id,
        participant_id: payload["participant_id"] || "anonymous",
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
          # Fetch updated responses for this slide
          get_slide_responses(slide_id)

        {:ok, %{status: status, body: resp_body}} ->
          Logger.warning("Supabase response insert failed #{status}: #{inspect(resp_body)}")
          {:error, :insert_failed}

        {:error, reason} ->
          Logger.warning("Supabase response insert error: #{inspect(reason)}")
          {:error, :insert_failed}
      end
    end
  end

  def submit_qna(presentation_id, %{"slide_id" => slide_id} = payload) do
    with {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
      body = %{
        slide_id: slide_id,
        participant_id: payload["participant_id"] || "anonymous",
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
          get_qna_questions(slide_id)

        {:ok, %{status: status, body: resp_body}} ->
          Logger.warning("Supabase QnA insert failed #{status}: #{inspect(resp_body)}")
          {:error, :insert_failed}

        {:error, reason} ->
          Logger.warning("Supabase QnA insert error: #{inspect(reason)}")
          {:error, :insert_failed}
      end
    end
  end

  def upvote_qna(_presentation_id, question_id) do
    with {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
      # Get current upvotes
      case Req.get(
        url: "#{base_url}#{@supabase_rest}/qna_questions",
        params: %{id: "eq.#{question_id}", select: "upvotes,slide_id"},
        headers: headers(api_key),
        receive_timeout: 10_000
      ) do
        {:ok, %{status: 200, body: [q | _]}} ->
          new_count = (q["upvotes"] || 0) + 1

          Req.patch(
            url: "#{base_url}#{@supabase_rest}/qna_questions",
            params: %{id: "eq.#{question_id}"},
            json: %{upvotes: new_count},
            headers: headers(api_key),
            receive_timeout: 10_000
          )

          get_qna_questions(q["slide_id"])

        _ ->
          {:error, :not_found}
      end
    end
  end

  def end_presentation(presentation_id) do
    with {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
      Req.patch(
        url: "#{base_url}#{@supabase_rest}/presentations",
        params: %{id: "eq.#{presentation_id}"},
        json: %{status: "finished", finished_at: DateTime.utc_now() |> DateTime.to_iso8601()},
        headers: headers(api_key),
        receive_timeout: 10_000
      )

      {:ok, :ended}
    end
  end

  # Private helpers

  defp update_slide_index(presentation_id, new_index) do
    with {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
      case Req.patch(
        url: "#{base_url}#{@supabase_rest}/presentations",
        params: %{id: "eq.#{presentation_id}"},
        json: %{current_slide_index: new_index},
        headers: headers(api_key),
        receive_timeout: 10_000
      ) do
        {:ok, %{status: 200}} ->
          get_snapshot(presentation_id)

        {:ok, %{status: status, body: body}} ->
          Logger.warning("Supabase slide update failed #{status}: #{inspect(body)}")
          {:error, :update_failed}

        {:error, reason} ->
          Logger.warning("Supabase slide update error: #{inspect(reason)}")
          {:error, :update_failed}
      end
    end
  end

  defp get_slide_responses(slide_id) do
    with {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
      case Req.get(
        url: "#{base_url}#{@supabase_rest}/slide_responses",
        params: %{slide_id: "eq.#{slide_id}", select: "*", order: "created_at.desc"},
        headers: headers(api_key),
        receive_timeout: 10_000
      ) do
        {:ok, %{status: 200, body: responses}} ->
          {:ok, responses}

        _ ->
          {:ok, []}
      end
    end
  end

  defp get_qna_questions(slide_id) do
    with {:ok, base_url} <- fetch_env(:supabase_url),
         {:ok, api_key} <- fetch_env(:supabase_service_role_key) do
      case Req.get(
        url: "#{base_url}#{@supabase_rest}/qna_questions",
        params: %{slide_id: "eq.#{slide_id}", select: "*", order: "upvotes.desc"},
        headers: headers(api_key),
        receive_timeout: 10_000
      ) do
        {:ok, %{status: 200, body: questions}} ->
          {:ok, questions}

        _ ->
          {:ok, []}
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
      {"accept", "application/json"}
    ]
  end
end
