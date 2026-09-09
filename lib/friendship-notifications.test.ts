import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { loadFriendshipNotifications } from "./friendship-notifications";

function fixture(friendships: object[], profiles: object[], failure?: string) {
  const requests: URL[] = [];
  const client = createClient("http://127.0.0.1:54321", "test-anon-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input) => {
      const url = new URL(String(input));
      requests.push(url);
      const table = url.pathname.split("/").pop();
      if (url.searchParams.get("select")?.includes("!")) {
        return new Response(JSON.stringify({ code: "PGRST200", message: "No friendships to profiles relationship" }), { status: 400 });
      }
      if (table === failure) return new Response(JSON.stringify({ code: "42501", message: "denied" }), { status: 403 });
      return new Response(JSON.stringify(table === "friendships" ? friendships : profiles), { status: 200 });
    } },
  });
  return { client, requests };
}

test("pending request notification loads without an FK embed and uses the requester's name", async () => {
  const { client, requests } = fixture([{ id: "request-1", requester_id: "alice" }], [{ id: "alice", username: "alice-user", display_name: "Alice" }]);
  const result = await loadFriendshipNotifications(client, "recipient");
  assert.equal(result.error, null);
  assert.deepEqual(result.data, [{ id: "request-1", requester_id: "alice", name: "Alice" }]);
  assert.equal(requests[0].searchParams.get("addressee_id"), "eq.recipient");
  assert.equal(requests[0].searchParams.get("status"), "eq.pending");
  assert.equal(requests[0].searchParams.get("select"), "id,requester_id");
  assert.equal(requests[1].searchParams.get("select"), "id,username,display_name");
  assert.equal(requests[1].searchParams.get("id"), "in.(alice)");
});

test("empty requests never query profiles", async () => {
  const { client, requests } = fixture([], []);
  assert.deepEqual(await loadFriendshipNotifications(client, "recipient"), { data: [], error: null });
  assert.equal(requests.length, 1);
});

test("names are matched by ID with username and hidden/missing profile fallbacks", async () => {
  const { client, requests } = fixture([
    { id: "r1", requester_id: "a" }, { id: "r2", requester_id: "b" },
    { id: "r3", requester_id: "c" }, { id: "r4", requester_id: "a" },
  ], [{ id: "b", username: "bee", display_name: "" }, { id: "a", username: "aye", display_name: "A" }]);
  const result = await loadFriendshipNotifications(client, "recipient");
  assert.deepEqual(result.data?.map(row => row.name), ["A", "bee", "Someone", "A"]);
  assert.equal(requests[1].searchParams.get("id"), "in.(a,b,c)");
});

for (const table of ["friendships", "profiles"]) {
  test(`${table} errors remain errors, not successful empty results`, async () => {
    const { client, requests } = fixture([{ id: "r1", requester_id: "a" }], [], table);
    const result = await loadFriendshipNotifications(client, "recipient");
    assert.equal(result.error?.code, "42501");
    assert.equal(result.data, null);
    assert.equal(requests.length, table === "friendships" ? 1 : 2);
  });
}
