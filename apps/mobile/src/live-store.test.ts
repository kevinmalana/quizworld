import { test } from "node:test";
import assert from "node:assert/strict";
import { playerStore } from "./live-store";
test("clear cannot be overtaken by a delayed credential save", async () => {
  let value: string | null = null;
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const storage = playerStore({
    get: async () => value,
    set: async (_k, v) => {
      await gate;
      value = v;
    },
    remove: async () => {
      value = null;
    },
  });
  const saving = storage.save({
    version: 1,
    pin: "ABC123",
    instance: "i",
    player_id: "p",
    player_token: "t",
  });
  const clearing = storage.clear();
  release();
  await Promise.all([saving, clearing]);
  assert.equal(value, null);
});
test("player store uses versioned dedicated key and rejects malformed identity without overwriting", async () => {
  const values = new Map<string, string>();
  const storage = playerStore({
    get: async (k) => values.get(k) ?? null,
    set: async (k, v) => {
      values.set(k, v);
    },
    remove: async (k) => {
      values.delete(k);
    },
  });
  const player = {
    version: 1 as const,
    pin: "ABC123",
    instance: "instance",
    player_id: "p1",
    player_token: "secret",
  };
  await storage.save(player);
  assert.deepEqual(await storage.load(), player);
  assert.deepEqual([...values.keys()], ["quizworld.live-player.v1"]);
  values.set("quizworld.live-player.v1", "broken");
  await assert.rejects(storage.load());
  assert.equal(values.get("quizworld.live-player.v1"), "broken");
  await storage.clear();
  assert.equal(await storage.load(), null);
});
