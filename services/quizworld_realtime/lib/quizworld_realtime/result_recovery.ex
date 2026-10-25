defmodule QuizworldRealtime.ResultRecovery do
  @moduledoc "Retries the Redis result outbox at boot and periodically, without client traffic."
  use GenServer
  require Logger
  alias QuizworldRealtime.{GameStore, StateStore, ResultSync}

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: Keyword.get(opts, :name, __MODULE__))
  end

  @impl true
  def init(opts) do
    state = %{
      task: nil,
      legacy_cursor: "0",
      pending_cursor: "0",
      interval: Keyword.get(opts, :interval, 30_000),
      enabled: Keyword.get(opts, :enabled, GameStore.backend() == StateStore),
      sync_module: Keyword.get(opts, :sync_module, ResultSync)
    }

    send(self(), :recover)
    {:ok, state}
  end

  @impl true
  def handle_info(:recover, %{task: nil, enabled: true} = state) do
    task =
      Task.Supervisor.async_nolink(QuizworldRealtime.TaskSupervisor, fn ->
        recover_batch(state)
      end)

    {:noreply, %{state | task: task}}
  end

  def handle_info(:recover, %{task: nil} = state) do
    Process.send_after(self(), :recover, state.interval)
    {:noreply, state}
  end

  def handle_info(:recover, state), do: {:noreply, state}

  def handle_info({ref, result}, %{task: %{ref: ref}} = state) do
    Process.demonitor(ref, [:flush])

    next =
      case result do
        {:ok, legacy, pending} ->
          %{state | legacy_cursor: legacy, pending_cursor: pending}

        {:error, reason} ->
          Logger.warning("Result recovery scan failed; will retry: #{inspect(reason)}")
          state
      end

    delay =
      if next.legacy_cursor != "0" or next.pending_cursor != "0", do: 100, else: next.interval

    Process.send_after(self(), :recover, delay)
    {:noreply, %{next | task: nil}}
  end

  def handle_info({:DOWN, ref, :process, _, reason}, %{task: %{ref: ref}} = state) do
    Logger.warning("Result recovery task failed; will retry: #{inspect(reason)}")
    Process.send_after(self(), :recover, state.interval)
    {:noreply, %{state | task: nil}}
  end

  @impl true
  def terminate(_, %{task: %Task{} = task}), do: Task.shutdown(task, :brutal_kill)
  def terminate(_, _), do: :ok

  defp recover_batch(state) do
    with {:ok, legacy} <- StateStore.discover_pending(state.legacy_cursor),
         {:ok, [pending, ids]} <- StateStore.pending_batch(state.pending_cursor) do
      QuizworldRealtime.TaskSupervisor
      |> Task.Supervisor.async_stream_nolink(ids, &recover_one(&1, state.sync_module),
        max_concurrency: 4,
        timeout: 60_000,
        on_timeout: :kill_task,
        ordered: false
      )
      |> Enum.each(fn
        {:ok, _} ->
          :ok

        {:exit, reason} ->
          Logger.warning(
            "Result recovery attempt terminated; retaining outbox: #{inspect(reason)}"
          )
      end)

      {:ok, legacy, pending}
    end
  end

  defp recover_one(id, module) do
    result =
      with {:ok, game, payload} <- StateStore.fetch_pending(id),
           :ok <- module.persist_finished_game(game) do
        StateStore.acknowledge_pending(id, game, payload)
      end

    case result do
      :ok ->
        :ok

      {:error, :not_found} ->
        :ok

      {:error, reason} ->
        Logger.warning("Pending result recovery failed; retaining outbox: #{inspect(reason)}")
    end
  rescue
    error ->
      Logger.warning(
        "Pending result recovery raised; retaining outbox: #{Exception.message(error)}"
      )
  catch
    kind, _ -> Logger.warning("Pending result recovery #{kind}; retaining outbox")
  end
end
