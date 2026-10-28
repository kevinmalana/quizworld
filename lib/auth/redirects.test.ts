import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLoginHref,
  consumePostLoginRedirect,
  normalizePostLoginRedirect,
  rememberPostLoginRedirect,
  resolveLoginReturnParam,
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

test("login reads the shared next param and tolerates the legacy redirect alias", () => {
  assert.equal(resolveLoginReturnParam("?next=%2Fadmin"), "/admin");
  assert.equal(resolveLoginReturnParam("?redirect=%2Fadmin"), "/admin");
  assert.equal(resolveLoginReturnParam("?next=%2Fhost%3Fquiz%3Dabc&redirect=%2Fdashboard"), "/host?quiz=abc");
  assert.equal(resolveLoginReturnParam(""), null);
  assert.equal(resolveLoginReturnParam("?unrelated=1"), null);
});

test("values from the legacy redirect alias still pass the same safe normalization", () => {
  const storage = new MemoryStorage();
  assert.equal(
    consumePostLoginRedirect(storage, resolveLoginReturnParam("?redirect=https%3A%2F%2Fattacker.example")),
    "/dashboard",
  );
  assert.equal(
    consumePostLoginRedirect(storage, resolveLoginReturnParam("?redirect=%2F%2Fattacker.example")),
    "/dashboard",
  );
  assert.equal(consumePostLoginRedirect(storage, resolveLoginReturnParam("?redirect=%2Fadmin")), "/admin");
});
