import { getGameServiceBaseUrl } from "@/lib/game-engine/client";

const PRESENTER_TOKEN_PREFIX = "qw_presenter_token_";
const PARTICIPANT_SESSION_PREFIX = "qw_present_participant_";

export type PresentationParticipantSession = {
  participantId: string;
  participantToken: string;
  participantName: string;
};

function baseUrl() {
  const url = getGameServiceBaseUrl();
  if (!url) throw new Error("Realtime presentation service is not configured.");
  return url;
}

export function writePresenterToken(presentationId: string, token: string) {
  if (typeof window !== "undefined") localStorage.setItem(PRESENTER_TOKEN_PREFIX + presentationId, token);
}

export function readPresenterToken(presentationId: string) {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(PRESENTER_TOKEN_PREFIX + presentationId);
}

export function writeParticipantSession(presentationId: string, session: PresentationParticipantSession) {
  if (typeof window !== "undefined") localStorage.setItem(PARTICIPANT_SESSION_PREFIX + presentationId, JSON.stringify(session));
}

export function readParticipantSession(presentationId: string): PresentationParticipantSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(PARTICIPANT_SESSION_PREFIX + presentationId);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PresentationParticipantSession;
    if (!parsed.participantId || !parsed.participantToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function startPhoenixPresentation(presentationId: string, authToken: string) {
  const response = await fetch(`${baseUrl()}/api/presentations/${encodeURIComponent(presentationId)}/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
  });

  const body = await response.json().catch(() => ({})) as { error?: string; presenter_token?: string; presentation?: unknown };
  if (!response.ok) throw new Error(body.error || "Could not start presentation.");
  return body as { presenter_token: string; presentation: unknown };
}

export async function joinPhoenixPresentation(joinCode: string, participantName: string) {
  const response = await fetch(`${baseUrl()}/api/presentations/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ join_code: joinCode, participant_name: participantName }),
  });

  const body = await response.json().catch(() => ({})) as {
    error?: string;
    presentation_id?: string;
    participant_id?: string;
    participant_token?: string;
  };

  if (!response.ok) throw new Error(body.error || "Could not join presentation.");
  if (!body.presentation_id || !body.participant_id || !body.participant_token) {
    throw new Error("Presentation join response was incomplete.");
  }

  return {
    presentationId: body.presentation_id,
    participantId: body.participant_id,
    participantToken: body.participant_token,
  };
}

export async function fetchPhoenixSlideActivity(
  presentationId: string,
  slideId: string,
  auth?: { presenterToken?: string | null; participantId?: string | null; participantToken?: string | null }
) {
  const params = new URLSearchParams();
  if (auth?.presenterToken) params.set("presenter_token", auth.presenterToken);
  if (auth?.participantId) params.set("participant_id", auth.participantId);
  if (auth?.participantToken) params.set("participant_token", auth.participantToken);
  const query = params.toString();

  const response = await fetch(`${baseUrl()}/api/presentations/${encodeURIComponent(presentationId)}/slides/${encodeURIComponent(slideId)}/activity${query ? `?${query}` : ""}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({})) as { error?: string; responses?: unknown[]; questions?: unknown[] };
  if (!response.ok) throw new Error(body.error || "Could not load presentation activity.");
  return body;
}

export async function fetchPhoenixPresentation(presentationId: string) {
  const response = await fetch(`${baseUrl()}/api/presentations/${encodeURIComponent(presentationId)}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({})) as { error?: string; presentation?: unknown };
  if (!response.ok) throw new Error(body.error || "Could not load presentation.");
  return body as { presentation: unknown };
}
