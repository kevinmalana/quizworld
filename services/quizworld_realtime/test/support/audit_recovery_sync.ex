defmodule QuizworldRealtime.AuditRecoverySync do
  def persist_finished_game(game) do
    if observer = Application.get_env(:quizworld_realtime, :audit_sync_order_observer) do
      send(
        observer,
        {:sync_started_after_checkpoint, QuizworldRealtime.TestGameStore.fetch_game(game.pin)}
      )
    end

    send(
      Application.fetch_env!(:quizworld_realtime, :audit_recovery_observer),
      {:recovering, game.instance_id, self()}
    )

    receive do
      {:complete, result} -> result
    after
      2000 -> {:error, :test_timeout}
    end
  end
end
