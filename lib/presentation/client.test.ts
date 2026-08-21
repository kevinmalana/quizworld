import assert from "node:assert/strict";
import test from "node:test";
import { buildPresentationGetRequest } from "./client";

test("presentation HTTP credentials use Authorization and never URL query parameters", () => {
  const participant = buildPresentationGetRequest(
    "https://realtime.example.test",
    "/api/presentations/deck%2F1/slides/slide%3F1/activity",
    { participantToken: "participant-secret", participantId: "participant-1" },
  );
  assert.equal(participant.url, "https://realtime.example.test/api/presentations/deck%2F1/slides/slide%3F1/activity");
  assert.equal(participant.url.includes("token"), false);
  assert.deepEqual(participant.init.headers, {
    "Content-Type": "application/json",
    Authorization: "Participant participant-1:participant-secret",
  });

  const presenter = buildPresentationGetRequest(
    "https://realtime.example.test",
    "/api/presentations/deck-1",
    { presenterToken: "presenter-secret" },
  );
  assert.deepEqual(presenter.init.headers, {
    "Content-Type": "application/json",
    Authorization: "Bearer presenter-secret",
  });
});
