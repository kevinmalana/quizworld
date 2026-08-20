import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLoginHref,
  consumePostLoginRedirect,
  normalizePostLoginRedirect,
  rememberPostLoginRedirect,
  validateNewPassword,
} from "./redirects";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

test("post-login redirects accept only local application paths", () => {
  assert.equal(normalizePostLoginRedirect("/classrooms/123?tab=assignments"), "/classrooms/123?tab=assignments");
  assert.equal(normalizePostLoginRedirect("https://attacker.example"), "/dashboard");
  assert.equal(normalizePostLoginRedirect("//attacker.example"), "/dashboard");
  assert.equal(normalizePostLoginRedirect("/\\attacker.example"), "/dashboard");
  assert.equal(normalizePostLoginRedirect("/login"), "/dashboard");
});

test("email and OAuth consume the same validated redirect contract", () => {
  const storage = new MemoryStorage();
  rememberPostLoginRedirect(storage, "/groups/private-1");

  assert.equal(consumePostLoginRedirect(storage), "/groups/private-1");
  assert.equal(consumePostLoginRedirect(storage), "/dashboard");
  assert.equal(buildLoginHref("/classrooms/123?tab=assignments"), "/login?next=%2Fclassrooms%2F123%3Ftab%3Dassignments");
});

test("password reset validation distinguishes mismatch and weak passwords", () => {
  assert.equal(validateNewPassword("short", "short"), "Use at least 8 characters.");
  assert.equal(validateNewPassword("long-enough", "different"), "Passwords do not match.");
  assert.equal(validateNewPassword("long-enough", "long-enough"), null);
});
