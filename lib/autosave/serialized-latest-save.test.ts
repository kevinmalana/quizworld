import assert from "node:assert/strict";
import test from "node:test";
import { SerializedLatestSaveQueue } from "./serialized-latest-save";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

test("one save runs at a time and intermediate edits coalesce to the latest state", async () => {
  const requests: Array<{ value: string; request: ReturnType<typeof deferred> }> = [];
  const queue = new SerializedLatestSaveQueue<string>((value) => {
    const request = deferred();
    requests.push({ value, request });
    return request.promise;
  });

  queue.enqueue("first");
  void queue.start();
  await Promise.resolve();
  queue.enqueue("second");
  queue.enqueue("latest");
  assert.deepEqual(requests.map(({ value }) => value), ["first"]);

  requests[0].request.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(requests.map(({ value }) => value), ["first", "latest"]);
  assert.equal(queue.getSnapshot().status, "saving");

  requests[1].request.resolve();
  await queue.flush();
  assert.equal(queue.getSnapshot().status, "saved");
});

test("manual flush waits for edits queued behind the in-flight save", async () => {
  const requests: Array<ReturnType<typeof deferred>> = [];
  const values: string[] = [];
  const queue = new SerializedLatestSaveQueue<string>((value) => {
    values.push(value);
    const request = deferred();
    requests.push(request);
    return request.promise;
  });
  queue.enqueue("old");
  void queue.start();
  await Promise.resolve();
  queue.enqueue("new");
  let flushed = false;
  const flush = queue.flush().then(() => { flushed = true; });
  requests[0].resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(flushed, false);
  assert.deepEqual(values, ["old", "new"]);
  requests[1].resolve();
  await flush;
  assert.equal(flushed, true);
});

test("failed latest state remains dirty for an explicit retry", async () => {
  let attempts = 0;
  const queue = new SerializedLatestSaveQueue<string>(async () => {
    if (++attempts === 1) throw new Error("offline");
  });
  queue.enqueue("draft");
  await queue.start();
  assert.equal(queue.getSnapshot().status, "error");
  assert.equal(queue.getSnapshot().error?.message, "offline");
  await queue.flush();
  assert.equal(attempts, 2);
  assert.equal(queue.getSnapshot().status, "saved");
});
