defmodule QuizworldRealtime.PresentationStore do
  @moduledoc """
  Redis hot-state cache for live QuizWorld Present sessions.

  Supabase remains durable storage. Redis keeps the live presentation snapshot,
  presenter/participant tokens, slide membership, and current slide activity hot
  so websocket actions and fallback polling avoid repeated Supabase reads.
  """

  @ttl_seconds 21_600

  def put_live_session(presentation_id, presenter_token) do
    pipeline([
      ["SET", presenter_key(presentation_id, presenter_token), "1", "EX", ttl()],
      ["SET", live_key(presentation_id), presenter_token, "EX", ttl()]
    ])
  end

  # 2026-08-13: Returns the presenter_token currently associated with this live
  # presentation session, or :not_live if no live session exists. Used by
  # PresentationChannel.ensure_presenter/2 to verify the calling socket
  # actually has the host token. Previously this function was missing —
  # the channel referenced it but it wasn't defined, which would crash at
  # runtime. The build was warning but not erroring.
  def get_live_session(presentation_id) do
    case command(["GET", live_key(presentation_id)]) do
      {:ok, token} when is_binary(token) -> {:ok, token}
      _ -> {:error, :not_live}
    end
  end

  def presenter_token?(presentation_id, presenter_token) when is_binary(presenter_token) do
    exists?(presenter_key(presentation_id, presenter_token))
  end

  def presenter_token?(_presentation_id, _token), do: false

  def put_participant(
        presentation_id,
        participant_id,
        participant_token,
        participant_name \\ "Anonymous"
      ) do
    payload =
      Jason.encode!(%{
        participant_id: participant_id,
        participant_token: participant_token,
        participant_name: participant_name
      })

    pipeline([
      [
        "SET",
        participant_key(presentation_id, participant_id, participant_token),
        "1",
        "EX",
        ttl()
      ],
      ["SET", participant_id_key(presentation_id, participant_id), payload, "EX", ttl()]
    ])
  end

  def participant_token?(presentation_id, participant_id, participant_token)
      when is_binary(participant_id) and is_binary(participant_token) do
    exists?(participant_key(presentation_id, participant_id, participant_token))
  end

  def participant_token?(_presentation_id, _participant_id, _participant_token), do: false

  def put_snapshot(%{} = snapshot) do
    presentation_id = get_value(snapshot, :id)
    slides = get_value(snapshot, :slides) || []
    slide_ids = Enum.map(slides, &get_value(&1, "id")) |> Enum.reject(&is_nil/1)

    commands =
      [
        ["SET", snapshot_key(presentation_id), Jason.encode!(snapshot), "EX", ttl()]
      ] ++
        Enum.map(slide_ids, fn slide_id ->
          ["SET", slide_key(presentation_id, slide_id), "1", "EX", ttl()]
        end)

    pipeline(commands)
  end

  def fetch_snapshot(presentation_id) do
    with {:ok, payload} when is_binary(payload) <-
           command(["GET", snapshot_key(presentation_id)]),
         {:ok, decoded} <- Jason.decode(payload) do
      {:ok, atomize_snapshot(decoded)}
    else
      _ -> {:error, :not_found}
    end
  end

  def slide_belongs?(presentation_id, slide_id) when is_binary(slide_id) do
    exists?(slide_key(presentation_id, slide_id))
  end

  def slide_belongs?(_presentation_id, _slide_id), do: false

  def put_activity(slide_id, responses, questions) do
    payload = Jason.encode!(%{responses: responses || [], questions: questions || []})
    command(["SET", activity_key(slide_id), payload, "EX", ttl()])
    :ok
  end

  def fetch_activity(slide_id) do
    with {:ok, payload} when is_binary(payload) <- command(["GET", activity_key(slide_id)]),
         {:ok, %{"responses" => responses, "questions" => questions}} <- Jason.decode(payload) do
      {:ok, %{responses: responses || [], questions: questions || []}}
    else
      _ -> {:error, :not_found}
    end
  end

  def delete_presentation(presentation_id) do
    command(["DEL", snapshot_key(presentation_id), live_key(presentation_id)])
    :ok
  end

  defp exists?(key) do
    case command(["EXISTS", key]) do
      {:ok, count} when is_integer(count) and count > 0 -> true
      _ -> false
    end
  end

  defp command(command) do
    case Process.whereis(QuizworldRealtime.Redis) do
      nil -> {:error, :redis_unavailable}
      pid -> Redix.command(pid, command)
    end
  rescue
    _ -> {:error, :redis_unavailable}
  end

  defp pipeline([]), do: :ok

  defp pipeline(commands) do
    case Process.whereis(QuizworldRealtime.Redis) do
      nil ->
        :ok

      pid ->
        Redix.pipeline(pid, commands)
        :ok
    end
  rescue
    _ -> :ok
  end

  defp ttl, do: Integer.to_string(@ttl_seconds)

  defp snapshot_key(id), do: "quizworld:present:" <> to_string(id) <> ":snapshot"
  defp live_key(id), do: "quizworld:present:" <> to_string(id) <> ":live"

  defp presenter_key(id, token),
    do: "quizworld:present:" <> to_string(id) <> ":presenter:" <> token_hash(token)

  defp participant_key(id, participant_id, token),
    do:
      "quizworld:present:" <>
        to_string(id) <> ":participant:" <> token_hash(participant_id <> ":" <> token)

  defp participant_id_key(id, participant_id),
    do: "quizworld:present:" <> to_string(id) <> ":participant_id:" <> token_hash(participant_id)

  defp slide_key(id, slide_id),
    do: "quizworld:present:" <> to_string(id) <> ":slide:" <> to_string(slide_id)

  defp activity_key(slide_id),
    do: "quizworld:present:slide:" <> to_string(slide_id) <> ":activity"

  defp token_hash(value),
    do: :crypto.hash(:sha256, to_string(value)) |> Base.encode16(case: :lower)

  defp get_value(map, key) when is_atom(key),
    do: Map.get(map, key) || Map.get(map, Atom.to_string(key))

  defp get_value(map, key), do: Map.get(map, key)

  defp atomize_snapshot(map) do
    %{
      id: map["id"],
      creator_id: map["creator_id"],
      title: map["title"],
      status: map["status"],
      join_code: map["join_code"],
      current_slide_index: map["current_slide_index"] || 0,
      slides: map["slides"] || [],
      total_slides: map["total_slides"] || length(map["slides"] || [])
    }
  end
end
