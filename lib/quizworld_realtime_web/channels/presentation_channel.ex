defmodule QuizworldRealtimeWeb.PresentationChannel do
  use QuizworldRealtimeWeb, :channel

  alias QuizworldRealtime.Presentations

  @impl true
  def join("presentation:" <> presentation_id, _payload, socket) do
    case Presentations.get_snapshot(presentation_id) do
      {:ok, snapshot} ->
        {:ok, %{presentation: snapshot}, assign(socket, :presentation_id, presentation_id)}

      {:error, _reason} ->
        {:error, %{reason: "presentation_not_found"}}
    end
  end

  @impl true
  def handle_in("slide:next", _payload, socket) do
    presentation_id = socket.assigns.presentation_id

    case Presentations.next_slide(presentation_id) do
      {:ok, snapshot} ->
        broadcast!(socket, "slide:changed", %{presentation: snapshot})
        {:reply, :ok, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: to_string(reason)}}, socket}
    end
  end

  def handle_in("slide:prev", _payload, socket) do
    presentation_id = socket.assigns.presentation_id

    case Presentations.prev_slide(presentation_id) do
      {:ok, snapshot} ->
        broadcast!(socket, "slide:changed", %{presentation: snapshot})
        {:reply, :ok, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: to_string(reason)}}, socket}
    end
  end

  def handle_in("slide:goto", %{"index" => index}, socket) do
    presentation_id = socket.assigns.presentation_id

    case Presentations.goto_slide(presentation_id, index) do
      {:ok, snapshot} ->
        broadcast!(socket, "slide:changed", %{presentation: snapshot})
        {:reply, :ok, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: to_string(reason)}}, socket}
    end
  end

  def handle_in("response:submit", payload, socket) do
    presentation_id = socket.assigns.presentation_id

    case Presentations.submit_response(presentation_id, payload) do
      {:ok, responses} ->
        broadcast!(socket, "response:new", %{
          slide_id: payload["slide_id"],
          responses: responses
        })
        {:reply, :ok, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: to_string(reason)}}, socket}
    end
  end

  def handle_in("qna:submit", payload, socket) do
    presentation_id = socket.assigns.presentation_id

    case Presentations.submit_qna(presentation_id, payload) do
      {:ok, questions} ->
        broadcast!(socket, "qna:new", %{
          slide_id: payload["slide_id"],
          questions: questions
        })
        {:reply, :ok, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: to_string(reason)}}, socket}
    end
  end

  def handle_in("qna:upvote", %{"question_id" => question_id, "slide_id" => slide_id}, socket) do
    presentation_id = socket.assigns.presentation_id

    case Presentations.upvote_qna(presentation_id, question_id) do
      {:ok, questions} ->
        broadcast!(socket, "qna:updated", %{
          slide_id: slide_id,
          questions: questions
        })
        {:reply, :ok, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: to_string(reason)}}, socket}
    end
  end

  def handle_in("presentation:end", _payload, socket) do
    presentation_id = socket.assigns.presentation_id

    case Presentations.end_presentation(presentation_id) do
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
end
