import assert from "node:assert/strict";
import test from "node:test";
import { buildPresentationGetRequest } from "./client";

test("presentation HTTP credentials use Authorization and never URL query parameters", () => {
  const request = buildPresentationGetRequest(
    "https://realtime.example.test",
    "/api/presentations/deck%2F1/slides/slide%3F1/activity",
    { token: "participant-secret", participantId: "participant-1" },
  );
  assert.equal(request.url, "https://realtime.example.test/api/presentations/deck%2F1/slides/slide%3F1/activity");
  assert.equal(request.url.includes("token"), false);
  assert.deepEqual(request.init.headers, {
    "Content-Type": "application/json",
    Authorization: "Bearer participant-secret",
    "X-Participant-Id": "participant-1",
  });
});
