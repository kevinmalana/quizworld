import { createPhoenixSession } from "@/lib/game-engine/client";
import { writeHostSession } from "@/lib/host-session";
import { writePlayerSession } from "@/lib/player-session";

type LaunchHostedSessionArgs = {
  payload: Record<string, unknown>;
  authToken: string;
  hostId: string;
  playAsHost: boolean;
};

export async function launchHostedSession({
  payload,
  authToken,
  hostId,
  playAsHost,
}: LaunchHostedSessionArgs) {
  const response = await createPhoenixSession(payload, authToken);
  const pin = response.session?.pin;

  if (!response.host_token || !pin) throw new Error("Could not start game session.");
  if (playAsHost && (!response.host_player?.player_id || !response.host_player.player_token)) {
    throw new Error("Could not add you as a player. Please try again.");
  }

  writeHostSession(pin, { hostId, hostToken: response.host_token });
  if (response.host_player?.player_id && response.host_player.player_token) {
    writePlayerSession(pin, {
      playerId: response.host_player.player_id,
      playerToken: response.host_player.player_token,
    });
  }

  return pin;
}
