type CommandTransportOptions<T> = {
  connected: boolean;
  event: string;
  payload: Record<string, unknown>;
  sendSocketCommand: (event: string, payload: Record<string, unknown>) => Promise<unknown>;
  sendRestCommand: () => Promise<T>;
};

export async function executePhoenixGameCommand<T>({
  connected,
  event,
  payload,
  sendSocketCommand,
  sendRestCommand,
}: CommandTransportOptions<T>): Promise<T> {
  if (!connected) return sendRestCommand();
  return sendSocketCommand(event, payload) as Promise<T>;
}
