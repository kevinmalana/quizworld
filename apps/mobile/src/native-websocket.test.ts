import { test } from "node:test";
import assert from "node:assert/strict";
import { nativeWebSocket } from "./native-websocket";
test("native transport supplies canonical website origin instead of Android backend-origin default", () => {
  let args: unknown[] = [];
  class FixtureSocket {
    constructor(...values: unknown[]) {
      args = values;
    }
  }
  const Transport = nativeWebSocket(
    FixtureSocket as unknown as typeof WebSocket,
  );
  new Transport("wss://quizworld-xs0g.onrender.com/socket/websocket", [
    "phoenix",
  ]);
  assert.deepEqual(args, [
    "wss://quizworld-xs0g.onrender.com/socket/websocket",
    ["phoenix"],
    { headers: { Origin: "https://www.quizworld.xyz" } },
  ]);
});
