defmodule QuizworldRealtime.Games do
  alias QuizworldRealtime.Game
  alias QuizworldRealtime.GameServer
  alias QuizworldRealtime.GameStore
  alias QuizworldRealtime.Pin

  def create_session(attrs) do
    attrs
    |> with_pin()
    |> create_session_with_pin(6)
  end

  def snapshot(pin) do
    case call_or_restore(pin, fn -> GameServer.snapshot(pin) end) do
      {:error, reason} -> {:error, reason}
      snapshot -> {:ok, snapshot}
    end
  end

  def authorized_snapshot(pin, credentials) do
    with {:ok, role} <- call_or_restore(pin, fn -> GameServer.authorize(pin, credentials) end),
         snapshot <- call_or_restore(pin, fn -> GameServer.snapshot(pin, role) end) do
      {:ok, snapshot, role}
    end
  end

  def snapshot_for_role(pin, role) do
    case call_or_restore(pin, fn -> GameServer.snapshot(pin, role) end) do
      {:error, reason} -> {:error, reason}
      snapshot -> {:ok, snapshot}
    end
  end

  def join_player(pin, player) do
    transition(pin, fn -> GameServer.join_player(pin, player) end)
  end

  def start_game(pin, host_token) do
    transition(pin, fn -> GameServer.start_game(pin, host_token) end)
  end

  def submit_answer(pin, player_id, player_token, answer_id, response_time_ms) do
    transition(pin, fn ->
      GameServer.submit_answer(pin, player_id, player_token, answer_id, response_time_ms)
    end)
  end

  def reveal_current_question(pin, host_token) do
    transition(pin, fn -> GameServer.reveal_current_question(pin, host_token) end)
  end

  def advance(pin, host_token) do
    transition(pin, fn -> GameServer.advance(pin, host_token) end)
  end

  def reconnect_player(pin, player_id, player_token) do
    case call_or_restore(pin, fn -> GameServer.reconnect_player(pin, player_id, player_token) end) do
      {:ok, snapshot} -> {:ok, snapshot}
      {:error, reason} -> {:error, reason}
    end
  end

  def ready_player(pin, player_id, player_token) do
    transition(pin, fn -> GameServer.ready_player(pin, player_id, player_token) end)
  end

  defp transition(pin, callback) do
    with result <- call_or_restore(pin, callback) do
      normalize_transition(result)
    end
  end

  defp normalize_transition({:ok, snapshot}), do: {:ok, snapshot}
  defp normalize_transition({:ok, snapshot, player_token}), do: {:ok, snapshot, player_token}

  defp normalize_transition({:ok, snapshot, player_token, player_id}),
    do: {:ok, snapshot, player_token, player_id}

  defp normalize_transition({:error, reason}), do: {:error, reason}

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
      |> to_string()
      |> String.replace(~r/[:*\s]/, "")
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

  defp call_or_restore(pin, callback) do
    case safe_call(callback) do
      {:error, :not_found} ->
        with :ok <- restore_from_store(pin) do
          safe_call(callback)
        end

      result ->
        result
    end
  end

  defp restore_from_store(pin) do
    with {:ok, stored_game} <- GameStore.backend().fetch_game(pin) do
      game = ensure_instance_id(stored_game)
      :ok = GameStore.backend().persist_game(game)

      recovery_ref = %{
        "pin" => game.pin,
        "instance_id" => game.instance_id,
        "restore_only" => true
      }

      case DynamicSupervisor.start_child(
             QuizworldRealtime.GameSupervisor,
             {GameServer, recovery_ref}
           ) do
        {:ok, _pid} -> :ok
        {:error, {:already_started, _pid}} -> :ok
        {:error, {:already_present, _pid}} -> :ok
        _ -> {:error, :not_found}
      end
    end
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
      |> to_string()
      |> String.trim()
      |> String.upcase()

    attrs =
      if provided_pin == "" do
        attrs
        |> Map.put("pin", Pin.generate())
        |> Map.put("pin_source", "server")
      else
        attrs
        |> Map.put("pin", provided_pin)
        |> Map.put("pin_source", "client")
      end

    Map.put(attrs, "instance_id", instance_id())
  end

  defp instance_id do
    16 |> :crypto.strong_rand_bytes() |> Base.url_encode64(padding: false)
  end

  defp ensure_instance_id(%Game{instance_id: instance_id} = game)
       when is_binary(instance_id),
       do: game

  defp ensure_instance_id(%Game{} = game), do: Map.put(game, :instance_id, instance_id())
end
