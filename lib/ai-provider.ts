type ProviderEnvironment = Record<string, string | undefined>;

export function getAIProviderConfig(env: ProviderEnvironment = process.env) {
  const required = (name: string) => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`Missing ${name}`);
    return value;
  };
  const apiUrl = required("QUIZWORLD_AI_API_URL");
  const url = new URL(apiUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !url.pathname.endsWith("/chat/completions")) {
    throw new Error("QUIZWORLD_AI_API_URL must be a full HTTPS chat/completions endpoint without credentials or query parameters.");
  }
  return { apiUrl, apiKey: required("QUIZWORLD_AI_API_KEY"), model: required("QUIZWORLD_AI_MODEL") };
}

/** Fixed output ceiling, deadline and no retries: every accepted call is bounded. */
export async function fetchAICompletion(
  payload: Record<string, unknown>,
  maxTokens: number,
  dependencies: { env?: ProviderEnvironment; fetch?: typeof fetch } = {},
) {
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 16384) throw new Error("Invalid AI output limit.");
  const { apiUrl, apiKey, model } = getAIProviderConfig(dependencies.env);
  const body = JSON.stringify({ ...payload, model, max_tokens: maxTokens });
  if (new TextEncoder().encode(body).byteLength > 131_072) throw new Error("AI request is too large.");
  const response = await (dependencies.fetch ?? fetch)(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body,
    signal: AbortSignal.timeout(60_000),
    redirect: "error",
  });
  // Never reflect provider errors, credentials, or request material to clients.
  if (!response.ok) throw new Error("AI provider request failed.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("AI provider returned an empty response.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1_048_576) { await reader.cancel(); throw new Error("AI response is too large."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new Response(bytes, { headers: { "Content-Type": "application/json" } });
}
