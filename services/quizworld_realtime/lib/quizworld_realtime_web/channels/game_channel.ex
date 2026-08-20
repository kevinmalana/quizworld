defmodule QuizworldRealtimeWeb.GameChannel do
  use QuizworldRealtimeWeb, :channel

  alias QuizworldRealtime.Games
  alias QuizworldRealtime.Presence

  @impl true
  def join("game:" <> pin, payload, socket) do
    case Games.snapshot(pin) do
      {:ok, snapshot} ->
        Phoenix.PubSub.subscribe(QuizworldRealtime.PubSub, Games.topic(pin))

        # Track presence so host can see real connected count
        send(self(), {:after_join, payload})

        {:ok, %{session: snapshot}, assign(socket, :pin, pin)}

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
  def handle_info({:session_updated, snapshot}, socket) do
    push(socket, "session:update", %{session: snapshot})
    {:noreply, socket}
  end

  @impl true
  def handle_info({:presence_diff, _diff}, socket) do
    push(socket, "presence_state", Presence.list(socket))
    {:noreply, socket}
  end

  @impl true
  def handle_in("player:join", payload, socket) do
    pin = socket.assigns.pin

    case Games.join_player(pin, payload) do
      {:ok, snapshot, player_token, player_id} ->
        {:reply, {:ok, %{session: snapshot, player_token: player_token, player_id: player_id}},
         socket}

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

  defp transition(_pin, callback, socket) do
    case callback.() do
      {:ok, snapshot} ->
        {:reply, {:ok, %{session: snapshot}}, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: to_string(reason)}}, socket}
    end
  end
end
