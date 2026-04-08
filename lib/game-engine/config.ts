export type GameEngine = "supabase" | "phoenix";

const rawEngine = process.env.NEXT_PUBLIC_GAME_ENGINE;

export const gameEngine: GameEngine =
  rawEngine === "supabase" ? "supabase" : "phoenix";

export const gameServiceUrl =
  process.env.NEXT_PUBLIC_GAME_SERVICE_URL?.replace(/\/$/, "") ?? "";

export const isPhoenixGameEngine = gameEngine === "phoenix" && gameServiceUrl.length > 0;
export const liveGameEngineMisconfigured =
  gameEngine === "phoenix" && gameServiceUrl.length === 0;
export const legacySupabaseGameEngine = gameEngine === "supabase";

export function getGameSocketUrl() {
  if (!gameServiceUrl) return "";

  if (gameServiceUrl.startsWith("https://")) {
    return gameServiceUrl.replace("https://", "wss://") + "/socket/websocket?vsn=2.0.0";
  }

  if (gameServiceUrl.startsWith("http://")) {
    return gameServiceUrl.replace("http://", "ws://") + "/socket/websocket?vsn=2.0.0";
  }

  return gameServiceUrl + "/socket/websocket?vsn=2.0.0";
}
