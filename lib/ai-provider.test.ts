import test from "node:test";
import assert from "node:assert/strict";

test("all AI callers use the configured full completion URL and bounded transport", async () => {
  const path = "./ai-provider";
  const ai = await import(path).catch(() => null);
  assert.equal(typeof ai?.getAIProviderConfig, "function", "shared provider contract missing");
  const env = { QUIZWORLD_AI_API_URL: "https://api.groq.com/openai/v1/chat/completions", QUIZWORLD_AI_API_KEY: "fixture-key", QUIZWORLD_AI_MODEL: "fixture-model" };
  assert.equal(ai.getAIProviderConfig(env).apiUrl, env.QUIZWORLD_AI_API_URL);
  for (const url of ["https://api.groq.com/openai/v1", "http://evil.test/chat/completions", "https://user:pass@evil.test/chat/completions", "https://evil.test/chat/completions?secret=x"]) {
    assert.throws(() => ai.getAIProviderConfig({ ...env, QUIZWORLD_AI_API_URL: url }));
  }
  let calls = 0;
  const response = await ai.fetchAICompletion({ messages: [{ role: "user", content: "fixture" }] }, 800, { env, fetch: async (url: string, init: RequestInit) => {
    calls++;
    assert.equal(url, env.QUIZWORLD_AI_API_URL);
    const body = JSON.parse(String(init.body));
    assert.equal(body.model, "fixture-model");
    assert.equal(body.max_tokens, 800);
    assert.ok(init.signal);
    return new Response(JSON.stringify({ choices: [{ message: { content: "Fixture response" } }] }), { headers: { "Content-Type": "application/json" } });
  } });
  assert.equal(calls, 1);
  assert.equal((await response.json()).choices[0].message.content, "Fixture response");
  await assert.rejects(() => ai.fetchAICompletion({ messages: [{ role: "user", content: "x".repeat(140000) }] }, 800, {
    env, fetch: async () => { calls++; return new Response("{}"); },
  }), /too large/);
  assert.equal(calls, 1, "oversized inputs must not spend provider requests");
  await assert.rejects(() => ai.fetchAICompletion({ messages: [] }, 800, {
    env, fetch: async () => new Response("x".repeat(1_048_577)),
  }), /too large/);
  await assert.rejects(() => ai.fetchAICompletion({ messages: [] }, 800, {
    env, fetch: async () => new Response("private upstream error", { status: 500 }),
  }), /^Error: AI provider request failed\.$/);
});
