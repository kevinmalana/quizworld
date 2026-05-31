defmodule QuizworldRealtime.GameServer do
  use GenServer

  alias QuizworldRealtime.Game
  alias QuizworldRealtime.Games
  alias QuizworldRealtime.StateStore

  @waiting_cleanup_ms :timer.hours(2)
  @active_cleanup_ms :timer.hours(1)
  @finished_cleanup_ms :timer.minutes(15)
  # Auto-advance after 15s on reveal if host doesn't respond
  @auto_advance_ms 15_000

  def start_link(attrs) do
    GenServer.start_link(__MODULE__, attrs, name: via(pin_for(attrs)))
  end

  def snapshot(pin), do: GenServer.call(via(pin), :snapshot)
  def host_token(pin), do: GenServer.call(via(pin), :host_token)
  def join_player(pin, player), do: GenServer.call(via(pin), {:join_player, player})
  def start_game(pin, host_token), do: GenServer.call(via(pin), {:start_game, host_token})

  def reconnect_player(pin, player_id, player_token),
    do: GenServer.call(via(pin), {:reconnect_player, player_id, player_token})

  def submit_answer(pin, player_id, player_token, answer_id, response_time_ms) do
    GenServer.call(
      via(pin),
      {:submit_answer, player_id, player_token, answer_id, response_time_ms}
    )
  end

  def reveal_current_question(pin, host_token) do
    GenServer.call(via(pin), {:reveal_current_question, host_token})
  end

  def advance(pin, host_token) do
    GenServer.call(via(pin), {:advance, host_token})
  end

  def via(pin), do: {:via, Registry, {QuizworldRealtime.GameRegistry, pin}}

  @impl true
  def init(%Game{} = game) do
    restored_game =
      game
      |> schedule_question_timer()
      |> schedule_cleanup_timer()

    persist_snapshot(restored_game)
    {:ok, restored_game}
  end

  def init(attrs) do
    game =
      attrs
      |> Game.new()
      |> schedule_cleanup_timer()

    persist_snapshot(game)
    {:ok, game}
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
    reply_with_transition(
      Game.submit_answer(game, player_id, player_token, answer_id, response_time_ms),
      game
    )
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
    StateStore.delete_snapshot(game.pin)
    {:stop, :normal, game}
  end

  @impl true
  def terminate(_reason, game) do
    cancel_timer(game.question_timer_ref)
    cancel_timer(game.cleanup_timer_ref)
    :ok
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

  defp sync_finished_game(%Game{status: "finished"} = game) do
    Task.start(fn -> QuizworldRealtime.ResultSync.persist_finished_game(game) end)
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
    StateStore.persist_game(game)
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

  defp schedule_question_timer(%Game{status: "active", current_question_index: index} = game) do
    question = Enum.at(game.questions, index)

    if question do
      timeout_ms = max(Map.get(question, "time_limit", 20), 1) * 1000
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
