// React Native Android otherwise sends the backend URL as Origin, which the
// existing Phoenix website-origin allowlist correctly rejects. Native clients
// identify as the same QuizWorld application; player tokens still grant roles.
// Browsers must keep their real browser-controlled Origin (separate adapter).
export function nativeWebSocket(Base: typeof WebSocket): typeof WebSocket {
  type NativeSocket = typeof WebSocket & {
    new (
      url: string,
      protocols?: string | string[],
      options?: { headers: Record<string, string> },
    ): WebSocket;
  };
  return class extends (Base as NativeSocket) {
    constructor(url: string | URL, protocols?: string | string[]) {
      super(String(url), protocols, {
        headers: { Origin: "https://www.quizworld.xyz" },
      });
    }
  };
}
