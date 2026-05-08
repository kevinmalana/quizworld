defmodule QuizworldRealtimeWeb.PresentationChannel do
  use QuizworldRealtimeWeb, :channel

  alias QuizworldRealtime.Presentations

  @impl true
  def join("presentation:" <> presentation_id, payload, socket) do
    case Presentations.get_snapshot(presentation_id) do
      {:ok, snapshot} ->
        role = role_from_payload(payload)

        socket =
          socket
          |> assign(:presentation_id, presentation_id)
          |> assign(:role, role)
          |> assign(:presenter_token, payload["presenter_token"])
          |> assign(:participant_id, payload["participant_id"])
          |> assign(:participant_token, payload["participant_token"])

        {:ok, %{presentation: snapshot}, socket}

      {:error, _reason} ->
        {:error, %{reason: "presentation_not_found"}}
    end
  end

  @impl true
  def handle_in("slide:next", payload, socket) do
    transition(socket, fn -> Presentations.next_slide(socket.assigns.presentation_id, presenter_token(socket, payload)) end, :slide)
  end

  def handle_in("slide:prev", payload, socket) do
    transition(socket, fn -> Presentations.prev_slide(socket.assigns.presentation_id, presenter_token(socket, payload)) end, :slide)
  end

  def handle_in("slide:goto", %{"index" => index} = payload, socket) do
    transition(socket, fn -> Presentations.goto_slide(socket.assigns.presentation_id, index, presenter_token(socket, payload)) end, :slide)
  end

  def handle_in("response:submit", payload, socket) do
    presentation_id = socket.assigns.presentation_id
    payload = with_participant(socket, payload)

    case Presentations.submit_response(presentation_id, payload) do
      {:ok, responses} ->
        broadcast!(socket, "response:new", %{slide_id: payload["slide_id"], responses: responses})
        {:reply, :ok, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: to_string(reason)}}, socket}
    end
  end

  def handle_in("qna:submit", payload, socket) do
    presentation_id = socket.assigns.presentation_id
    payload = with_participant(socket, payload)

    case Presentations.submit_qna(presentation_id, payload) do
      {:ok, questions} ->
        broadcast!(socket, "qna:new", %{slide_id: payload["slide_id"], questions: questions})
        {:reply, :ok, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: to_string(reason)}}, socket}
    end
  end

  def handle_in("qna:upvote", %{"question_id" => question_id, "slide_id" => slide_id} = payload, socket) do
    presentation_id = socket.assigns.presentation_id
    payload = with_participant(socket, payload)

    case Presentations.upvote_qna(presentation_id, question_id, payload["participant_id"], payload["participant_token"]) do
      {:ok, questions} ->
        broadcast!(socket, "qna:updated", %{slide_id: slide_id, questions: questions})
        {:reply, :ok, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: to_string(reason)}}, socket}
    end
  end

  def handle_in("presentation:end", payload, socket) do
    presentation_id = socket.assigns.presentation_id

    case Presentations.end_presentation(presentation_id, presenter_token(socket, payload)) do
      {:ok, _} ->
        broadcast!(socket, "presentation:ended", %{})
        {:reply, :ok, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: to_string(reason)}}, socket}
    end
  end

  @impl true
  def handle_info({:presentation_updated, snapshot}, socket) do
    push(socket, "presentation:update", %{presentation: snapshot})
    {:noreply, socket}
  end

  defp transition(socket, callback, :slide) do
    case callback.() do
      {:ok, snapshot} ->
        broadcast!(socket, "slide:changed", %{presentation: snapshot})
        {:reply, :ok, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: to_string(reason)}}, socket}
    end
  end

  defp presenter_token(socket, payload), do: payload["presenter_token"] || socket.assigns[:presenter_token]

  defp with_participant(socket, payload) do
    payload
    |> Map.put_new("participant_id", socket.assigns[:participant_id])
    |> Map.put_new("participant_token", socket.assigns[:participant_token])
  end

  defp role_from_payload(%{"presenter_token" => token}) when is_binary(token), do: :presenter
  defp role_from_payload(%{"participant_token" => token}) when is_binary(token), do: :participant
  defp role_from_payload(_), do: :viewer
end
