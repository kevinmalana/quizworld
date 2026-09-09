import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("account deletion opens a truthful reviewable email request with a no-mail-app fallback", async () => {
  Object.assign(globalThis, { React });
  const modulePath = "../components/profile/AccountDeletionRequest";
  const module = await import(modulePath).catch(() => null);
  assert.equal(typeof module?.AccountDeletionRequest, "function", "usable deletion request panel is missing");
  const html = renderToStaticMarkup(React.createElement(module.AccountDeletionRequest, { email: "owner+quiz@example.test" }));
  assert.match(html, /Request account deletion/);
  assert.match(html, /not sent/);
  assert.match(html, /not delete/);
  assert.match(html, /support@quizworld.xyz/);
  assert.match(html, /textarea/);
  const href = html.match(/href="(mailto:[^"]+)"/)?.[1].replaceAll("&amp;", "&");
  assert.ok(href);
  const url = new URL(href);
  assert.equal(url.pathname, "support@quizworld.xyz");
  assert.match(url.searchParams.get("body")!, /owner\+quiz@example.test/);
  assert.match(html, /verify.*ownership/i);
  assert.doesNotMatch(html, /Account deleted|Request sent|fetch\(/);
});
