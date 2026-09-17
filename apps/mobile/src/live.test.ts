import { test } from "node:test";
import assert from "node:assert/strict";
import { LiveGame, type LiveTransport, type SavedPlayer } from "./live";

const snapshot = (status = "waiting", extra = {}) => ({
  pin: "ABC123",
  game_instance_id: "instance-1",
  updated_at: "2026-09-17T10:00:00.000000Z",
  status,
  current_question_index: status === "waiting" ? -1 : 0,
  players: [{ id: "p1", nickname: "Ada", score: 0 }],
  current_question:
    status === "waiting"
      ? null
      : {
          id: "q1",
          text: "Question?",
          answers: [
            { id: "a1", text: "Yes" },
            { id: "a2", text: "No" },
          ],
        },
  ...extra,
});
function fixture() {
  let receive: (data: unknown) => void = () => {};
  let connectivity: (connected: boolean, error?: string) => void = () => {};
  let closes = 0;
  const commands: { event: string; payload: object }[] = [];
  const saved: SavedPlayer[] = [];
  const transport: LiveTransport = {
    request: async (_pin, action) =>
      action === "join"
        ? { session: snapshot(), player_id: "p1", player_token: "secret" }
        : { session: snapshot() },
    connect: (_saved, update, connection) => {
      receive = update;
      connectivity = connection;
      connection(true);
      return () => {
        closes++;
      };
    },
    command: async (event, payload) => {
      commands.push({ event, payload });
      return {
        session: snapshot("active", {
          current_answers: [{ player_id: "p1", answer_id: "a1" }],
        }),
      };
    },
  };
  const game = new LiveGame(
    transport,
    {
      save: async (v) => {
        saved.push(v);
      },
      clear: async () => {},
    },
    () => {},
  );
  return {
    game,
    transport,
    saved,
    commands,
    emit: (s: unknown) => receive({ session: s }),
    connection: (connected: boolean, error?: string) =>
      connectivity(connected, error),
    closes: () => closes,
  };
}
test("server media references survive parsing without changing scoring", async () => {
  const f = fixture();
  await f.game.join("ABC123", "Ada");
  f.emit(
    snapshot("active", {
      current_question: {
        id: "q1",
        text: "Media question",
        video_url: "https://www.youtube.com/watch?v=fixture",
        answers: [
          {
            id: "a1",
            text: "",
            image_url: "https://example.invalid/image.png",
          },
        ],
      },
    }),
  );
  assert.equal(
    f.game.state.session?.current_question?.answers[0].image_url,
    "https://example.invalid/image.png",
  );
  assert.match(
    f.game.state.session?.current_question?.video_url ?? "",
    /youtube/,
  );
  f.game.dispose();
});
test("automatic rejoin clears only the old connection error", async () => {
  const f = fixture();
  await f.game.join("ABC123", "Ada");
  f.connection(false, "Connection lost.");
  assert.equal(f.game.state.error, "Connection lost.");
  f.connection(true);
  assert.equal(f.game.state.error, "");
  f.game.dispose();
});
test("replacement during HTTP reconnect is visible; late completion after leave cannot reopen game", async () => {
  const f = fixture();
  await f.game.join("ABC123", "Ada");
  f.transport.request = async () => ({
    session: snapshot("waiting", { game_instance_id: "replacement" }),
  });
  await f.game.resume();
  assert.match(f.game.state.error, /replaced/);
  let finish!: (v: unknown) => void;
  f.transport.request = () =>
    new Promise((r) => {
      finish = r;
    });
  const read = f.game.resume();
  await f.game.leave();
  finish({ session: snapshot() });
  await read;
  assert.equal(f.game.state.session, null);
  assert.equal(f.game.state.playerId, null);
  f.game.dispose();
});
test("public active broadcasts preserve already confirmed own answer", async () => {
  const f = fixture();
  await f.game.join("ABC123", "Ada");
  f.emit(snapshot("active"));
  await f.game.answer("a1");
  f.emit(snapshot("active", { updated_at: "2026-09-17T10:00:01.000000Z" }));
  assert.equal(f.game.state.session?.current_answers?.[0].answer_id, "a1");
  f.game.dispose();
});
test("background/resume reauthorizes same identity, fences old reads and terminal snapshots", async () => {
  const f = fixture();
  await f.game.join("ABC123", "Ada");
  f.game.suspend();
  assert.equal(f.game.state.connected, false);
  assert.equal(f.closes(), 1);
  let finish!: (v: unknown) => void;
  f.transport.request = () =>
    new Promise((r) => {
      finish = r;
    });
  const resume = f.game.resume();
  f.emit(snapshot("finished", { updated_at: "2026-09-17T10:00:01.000000Z" }));
  // Old connection callbacks cannot mutate a suspended session.
  assert.equal(f.game.state.session?.status, "waiting");
  finish({
    session: snapshot("reveal", {
      current_answers: [
        {
          player_id: "p1",
          answer_id: "a1",
          is_correct: true,
          points_awarded: 900,
        },
      ],
    }),
  });
  await resume;
  assert.equal(f.game.state.session?.status, "reveal");
  f.emit(snapshot("finished", { updated_at: "2026-09-17T10:00:02.000000Z" }));
  assert.equal(f.game.state.session?.status, "finished");
  assert.equal(f.game.state.connected, false);
  f.emit(snapshot("active", { updated_at: "2026-09-17T10:00:03.000000Z" }));
  assert.equal(f.game.state.session?.status, "finished");
  f.game.dispose();
});
test("uncertain answers are not replayed after reconnect; stale and replaced snapshots rejected", async () => {
  const f = fixture();
  await f.game.join("ABC123", "Ada");
  f.emit(snapshot("active"));
  f.transport.command = async () => {
    throw new Error("Answer outcome unconfirmed. Reconnect to check.");
  };
  await f.game.answer("a1");
  assert.match(f.game.state.error, /unconfirmed/);
  f.transport.request = async () => ({ session: snapshot("active") });
  await f.game.resume();
  assert.equal(f.game.state.lockedQuestion, "q1");
  await f.game.answer("a2");
  f.emit(snapshot("reveal", { updated_at: "2026-09-17T10:00:02.000000Z" }));
  f.emit(snapshot("active"));
  assert.equal(f.game.state.session?.status, "reveal");
  f.emit(
    snapshot("waiting", {
      game_instance_id: "replacement",
      updated_at: "2026-09-17T10:00:03.000000Z",
    }),
  );
  assert.equal(f.game.state.session?.status, "reveal");
  assert.match(f.game.state.error, /replaced/);
  f.game.dispose();
});
test("validation and server join errors remain visible; no credentials persisted on rejection", async () => {
  const f = fixture();
  await f.game.join("bad", "Ada");
  assert.match(f.game.state.error, /six/);
  f.transport.request = async () => {
    throw new Error("This game is full.");
  };
  await f.game.join("ABC123", "Ada");
  assert.equal(f.game.state.session, null);
  assert.equal(f.game.state.error, "This game is full.");
  assert.equal(f.saved.length, 0);
});
test("joins with server-issued player identity, never host authority", async () => {
  const f = fixture();
  await f.game.join("ABC123", "Ada");
  assert.equal(f.game.state.session?.status, "waiting");
  assert.deepEqual(f.saved[0], {
    version: 1,
    pin: "ABC123",
    instance: "instance-1",
    player_id: "p1",
    player_token: "secret",
  });
  assert.equal(f.game.state.connected, true);
  f.game.dispose();
});
test("duplicate taps lock immediately; only server confirms correctness and points", async () => {
  const f = fixture();
  await f.game.join("ABC123", "Ada");
  f.emit(snapshot("active"));
  const first = f.game.answer("a1");
  await f.game.answer("a2");
  await first;
  assert.equal(f.commands.length, 1);
  assert.deepEqual(f.commands[0], {
    event: "player:answer",
    payload: { player_id: "p1", player_token: "secret", answer_id: "a1" },
  });
  assert.equal(f.game.state.lockedQuestion, "q1");
  assert.equal(
    f.game.state.session?.current_answers?.[0].is_correct,
    undefined,
  );
  f.game.dispose();
});
