import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { presentationCommandNotice } from "./presentation/command-notice";

test("rejected outcomes always say the action did not go through", () => {
  for (const reason of ["invalid_participant_token", "Presentation socket is not connected.", "weird"]) {
    assert.match(presentationCommandNotice({ status: "rejected", reason }), /^That didn't go through\./);
  }
});

test("server reason codes never reach the audience verbatim", () => {
  for (const reason of ["invalid_participant_token", "bad_slide", "insert_failed", "something_new"]) {
    const text = presentationCommandNotice({ status: "rejected", reason });
    assert.doesNotMatch(text, /_/, `${reason} leaked as a code: ${text}`);
  }
});

test("an expired participant session tells people to rejoin", () => {
  assert.match(presentationCommandNotice({ status: "rejected", reason: "invalid_participant_token" }), /Rejoin with the code/);
});

test("uncertain outcomes keep the no-automatic-resend promise", () => {
  const text = presentationCommandNotice({ status: "uncertain", reason: "No reply from the presentation service." });
  assert.match(text, /couldn't confirm/);
  assert.match(text, /won't be resent automatically/);
});

test("readable transport sentences are kept", () => {
  assert.match(
    presentationCommandNotice({ status: "rejected", reason: "Presentation socket is not connected." }),
    /Presentation socket is not connected\./,
  );
});

test("the live session uses the plain-language notice", () => {
  const src = fs.readFileSync("components/present/live/presentation-live-session.tsx", "utf8");
  assert.match(src, /presentationCommandNotice\(outcome\)/);
  assert.doesNotMatch(src, /Action not sent or rejected\. \$\{outcome\.reason\}/);
});
