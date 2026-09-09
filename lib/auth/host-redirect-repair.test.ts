import test from "node:test";
import assert from "node:assert/strict";
import * as redirects from "./redirects";

test("host login stores and carries the selected quiz through both auth paths", () => {
  const handoff = redirects.prepareHostLogin;
  assert.equal(typeof handoff, "function");
  const values = new Map<string, string>();
  const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) };
  for (const quiz of ["5ccd1d1d-6b6e-41bf-8601-3a4b31622034", "//evil.example?next=https://evil.example", null]) {
    const href = handoff(storage, quiz);
    const expected = quiz ? `/host?quiz=${encodeURIComponent(quiz)}` : "/host";
    const requested = new URL(href, "https://quizworld.local").searchParams.get("next");
    assert.equal(redirects.peekPostLoginRedirect(storage, requested), expected);
    assert.equal(redirects.consumePostLoginRedirect(storage), expected);
    assert.equal(new URL(expected, "https://quizworld.local").origin, "https://quizworld.local");
  }
});
