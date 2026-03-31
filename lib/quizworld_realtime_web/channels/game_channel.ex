defmodule QuizworldRealtimeWeb.GameChannel do
  use QuizworldRealtimeWeb, :channel

  alias QuizworldRealtime.Games

  @impl true
  def join("game:" <> pin, _payload, socket) do
    case Games.snapshot(pin) do
      {:ok, snapshot} ->
        Phoenix.PubSub.subscribe(QuizworldRealtime.PubSub, Games.topic(pin))
        {:ok, %{session: snapshot}, assign(socket, :pin, pin)}

      {:error, _reason} ->
        {:error, %{reason: "session_not_found"}}
    end
  end

  @impl true
  def handle_in("player:join", payload, socket) do
    pin = socket.assigns.pin

    case Games.join_player(pin, payload) do
      {:ok, snapshot, player_token, player_id} ->
        {:reply, {:ok, %{session: snapshot, player_token: player_token, player_id: player_id}}, socket}

      {:error, reason} -> {:reply, {:error, %{reason: to_string(reason)}}, socket}
    end
  end

  def handle_in("host:start", %{"host_token" => host_token}, socket) do
    transition(socket.assigns.pin, fn -> Games.start_game(socket.assigns.pin, host_token) end, socket)
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

  def handle_in("host:reveal", %{"host_token" => host_token}, socket) do
    transition(socket.assigns.pin, fn -> Games.reveal_current_question(socket.assigns.pin, host_token) end, socket)
  end

  def handle_in("host:advance", %{"host_token" => host_token}, socket) do
    transition(socket.assigns.pin, fn -> Games.advance(socket.assigns.pin, host_token) end, socket)
  end

  @impl true
  def handle_info({:session_updated, snapshot}, socket) do
    push(socket, "session:update", %{session: snapshot})
    {:noreply, socket}
  end

  defp transition(_pin, callback, socket) do
    case callback.() do
      {:ok, snapshot} -> {:reply, {:ok, %{session: snapshot}}, socket}
      {:error, reason} -> {:reply, {:error, %{reason: to_string(reason)}}, socket}
    end
  end
end
