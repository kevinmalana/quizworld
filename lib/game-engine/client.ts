import { gameCommandError } from "@/lib/game/command-errors";
import { gameServiceUrl, getGameSocketUrl, isPhoenixGameEngine } from "@/lib/game-engine/config";

const REQUEST_TIMEOUT_MS = 15_000;
type CreatedSession = {
  host_token?: string;
  host_player?: { player_id?: string; player_token?: string };
  session?: { pin?: string } & Record<string, unknown>;
};

/** One bounded HTTP seam; uncertain commands are never automatically replayed. */
async function requestPhoenix<T>(path: string, init: RequestInit, fallback: string): Promise<T> {
  if (!isPhoenixGameEngine) throw new Error("Phoenix game engine is not enabled.");
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${gameServiceUrl}${path}`, { ...init, headers, signal: controller.signal });
    let body: unknown;
    try { body = await response.json(); }
    catch {
      // Bad confirmation bytes do not establish whether a mutation committed.
      throw gameCommandError({ reason: "unavailable" }, fallback);
    }
    if (!response.ok) throw gameCommandError(body, fallback);
    return body as T;
  } catch (error) {
    if (controller.signal.aborted) throw gameCommandError({ reason: "timeout" }, fallback);
    throw error;
  } finally { clearTimeout(timer); }
}

export function getGameServiceBaseUrl() {
  return gameServiceUrl;
}

export function getGameServiceSocketUrl() {
  return getGameSocketUrl();
}

export async function createPhoenixSession(
  payload: Record<string, unknown>,
  authToken: string
) {
  return requestPhoenix<CreatedSession>("/api/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(payload),
  }, "Could not create realtime session.");
}

export async function fetchPhoenixSession(pin: string) {
  return requestPhoenix<{ session: Record<string, unknown> }>(`/api/sessions/${encodeURIComponent(pin)}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  }, "Could not load realtime session.");
}

export async function joinPhoenixSession(
  pin: string,
  payload: {
    nickname: string;
    avatar?: string | null;
  }
) {
  return postPhoenixSessionAction<{
    session?: Record<string, unknown>;
    player_token?: string;
    player_id?: string;
  }>(pin, "join", payload);
}

export async function reconnectPhoenixSession(
  pin: string,
  payload: {
    host_token?: string;
    player_id?: string;
    player_token?: string;
  }
) {
  return postPhoenixSessionAction<{ session?: Record<string, unknown> }>(
    pin,
    "reconnect",
    payload
  );
}

export async function startPhoenixSession(pin: string, hostToken: string) {
  return postPhoenixSessionAction(pin, "start", { host_token: hostToken });
}

export async function readyPhoenixSession(
  pin: string,
  payload: { player_id: string; player_token: string }
) {
  return postPhoenixSessionAction<{ session?: Record<string, unknown> }>(pin, "ready", payload);
}

export async function revealPhoenixSession(pin: string, hostToken: string) {
  return postPhoenixSessionAction(pin, "reveal", { host_token: hostToken });
}

export async function advancePhoenixSession(pin: string, hostToken: string) {
  return postPhoenixSessionAction(pin, "advance", { host_token: hostToken });
}

export async function answerPhoenixSession(
  pin: string,
  payload: {
    player_id: string;
    player_token: string;
    answer_id: string;
    response_time_ms: number;
  }
) {
  return postPhoenixSessionAction(pin, "answer", payload);
}

async function postPhoenixSessionAction<T extends Record<string, unknown> = Record<string, unknown>>(
  pin: string,
  action: string,
  payload: Record<string, unknown>
): Promise<T> {
  return requestPhoenix<T>(
    `/api/sessions/${encodeURIComponent(pin)}/${action}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }, "Phoenix session action failed."
  );
}
