import { test } from "node:test";
import assert from "node:assert/strict";
import { gameServiceUrl, createLiveTransport } from "./live-transport";
test("live service is fixed to verified website Phoenix, with loopback-only fixture override", () => {
  assert.equal(
    gameServiceUrl("https://quizworld-xs0g.onrender.com"),
    "https://quizworld-xs0g.onrender.com",
  );
  assert.equal(
    gameServiceUrl("http://127.0.0.1:4187"),
    "http://127.0.0.1:4187",
  );
  for (const bad of [
    "https://quizwirld.xyZ",
    "https://other.example",
    "http://192.168.1.1",
    "https://quizworld-xs0g.onrender.com/evil",
    "https://user:pass@quizworld-xs0g.onrender.com",
  ])
    assert.throws(() => gameServiceUrl(bad));
});
test("transport refuses commands before channel authorization; no mutation buffering", async () => {
  const transport = createLiveTransport();
  await assert.rejects(transport.command("player:answer", {}), /not ready/);
});
