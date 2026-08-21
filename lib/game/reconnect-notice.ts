export function shouldShowGameReconnectNotice({
  connected,
  hasConnectedOnce,
  loading,
  gameStatus,
}: {
  connected: boolean;
  hasConnectedOnce: boolean;
  loading: boolean;
  gameStatus: string;
}) {
  return !connected && hasConnectedOnce && !loading && gameStatus !== "finished";
}
