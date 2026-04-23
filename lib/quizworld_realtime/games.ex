defmodule QuizworldRealtime.Games do
  alias QuizworldRealtime.GameServer
  alias QuizworldRealtime.Pin

  def create_session(attrs) do
    attrs
    |> with_pin()
    |> create_session_with_pin(6)
  end

  def snapshot(pin) do
    pin = sanitize_pin(pin)

    case safe_call(fn -> GameServer.snapshot(pin) end) do
      {:error, reason} -> {:error, reason}
      snapshot -> {:ok, snapshot}
    end
  end

  def join_player(pin, player) do
    pin = sanitize_pin(pin)
    transition(pin, fn -> GameServer.join_player(pin, player) end)
  end

  def start_game(pin, host_token) do
    pin = sanitize_pin(pin)
    transition(pin, fn -> GameServer.start_game(pin, host_token) end)
  end

  def submit_answer(pin, player_id, player_token, answer_id, response_time_ms) do
    pin = sanitize_pin(pin)

    transition(pin, fn ->
      GameServer.submit_answer(pin, player_id, player_token, answer_id, response_time_ms)
    end)
  end

  def reveal_current_question(pin, host_token) do
    pin = sanitize_pin(pin)
    transition(pin, fn -> GameServer.reveal_current_question(pin, host_token) end)
  end

  def advance(pin, host_token) do
    pin = sanitize_pin(pin)
    transition(pin, fn -> GameServer.advance(pin, host_token) end)
  end

  def reconnect_player(pin, player_id, player_token) do
    pin = sanitize_pin(pin)
    safe_call(fn -> GameServer.reconnect_player(pin, player_id, player_token) end)
  end

  defp transition(pin, callback) do
    with result <- safe_call(callback) do
      normalize_transition(pin, result)
    end
  end

  defp normalize_transition(pin, {:ok, snapshot}) do
    Phoenix.PubSub.broadcast(
      QuizworldRealtime.PubSub,
      topic(pin),
      {:session_updated, snapshot}
    )

    {:ok, snapshot}
  end

  defp normalize_transition(pin, {:ok, snapshot, player_token}) do
    Phoenix.PubSub.broadcast(
      QuizworldRealtime.PubSub,
      topic(pin),
      {:session_updated, snapshot}
    )

    {:ok, snapshot, player_token}
  end

  defp normalize_transition(pin, {:ok, snapshot, player_token, player_id}) do
    Phoenix.PubSub.broadcast(
      QuizworldRealtime.PubSub,
      topic(pin),
      {:session_updated, snapshot}
    )

    {:ok, snapshot, player_token, player_id}
  end

  defp normalize_transition(_pin, {:error, reason}), do: {:error, reason}

  defp broadcast(pin) do
    with {:ok, snapshot} <- snapshot(pin) do
      Phoenix.PubSub.broadcast(
        QuizworldRealtime.PubSub,
        topic(pin),
        {:session_updated, snapshot}
      )

      {:ok, snapshot}
    end
  end

  @pubsub_topic_max_length 48

  def topic(pin) do
    sanitized =
      pin
      |> sanitize_pin()
      |> String.slice(0, @pubsub_topic_max_length - 5)

    "game:" <> sanitized
  end

  def sanitize_pin(pin) do
    pin
    |> to_string()
    |> String.replace(~r/[:*\s]/, "")
    |> String.slice(0, 20)
    |> String.upcase()
  end

  defp safe_call(callback) do
    callback.()
  catch
    :exit, _ -> {:error, :not_found}
  end

  defp create_session_with_pin(_attrs, 0), do: {:error, :session_exists}

  defp create_session_with_pin(attrs, attempts_remaining) do
    pin = Map.fetch!(attrs, "pin")

    case DynamicSupervisor.start_child(
           QuizworldRealtime.GameSupervisor,
           {GameServer, attrs}
         ) do
      {:ok, _pid} ->
        with {:ok, snapshot} <- broadcast(pin),
             host_token when is_binary(host_token) <-
               safe_call(fn -> GameServer.host_token(pin) end) do
          {:ok, snapshot, host_token}
        else
          {:error, reason} -> {:error, reason}
          _ -> {:error, :not_found}
        end

      {:error, {:already_started, _pid}} ->
        retry_or_fail(attrs, attempts_remaining)

      {:error, {:already_present, _pid}} ->
        retry_or_fail(attrs, attempts_remaining)

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp retry_or_fail(attrs, attempts_remaining) do
    if Map.get(attrs, "pin_source") == "server" do
      attrs
      |> Map.put("pin", Pin.generate())
      |> create_session_with_pin(attempts_remaining - 1)
    else
      {:error, :session_exists}
    end
  end

  defp with_pin(attrs) do
    provided_pin =
      attrs
      |> Map.get("pin")
      |> sanitize_pin()

    if provided_pin == "" do
      attrs
      |> Map.put("pin", Pin.generate())
      |> Map.put("pin_source", "server")
    else
      attrs
      |> Map.put("pin", provided_pin)
      |> Map.put("pin_source", "client")
    end
  end
end
