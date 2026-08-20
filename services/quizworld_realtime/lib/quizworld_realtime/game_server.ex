defmodule QuizworldRealtime.GameServer do
  use GenServer, restart: :transient

  alias QuizworldRealtime.Game
  alias QuizworldRealtime.Games
  alias QuizworldRealtime.GameStore

  @waiting_cleanup_ms :timer.hours(2)
  @active_cleanup_ms :timer.hours(1)
  @finished_cleanup_ms :timer.minutes(15)
  # Auto-advance after 15s on reveal if host doesn't respond
  @auto_advance_ms 15_000

  def start_link(attrs) do
    GenServer.start_link(__MODULE__, attrs, name: via(pin_for(attrs)))
  end

  # 2026-08-13: explicit per-call timeouts. The default GenServer.call timeout
  # is 5s — too long for /answer which must return before the client retries,
  # and too short for /start where Redis-backed state hydrate may take longer.
  def snapshot(pin), do: GenServer.call(via(pin), :snapshot, 3_000)
  def host_token(pin), do: GenServer.call(via(pin), :host_token, 1_000)
  def join_player(pin, player), do: GenServer.call(via(pin), {:join_player, player}, 3_000)
  def start_game(pin, host_token), do: GenServer.call(via(pin), {:start_game, host_token}, 5_000)

  def reconnect_player(pin, player_id, player_token),
    do: GenServer.call(via(pin), {:reconnect_player, player_id, player_token}, 3_000)

  # Tight timeout for answer submissions — once a user submits, the client has
  # moved on. If we miss the window, the next REST poll will pick up the answer
  # from the snapshot, and the user sees their answer counted (just delayed).
  def submit_answer(pin, player_id, player_token, answer_id, response_time_ms) do
    GenServer.call(
      via(pin),
      {:submit_answer, player_id, player_token, answer_id, response_time_ms},
      2_000
    )
  end

  def reveal_current_question(pin, host_token) do
    GenServer.call(via(pin), {:reveal_current_question, host_token}, 5_000)
  end

  def advance(pin, host_token) do
    GenServer.call(via(pin), {:advance, host_token}, 5_000)
  end

  def via(pin), do: {:via, Registry, {QuizworldRealtime.GameRegistry, pin}}

  @impl true
  def init(%Game{} = game) do
    restored_game =
      game
      |> restore_expired_question()
      |> schedule_question_timer()
      |> schedule_auto_advance_timer()
      |> schedule_cleanup_timer()

    persist_snapshot(restored_game)
    {:ok, restored_game}
  end

  def init(attrs) do
    instance_id = Map.get(attrs, "instance_id")

    case GameStore.backend().fetch_game(Map.get(attrs, "pin")) do
      {:ok, %Game{instance_id: ^instance_id} = game} when is_binary(instance_id) ->
        init(game)

      _ ->
        if Map.get(attrs, "restore_only", false) do
          {:stop, :not_found}
        else
          game =
            attrs
            |> Game.new()
            |> schedule_cleanup_timer()

          persist_snapshot(game)
          {:ok, game}
        end
    end
  end

  @impl true
  def handle_call(:snapshot, _from, game) do
    {:reply, Game.snapshot(game), game}
  end

  def handle_call(:host_token, _from, game) do
    {:reply, Game.host_token(game), game}
  end

  def handle_call({:join_player, player}, _from, game) do
    reply_with_transition(Game.join_player(game, player), game)
  end

  def handle_call({:start_game, host_token}, _from, game) do
    reply_with_transition(Game.start(game, host_token), game)
  end

  def handle_call(
        {:submit_answer, player_id, player_token, answer_id, response_time_ms},
        _from,
        game
      ) do
    result =
      case Game.submit_answer(game, player_id, player_token, answer_id, response_time_ms) do
        {:ok, answered_game} ->
          maybe_reveal_completed_round(answered_game)

        {:error, reason} ->
          {:error, reason}
      end

    reply_with_transition(result, game)
  end

  def handle_call({:reveal_current_question, host_token}, _from, game) do
    reply_with_transition(Game.reveal_current_question(game, host_token), game)
  end

  def handle_call({:advance, host_token}, _from, game) do
    reply_with_transition(Game.advance(game, host_token), game)
  end

  def handle_call({:reconnect_player, player_id, player_token}, _from, game) do
    case Game.reconnect_player(game, player_id, player_token) do
      {:ok, snapshot} -> {:reply, {:ok, snapshot}, game}
      {:error, reason} -> {:reply, {:error, reason}, game}
    end
  end

  @impl true
  # Question timer fired — auto-reveal
  def handle_info({:question_timeout, question_index}, game) do
    if game.status == "active" and game.current_question_index == question_index do
      case Game.reveal_current_question(game, Game.host_token(game)) do
        {:ok, next_game} ->
          next_game
          |> prepare_next_game(game)
          |> noreply_transition()

        {:error, _reason} ->
          {:noreply, game}
      end
    else
      {:noreply, game}
    end
  end

  # Auto-advance timer fired after reveal — prevents game freeze if host disconnects
  def handle_info({:auto_advance, question_index}, game) do
    if game.status == "reveal" and game.current_question_index == question_index do
      case Game.advance(game, Game.host_token(game)) do
        {:ok, next_game} ->
          next_game
          |> prepare_next_game(game)
          |> noreply_transition()

        {:error, _reason} ->
          {:noreply, game}
      end
    else
      {:noreply, game}
    end
  end

  @impl true
  def handle_info(:session_cleanup, game) do
    GameStore.backend().delete_snapshot(game.pin)
    {:stop, :normal, game}
  end

  @impl true
  def terminate(_reason, game) do
    cancel_timer(game.question_timer_ref)
    cancel_timer(game.cleanup_timer_ref)
    :ok
  end

  defp maybe_reveal_completed_round(game) do
    question = Enum.at(game.questions, game.current_question_index)
    question_answers = if question, do: Map.get(game.answers, question["id"], %{}), else: %{}

    eligible_player_count =
      if game.game_mode == "survival" do
        map_size(game.players) - MapSet.size(game.eliminated)
      else
        map_size(game.players)
      end

    if eligible_player_count > 0 and map_size(question_answers) >= eligible_player_count do
      Game.reveal_current_question(game, Game.host_token(game))
    else
      {:ok, game}
    end
  end

  defp reply_with_transition({:ok, next_game}, current_game) do
    next_game = prepare_next_game(next_game, current_game)
    snapshot = persist_snapshot(next_game)
    sync_finished_game(next_game)
    broadcast_update(next_game, snapshot)
    {:reply, {:ok, snapshot}, next_game}
  end

  defp reply_with_transition({:ok, next_game, player_token}, current_game) do
    next_game = prepare_next_game(next_game, current_game)
    snapshot = persist_snapshot(next_game)
    sync_finished_game(next_game)
    broadcast_update(next_game, snapshot)
    {:reply, {:ok, snapshot, player_token}, next_game}
  end

  defp reply_with_transition({:ok, next_game, player_token, player_id}, current_game) do
    next_game = prepare_next_game(next_game, current_game)
    snapshot = persist_snapshot(next_game)
    sync_finished_game(next_game)
    broadcast_update(next_game, snapshot)
    {:reply, {:ok, snapshot, player_token, player_id}, next_game}
  end

  defp reply_with_transition({:error, reason}, game) do
    {:reply, {:error, reason}, game}
  end

  # 2026-08-13: Switched from `Task.start/1` (fire-and-forget) to supervised task.
  # Failures are now visible; we can later add retries here without restructuring.
  defp sync_finished_game(%Game{status: "finished"} = game) do
    Task.Supervisor.start_child(
      QuizworldRealtime.TaskSupervisor,
      fn -> QuizworldRealtime.ResultSync.persist_finished_game(game) end
    )
  end

  defp sync_finished_game(_game), do: :ok

  defp broadcast_update(game, snapshot) do
    Phoenix.PubSub.broadcast(
      QuizworldRealtime.PubSub,
      Games.topic(game.pin),
      {:session_updated, snapshot}
    )
  end

  defp noreply_transition(next_game) do
    snapshot = persist_snapshot(next_game)
    sync_finished_game(next_game)

    Phoenix.PubSub.broadcast(
      QuizworldRealtime.PubSub,
      Games.topic(next_game.pin),
      {:session_updated, snapshot}
    )

    {:noreply, next_game}
  end

  defp persist_snapshot(game) do
    snapshot = Game.snapshot(game)
    GameStore.backend().persist_game(game)
    snapshot
  end

  defp pin_for(%Game{pin: pin}), do: pin
  defp pin_for(attrs), do: attrs["pin"]

  defp prepare_next_game(next_game, current_game) do
    cancel_timer(Map.get(current_game, :question_timer_ref))
    cancel_timer(Map.get(current_game, :cleanup_timer_ref))

    next_game
    |> schedule_question_timer()
    |> schedule_auto_advance_timer()
    |> schedule_cleanup_timer()
  end

  # A restored game keeps its original question_started_at. Schedule only the
  # remaining window, not a fresh full timer; otherwise a server restart lets
  # late answers through while the browser countdown is already at zero.
  defp restore_expired_question(%Game{status: "active", current_question_index: index} = game) do
    case Enum.at(game.questions, index) do
      nil ->
        game

      question ->
        if remaining_question_time_ms(game, question) == 0 do
          case Game.reveal_current_question(game, Game.host_token(game)) do
            {:ok, revealed_game} -> revealed_game
            {:error, _reason} -> game
          end
        else
          game
        end
    end
  end

  defp restore_expired_question(%Game{} = game), do: game

  defp remaining_question_time_ms(game, question) do
    total_ms = max(Map.get(question, "time_limit", 20), 1) * 1000

    elapsed_ms =
      case game.question_started_at do
        %DateTime{} = started_at -> max(DateTime.diff(DateTime.utc_now(), started_at, :millisecond), 0)
        _ -> 0
      end

    max(total_ms - elapsed_ms, 0)
  end

  defp schedule_question_timer(%Game{status: "active", current_question_index: index} = game) do
    question = Enum.at(game.questions, index)

    if question do
      timeout_ms = remaining_question_time_ms(game, question)
      timer_ref = Process.send_after(self(), {:question_timeout, index}, timeout_ms)
      Game.with_question_timer_ref(game, timer_ref)
    else
      Game.with_question_timer_ref(game, nil)
    end
  end

  defp schedule_question_timer(%Game{} = game) do
    Game.with_question_timer_ref(game, nil)
  end

  # Schedule auto-advance: fires @auto_advance_ms after reveal
  # Prevents game from freezing if host disconnects mid-game
  defp schedule_auto_advance_timer(%Game{status: "reveal", current_question_index: index} = game) do
    timer_ref = Process.send_after(self(), {:auto_advance, index}, @auto_advance_ms)
    %{game | question_timer_ref: timer_ref}
  end

  defp schedule_auto_advance_timer(%Game{} = game), do: game

  defp schedule_cleanup_timer(%Game{status: status} = game) do
    timeout_ms =
      case status do
        "finished" -> @finished_cleanup_ms
        "active" -> @active_cleanup_ms
        "reveal" -> @active_cleanup_ms
        _ -> @waiting_cleanup_ms
      end

    timer_ref = Process.send_after(self(), :session_cleanup, timeout_ms)
    Game.with_cleanup_timer_ref(game, timer_ref)
  end

  defp cancel_timer(nil), do: :ok

  defp cancel_timer(timer_ref) do
    _ = Process.cancel_timer(timer_ref)
    :ok
  end
end
