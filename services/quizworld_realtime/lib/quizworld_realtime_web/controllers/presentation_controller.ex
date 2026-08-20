defmodule QuizworldRealtimeWeb.PresentationController do
  use QuizworldRealtimeWeb, :controller

  alias QuizworldRealtime.Auth
  alias QuizworldRealtime.PresentationSnapshot
  alias QuizworldRealtime.Presentations

  def start(conn, %{"id" => presentation_id}) do
    case Auth.authenticate_bearer(conn) do
      {:ok, user_id} ->
        case Presentations.start_live(presentation_id, user_id) do
          {:ok, snapshot, presenter_token} ->
            json(conn, %{presentation: snapshot, presenter_token: presenter_token})

          {:error, reason} ->
            conn |> put_status(status_for(reason)) |> json(%{error: format_error(reason)})
        end

      {:error, :missing_bearer_token} ->
        conn
        |> put_status(:unauthorized)
        |> json(%{error: "Authorization bearer token is required"})

      {:error, :invalid_bearer_token} ->
        conn |> put_status(:unauthorized) |> json(%{error: "Authorization token is invalid"})

      {:error, _reason} ->
        conn
        |> put_status(:unauthorized)
        |> json(%{error: "Authorization token could not be verified"})
    end
  end

  def join(conn, params) do
    join_code = params["join_code"] || params["code"]
    participant_name = params["participant_name"] || params["name"] || "Anonymous"

    if blank?(join_code) do
      conn |> put_status(:unprocessable_entity) |> json(%{error: "join_code is required"})
    else
      case Presentations.join_by_code(join_code, participant_name) do
        {:ok, payload} ->
          json(conn, payload)

        {:error, reason} ->
          conn |> put_status(status_for(reason)) |> json(%{error: format_error(reason)})
      end
    end
  end

  def show(conn, %{"id" => presentation_id} = params) do
    case Presentations.get_snapshot(presentation_id) do
      {:ok, snapshot} ->
        # `presenter_token` arrives in an untrusted query string. Return the
        # answer key only after verifying it belongs to this live presentation.
        safe =
          if Presentations.presenter_authorized?(presentation_id, params["presenter_token"]) do
            snapshot
          else
            PresentationSnapshot.for_audience(snapshot)
          end

        json(conn, %{presentation: safe})

      {:error, reason} ->
        conn |> put_status(status_for(reason)) |> json(%{error: format_error(reason)})
    end
  end

  def activity(conn, %{"id" => presentation_id, "slide_id" => slide_id} = params) do
    auth_payload = Map.take(params, ["presenter_token", "participant_id", "participant_token"])

    case Presentations.slide_activity(presentation_id, slide_id, auth_payload) do
      {:ok, activity} ->
        json(conn, activity)

      {:error, reason} ->
        conn |> put_status(status_for(reason)) |> json(%{error: format_error(reason)})
    end
  end

  defp blank?(value), do: value |> to_string() |> String.trim() == ""

  defp status_for(:not_found), do: :not_found
  defp status_for(:not_host), do: :forbidden
  defp status_for(:not_presenter), do: :forbidden
  defp status_for(:invalid_participant_token), do: :forbidden
  defp status_for(:bad_slide), do: :unprocessable_entity
  defp status_for(_), do: :unprocessable_entity

  defp format_error(:not_found), do: "Presentation not found or not live."
  defp format_error(:not_host), do: "Only the presentation creator can start this deck."
  defp format_error(:not_presenter), do: "Only the presenter can perform this action."
  defp format_error(:invalid_participant_token), do: "Participant session is invalid."
  defp format_error(:bad_slide), do: "Slide does not belong to this presentation."
  defp format_error(:missing_config), do: "Realtime presentation service is not configured."
  defp format_error(reason), do: to_string(reason)
end
