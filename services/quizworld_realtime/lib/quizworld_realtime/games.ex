defmodule QuizworldRealtime.Games do
  alias QuizworldRealtime.Game
  alias QuizworldRealtime.GameServer
  alias QuizworldRealtime.GameStore
  alias QuizworldRealtime.Pin

  def create_session(attrs) do
    with :ok <- validate_host_player(Map.get(attrs, "host_player")) do
      attrs
      |> with_pin()
      |> create_session_with_pin(6)
    end
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
    with host_snapshot <- call_or_restore(pin, fn -> GameServer.snapshot(pin, :host) end),
         true <- is_map(host_snapshot) do
      public_snapshot = Game.snapshot_for_role(host_snapshot, :public)

      Phoenix.PubSub.broadcast(
        QuizworldRealtime.PubSub,
        topic(pin),
        {:session_updated, public_snapshot}
      )

      Phoenix.PubSub.broadcast(
        QuizworldRealtime.PubSub,
        host_topic(pin),
        {:host_session_updated, host_snapshot}
      )

      {:ok, public_snapshot}
    else
      _ -> {:error, :not_found}
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

  def host_topic(pin), do: topic(pin) <> ":host"

  def player_topic(pin, player_id) do
    sanitized_player_id =
      player_id
      |> to_string()
      |> String.replace(~r/[:*\s]/, "")
      |> String.slice(0, 64)

    topic(pin) <> ":player:" <> sanitized_player_id
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
          create_host_player_if_requested(
            pin,
            snapshot,
            host_token,
            Map.get(attrs, "host_player")
          )
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

  defp validate_host_player(nil), do: :ok

  defp validate_host_player(%{} = host_player) do
    case Map.get(host_player, "nickname") do
      nickname when is_binary(nickname) ->
        if String.trim(nickname) == "", do: {:error, :invalid_player}, else: :ok

      _ ->
        {:error, :invalid_player}
    end
  end

  defp validate_host_player(_host_player), do: {:error, :invalid_player}

  defp create_host_player_if_requested(_pin, snapshot, host_token, nil),
    do: {:ok, snapshot, host_token}

  defp create_host_player_if_requested(pin, _snapshot, host_token, host_player)
       when is_map(host_player) do
    with {:ok, _player_snapshot, player_token, player_id} <- join_player(pin, host_player),
         {:ok, host_snapshot} <- snapshot(pin) do
      {:ok, host_snapshot, host_token, player_token, player_id}
    end
  end

  defp create_host_player_if_requested(_pin, _snapshot, _host_token, _host_player),
    do: {:error, :invalid_player}

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
