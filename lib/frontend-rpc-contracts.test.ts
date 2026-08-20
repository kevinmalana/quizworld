import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("notifications use authorized RPCs instead of direct browser writes", () => {
  const classroom = source("../app/classrooms/[id]/page.tsx");
  const bell = source("../components/shared/notification-bell.tsx");
  assert.match(classroom, /rpc\("send_classroom_nudges"/);
  assert.doesNotMatch(classroom, /from\("notifications"\)\.insert/);
  assert.match(bell, /rpc\("mark_notifications_read"/);
  assert.doesNotMatch(bell, /from\("notifications"\)\.update/);
});

test("study completion is one atomic RPC and game completion has no browser result fallback", () => {
  const study = source("../app/study/[id]/StudyPageClient.tsx");
  const game = source("../app/game/[pin]/page.tsx");
  assert.match(study, /rpc\("complete_study_session_atomic"/);
  assert.doesNotMatch(study, /rpc\("increment_xp"|rpc\("update_study_streak"|from\("study_sessions"\)\.insert/);
  assert.doesNotMatch(game, /from\(['"]game_results['"]\)\.upsert|rpc\(['"]increment_xp['"]/);
});
