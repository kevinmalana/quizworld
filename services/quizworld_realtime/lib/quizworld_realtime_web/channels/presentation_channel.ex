defmodule QuizworldRealtimeWeb.PresentationChannel do
  use QuizworldRealtimeWeb, :channel

  alias QuizworldRealtime.Presentations
  alias QuizworldRealtime.PresentationSnapshot
  alias QuizworldRealtime.Presence

  # If presenter disconnects, participants get a notice after this many ms
  @presenter_reconnect_grace_ms 10_000

  @impl true
  def join("presentation:" <> presentation_id, payload, socket) do
    case Presentations.get_snapshot(presentation_id) do
      {:ok, snapshot} ->
        # A token in an unauthenticated WebSocket payload is not proof of
        # presenter access. Validate it before returning an unredacted snapshot.
        role = role_from_payload(presentation_id, payload)

        socket =
          socket
          |> assign(:presentation_id, presentation_id)
          |> assign(:role, role)
          |> assign(:presenter_token, payload["presenter_token"])
          |> assign(:participant_id, payload["participant_id"])
          |> assign(:participant_token, payload["participant_token"])

        # Track presence so participants/presenters know who's connected
        send(self(), {:after_join, payload, role})

        safe_snapshot = PresentationSnapshot.for_role(snapshot, role)
        {:ok, %{presentation: safe_snapshot}, socket}

      {:error, _reason} ->
        {:error, %{reason: "presentation_not_found"}}
    end
  end

  @impl true
  def handle_info({:after_join, payload, role}, socket) do
    identity =
      case role do
        :presenter -> "presenter"
        :participant -> payload["participant_id"] || "participant"
        _ -> "viewer-#{:rand.uniform(99_999)}"
      end

    {:ok, _} =
      Presence.track(socket, identity, %{
        role: to_string(role),
        online_at: DateTime.utc_now() |> DateTime.to_unix()
      })

    push(socket, "presence_state", Presence.list(socket))
    {:noreply, socket}
  end

  # Presence diff — broadcast updated connected list to everyone
  def handle_info(%Phoenix.Socket.Broadcast{event: "presence_diff"}, socket) do
    push(socket, "presence_state", Presence.list(socket))

    # Check if presenter is still connected — if not, warn participants
    connected = Presence.list(socket)

    presenter_online =
      Enum.any?(connected, fn {_id, %{metas: metas}} ->
        Enum.any?(metas, &(&1.role == "presenter"))
      end)

    unless presenter_online do
      send(self(), {:presenter_disconnected, DateTime.utc_now()})
    end

    {:noreply, socket}
  end

  # Presenter disconnected — notify participants after grace period
  def handle_info({:presenter_disconnected, _at}, socket) do
    Process.send_after(self(), :check_presenter_still_gone, @presenter_reconnect_grace_ms)
    {:noreply, socket}
  end

  def handle_info(:check_presenter_still_gone, socket) do
    connected = Presence.list(socket)

    presenter_online =
      Enum.any?(connected, fn {_id, %{metas: metas}} ->
        Enum.any?(metas, &(&1.role == "presenter"))
      end)

    unless presenter_online do
      broadcast!(socket, "presenter:disconnected", %{
        message: "The presenter has disconnected. Waiting for them to reconnect..."
      })
    end

    {:noreply, socket}
  end

  @impl true
  def handle_info({:presentation_updated, snapshot}, socket) do
    role = socket.assigns[:role] || :viewer

    push(socket, "presentation:update", %{
      presentation: PresentationSnapshot.for_role(snapshot, role)
    })

    {:noreply, socket}
  end

  @impl true
  def handle_in("slide:next", payload, socket) do
    transition(
      socket,
      fn ->
        Presentations.next_slide(socket.assigns.presentation_id, presenter_token(socket, payload))
      end,
      :slide
    )
  end

  def handle_in("slide:prev", payload, socket) do
    transition(
      socket,
      fn ->
        Presentations.prev_slide(socket.assigns.presentation_id, presenter_token(socket, payload))
      end,
      :slide
    )
  end

  def handle_in("slide:goto", %{"index" => index} = payload, socket) do
    transition(
      socket,
      fn ->
        Presentations.goto_slide(
          socket.assigns.presentation_id,
          index,
          presenter_token(socket, payload)
        )
      end,
      :slide
    )
  end

  def handle_in("response:submit", payload, socket) do
    presentation_id = socket.assigns.presentation_id
    payload = with_participant(socket, payload)

    case Presentations.submit_response(presentation_id, payload) do
      {:ok, _responses} ->
        case Presentations.public_slide_activity(presentation_id, payload["slide_id"]) do
          {:ok, public} ->
            broadcast!(socket, "activity:update", Map.put(public, :slide_id, payload["slide_id"]))
            {:reply, {:ok, %{own_submission: payload["response_data"], activity: public}}, socket}

          {:error, reason} ->
            {:reply, {:error, %{reason: to_string(reason)}}, socket}
        end

      {:error, reason} ->
        {:reply, {:error, %{reason: to_string(reason)}}, socket}
    end
  end

  def handle_in("qna:submit", payload, socket) do
    presentation_id = socket.assigns.presentation_id
    payload = with_participant(socket, payload)

    case Presentations.submit_qna(presentation_id, payload) do
      {:ok, _questions} ->
        case Presentations.public_slide_activity(presentation_id, payload["slide_id"]) do
          {:ok, public} ->
            broadcast!(socket, "activity:update", Map.put(public, :slide_id, payload["slide_id"]))
            {:reply, {:ok, %{activity: public}}, socket}

          {:error, reason} ->
            {:reply, {:error, %{reason: to_string(reason)}}, socket}
        end

      {:error, reason} ->
        {:reply, {:error, %{reason: to_string(reason)}}, socket}
    end
  end

  def handle_in(
        "qna:upvote",
        %{"question_id" => question_id} = payload,
        socket
      ) do
    presentation_id = socket.assigns.presentation_id
    payload = with_participant(socket, payload)

    case Presentations.upvote_qna(
           presentation_id,
           question_id,
           payload["participant_id"],
           payload["participant_token"]
         ) do
      {:ok, slide_id, _questions} ->
        case Presentations.public_slide_activity(presentation_id, slide_id) do
          {:ok, public} ->
            broadcast!(socket, "activity:update", Map.put(public, :slide_id, slide_id))
            {:reply, {:ok, %{activity: public}}, socket}

          {:error, reason} ->
            {:reply, {:error, %{reason: to_string(reason)}}, socket}
        end

      {:error, reason} ->
        {:reply, {:error, %{reason: to_string(reason)}}, socket}
    end
  end

  def handle_in("results:visibility", %{"hidden" => hidden} = payload, socket)
      when is_boolean(hidden) do
    presentation_id = socket.assigns.presentation_id

    case Presentations.set_results_hidden(
           presentation_id,
           hidden,
           presenter_token(socket, payload)
         ) do
      {:ok, snapshot} ->
        broadcast_from!(socket, "presentation:update", %{
          presentation: PresentationSnapshot.for_audience(snapshot)
        })

        push(socket, "presentation:update", %{presentation: snapshot})
        {:reply, :ok, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: to_string(reason)}}, socket}
    end
  end

  def handle_in("quiz:reveal", payload, socket) do
    slide_id = payload["slide_id"]

    case Presentations.reveal_quiz(
           socket.assigns.presentation_id,
           slide_id,
           presenter_token(socket, payload)
         ) do
      {:ok, _snapshot, correct_answers} ->
        broadcast!(socket, "quiz:revealed", %{
          slide_id: slide_id,
          correct_answers: correct_answers
        })

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

  defp transition(socket, callback, :slide) do
    case callback.() do
      {:ok, snapshot} ->
        role = socket.assigns[:role] || :viewer
        safe_snapshot = PresentationSnapshot.for_role(snapshot, role)

        broadcast_from!(socket, "slide:changed", %{
          presentation: PresentationSnapshot.for_audience(snapshot)
        })

        push(socket, "slide:changed", %{presentation: safe_snapshot})
        {:reply, :ok, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: to_string(reason)}}, socket}
    end
  end

  defp presenter_token(socket, _payload),
    do: socket.assigns[:presenter_token]

  defp with_participant(socket, payload) do
    payload
    |> Map.put("participant_id", socket.assigns[:participant_id])
    |> Map.put("participant_token", socket.assigns[:participant_token])
  end

  defp role_from_payload(presentation_id, %{"presenter_token" => token}) when is_binary(token) do
    if Presentations.presenter_authorized?(presentation_id, token), do: :presenter, else: :viewer
  end

  defp role_from_payload(presentation_id, %{"participant_token" => token, "participant_id" => id})
       when is_binary(token) and is_binary(id) do
    if Presentations.participant_authorized?(presentation_id, id, token),
      do: :participant,
      else: :viewer
  end

  defp role_from_payload(_presentation_id, _payload), do: :viewer
end
