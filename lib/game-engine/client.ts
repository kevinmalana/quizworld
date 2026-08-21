import { gameServiceUrl, getGameSocketUrl, isPhoenixGameEngine } from "@/lib/game-engine/config";

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
  if (!isPhoenixGameEngine) {
    throw new Error("Phoenix game engine is not enabled.");
  }

  const response = await fetch(`${gameServiceUrl}/api/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error || "Could not create realtime session.");
  }

  return response.json() as Promise<{
    host_token?: string;
    session?: {
      pin?: string;
    } & Record<string, unknown>;
  }>;
}

export async function fetchPhoenixSession(pin: string) {
  if (!isPhoenixGameEngine) {
    throw new Error("Phoenix game engine is not enabled.");
  }

  const response = await fetch(`${gameServiceUrl}/api/sessions/${encodeURIComponent(pin)}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error || "Could not load realtime session.");
  }

  return response.json() as Promise<{ session: Record<string, unknown> }>;
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
    player_id: string;
    player_token: string;
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
  if (!isPhoenixGameEngine) {
    throw new Error("Phoenix game engine is not enabled.");
  }

  const response = await fetch(
    `${gameServiceUrl}/api/sessions/${encodeURIComponent(pin)}/${action}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const body = await response.json().catch(() => ({})) as { error?: string };

  if (!response.ok) {
    throw new Error(body.error || "Phoenix session action failed.");
  }

  return body as T;
}
