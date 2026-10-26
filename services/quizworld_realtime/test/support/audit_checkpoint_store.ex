defmodule QuizworldRealtime.AuditCheckpointStore do
  def persist_game(game) do
    if observer = Application.get_env(:quizworld_realtime, :audit_checkpoint_observer),
      do: send(observer, :checkpoint_attempt)

    if Application.get_env(:quizworld_realtime, :audit_checkpoint_fail, false),
      do: {:error, :simulated_outage},
      else: QuizworldRealtime.TestGameStore.persist_game(game)
  end

  defdelegate fetch_game(pin), to: QuizworldRealtime.TestGameStore
  defdelegate delete_snapshot(pin), to: QuizworldRealtime.TestGameStore
end
