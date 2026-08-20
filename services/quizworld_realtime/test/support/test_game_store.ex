defmodule QuizworldRealtime.TestGameStore do
  @behaviour QuizworldRealtime.GameStore

  def reset do
    ensure_started()
    Agent.update(__MODULE__, fn _games -> %{} end)
  end

  @impl true
  def persist_game(game) do
    ensure_started()
    Agent.update(__MODULE__, &Map.put(&1, game.pin, game))
    :ok
  end

  @impl true
  def fetch_game(pin) do
    ensure_started()

    case Agent.get(__MODULE__, &Map.get(&1, pin)) do
      nil -> {:error, :not_found}
      game -> {:ok, game}
    end
  end

  @impl true
  def delete_snapshot(pin) do
    ensure_started()
    Agent.update(__MODULE__, &Map.delete(&1, pin))
    :ok
  end

  defp ensure_started do
    case Process.whereis(__MODULE__) do
      nil ->
        case Agent.start(fn -> %{} end, name: __MODULE__) do
          {:ok, _pid} -> :ok
          {:error, {:already_started, _pid}} -> :ok
        end

      _pid ->
        :ok
    end
  end
end
