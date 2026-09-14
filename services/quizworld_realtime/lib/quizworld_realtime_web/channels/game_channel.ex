defmodule QuizworldRealtimeWeb.GameChannel do
  use QuizworldRealtimeWeb, :channel

  alias QuizworldRealtime.Games
  alias QuizworldRealtime.Presence

  intercept(["presence_diff"])

  @impl true
  def join("game:" <> pin, payload, socket) do
    case Games.authorized_snapshot(pin, payload) do
      {:ok, snapshot, role} ->
        subscribe_to_role_updates(pin, role)

        # Track presence so host can see real connected count
        send(self(), {:after_join, payload})

        {:ok, %{session: snapshot},
         socket
         |> assign(:pin, pin)
         |> assign(:role, role)
         |> assign(:game_instance_id, snapshot.game_instance_id)
         |> assign(:credentials, Map.take(payload, ["host_token", "player_id", "player_token"]))}

      {:error, _reason} ->
        {:error, %{reason: "session_not_found"}}
    end
  end

  @impl true
  def handle_info({:after_join, payload}, socket) do
    _pin = socket.assigns.pin
    player_id = Map.get(payload, "player_id", "spectator")
    nickname = Map.get(payload, "nickname", "")

    {:ok, _} =
      Presence.track(socket, player_id, %{
        nickname: nickname,
        online_at: DateTime.utc_now() |> DateTime.to_unix()
      })

    push(socket, "presence_state", Presence.list(socket))
    {:noreply, socket}
  end

  @impl true
  def handle_info({event, snapshot}, socket)
      when event in [:session_updated, :host_session_updated, :player_session_updated] and
             (not is_map_key(snapshot, :game_instance_id) or
                snapshot.game_instance_id != socket.assigns.game_instance_id) do
    # Fence every publication with the atomically authorized instance, including
    # delayed traffic in the initial snapshot/subscription gap and PIN reuse.
    {:stop, :normal, socket}
  end

  def handle_info(
        {:session_updated, _snapshot},
        %{assigns: %{role: role}} = socket
      )
      when role in [:host, :host_player] do
    {:noreply, socket}
  end

  def handle_info(
        {:session_updated, %{status: status}},
        %{assigns: %{role: {:player, _player_id}}} = socket
      )
      when status in ["reveal", "finished"] do
    {:noreply, socket}
  end

  def handle_info({:session_updated, snapshot}, socket) do
    push(socket, "session:update", %{session: snapshot})
    {:noreply, socket}
  end

  @impl true
  def handle_info({:host_session_updated, host_snapshot}, socket) do
    push(socket, "session:update", %{session: host_snapshot})
    {:noreply, socket}
  end

  @impl true
  def handle_info({:player_session_updated, player_snapshot}, socket) do
    push(socket, "session:update", %{session: player_snapshot})
    {:noreply, socket}
  end

  @impl true
  def handle_out("presence_diff", _diff, socket) do
    push(socket, "presence_state", Presence.list(socket))
    {:noreply, socket}
  end

  def handle_out(event, payload, socket) do
    push(socket, event, payload)
    {:noreply, socket}
  end

  @impl true
  def handle_in("player:join", _payload, %{assigns: %{role: {:player, _player_id}}} = socket) do
    {:reply, {:error, %{reason: "already_joined"}}, socket}
  end

  def handle_in("player:join", _payload, %{assigns: %{role: :host_player}} = socket) do
    {:reply, {:error, %{reason: "already_joined"}}, socket}
  end

  def handle_in("player:join", payload, socket) do
    pin = socket.assigns.pin

    result = with {:ok, _} <- reply_snapshot(pin, socket), do: Games.join_player(pin, payload)

    case result do
      {:ok, snapshot, player_token, player_id} ->
        credentials =
          Map.merge(socket.assigns.credentials, %{
            "player_id" => player_id,
            "player_token" => player_token
          })

        next_socket = assign(socket, :credentials, credentials)

        with true <- snapshot.game_instance_id == socket.assigns.game_instance_id,
             {:ok, private_snapshot, role} <- Games.authorized_snapshot(pin, credentials),
             true <- private_snapshot.game_instance_id == socket.assigns.game_instance_id do
          maybe_subscribe_after_join(pin, socket.assigns[:role], role)

          {:reply,
           {:ok, %{session: private_snapshot, player_token: player_token, player_id: player_id}},
           assign(next_socket, :role, role)}
        else
          _ -> {:reply, {:error, %{reason: "session_replaced"}}, socket}
        end

      {:error, :game_full} ->
        {:reply,
         {:error,
          %{
            reason: "game_full",
            message: "This game is full (200 players max). Try another session."
          }}, socket}

      {:error, :nickname_taken} ->
        {:reply,
         {:error,
          %{reason: "nickname_taken", message: "That nickname is already taken. Choose another."}},
         socket}

      {:error, :session_closed} ->
        {:reply,
         {:error,
          %{
            reason: "session_closed",
            message: "This game has already started. Ask the host to start a new session."
          }}, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: to_string(reason)}}, socket}
    end
  end

  def handle_in("host:start", %{"host_token" => host_token}, socket) do
    transition(
      socket.assigns.pin,
      fn -> Games.start_game(socket.assigns.pin, host_token) end,
      socket
    )
  end

  def handle_in("player:answer", payload, socket) do
    transition(
      socket.assigns.pin,
      fn ->
        Games.submit_answer(
          socket.assigns.pin,
          payload["player_id"],
          payload["player_token"],
          payload["answer_id"],
          payload["response_time_ms"] || 0
        )
      end,
      socket
    )
  end

  def handle_in("player:ready", payload, socket) do
    transition(
      socket.assigns.pin,
      fn ->
        Games.ready_player(
          socket.assigns.pin,
          payload["player_id"],
          payload["player_token"]
        )
      end,
      socket
    )
  end

  def handle_in("host:reveal", %{"host_token" => host_token}, socket) do
    transition(
      socket.assigns.pin,
      fn -> Games.reveal_current_question(socket.assigns.pin, host_token) end,
      socket
    )
  end

  def handle_in("host:advance", %{"host_token" => host_token}, socket) do
    transition(
      socket.assigns.pin,
      fn -> Games.advance(socket.assigns.pin, host_token) end,
      socket
    )
  end

  defp transition(pin, callback, socket) do
    case callback.() do
      {:ok, _snapshot} ->
        case reply_snapshot(pin, socket) do
          {:ok, snapshot} -> {:reply, {:ok, %{session: snapshot}}, socket}
          {:error, reason} -> {:reply, {:error, %{reason: to_string(reason)}}, socket}
        end

      {:error, reason} ->
        {:reply, {:error, %{reason: to_string(reason)}}, socket}
    end
  end

  defp subscribe_to_role_updates(pin, role) when role in [:host, :host_player] do
    Phoenix.PubSub.subscribe(QuizworldRealtime.PubSub, Games.host_topic(pin))
  end

  defp subscribe_to_role_updates(pin, {:player, player_id}) do
    Phoenix.PubSub.subscribe(QuizworldRealtime.PubSub, Games.player_topic(pin, player_id))
  end

  defp subscribe_to_role_updates(_pin, _role), do: :ok

  defp maybe_subscribe_after_join(_pin, :host, :host_player), do: :ok

  defp maybe_subscribe_after_join(pin, _previous_role, next_role) do
    subscribe_to_role_updates(pin, next_role)
  end

  defp reply_snapshot(pin, socket) do
    # Cached roles are not credentials. Never fall back to the command's raw
    # (possibly host-shaped) result on reauthorization or instance-fence failure.
    with {:ok, snapshot, _role} <- Games.authorized_snapshot(pin, socket.assigns.credentials),
         true <- snapshot.game_instance_id == socket.assigns.game_instance_id do
      {:ok, snapshot}
    else
      {:error, reason} -> {:error, reason}
      false -> {:error, :session_replaced}
    end
  end
end
