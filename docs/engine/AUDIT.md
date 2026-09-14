# Engine audit: findings, decision and local evidence

> Historical audit/load measurements below describe the original two-module candidate. Subsequent independent-review remediation adds instance-fenced channels and credentialed command replies, private browser reconciliation, read-only restore callers, cleanup timer references, and PID-pinned dispatch (including `:noproc` after dispatch). See `README.md` for current contracts. The load measurements were not rerun after those repairs and do not establish production capacity. Store failure masking, multi-node ownership, task watchdog and durable-report guarantees remain unresolved.

Date: 2026-09-13. Source baseline: `d284a567c7b3f0c27518b2554d943b80c48a7191`. Scope is Phoenix live-game backend and engine documentation only. No frontend code, schemas, dependencies, production rooms, reports or credentials were changed. No deployment is authorized by this document.

## Operational truth

Remote main was read with `git ls-remote origin refs/heads/main`; the isolated worktree was created from that full SHA, not the intentionally stale canonical checkout. Live backend `/api/health` eventually returned `status: ok`, `redis: true`, build SHA `82dfcb05c9ffbedaafb42cc3b8a399fbae790cdf`. Its entire `services/quizworld_realtime` Git subtree is identical to main's subtree. A live backend health request initially timed out; subsequent read succeeded. Health is a build/process signal, not proof Redis writes or result RPCs are healthy.

## Ranked deep-module opportunities

| Priority / decision | Evidence and friction | Proposed seam / trade-off |
|---|---|---|
| **Implemented: safe command recovery and atomic private reads** | Every GenServer exit became `not_found`, followed by restore/replay. A suspended answer queued twice and returned a false missing-room error. A killed room caused the dispatched answer to be replayed. Two-call authorization could carry an old role across actor replacement. | Deepen existing `Games`/`GameServer` interface: distinguish lookup failure from uncertain execution, and return the credentialed view atomically. Two production files; no extra adapter, dependency or state field. Clients may now see explicit timeout/unavailable instead of a misleading success/not-found/domain error. |
| **High: instance-scoped subscriptions and commands** | Topics and cached Channel roles are PIN-scoped. They do not reauthorize on room replacement. Commands have no expected phase/question or idempotency key. Complete composed credentials validate both roles, but partial payloads can downgrade to host-only. | Carry game-instance identity through join/topic/command interfaces; fail closed when that identity changes. Requires coordinated frontend/realtime contract work. Atomic initial snapshots alone do not close persistent-subscription races. |
| **High: truthful durability and single-owner recovery** | StateStore discards Redis write failures; `fetch_game` collapses outage/decode failures to missing state. Local Registry plus shared Redis is not distributed ownership. Recovery writes can race a newly live actor. Pending sync lacks task watchdog and expires with Redis TTL during long downtime. | Make store availability/acknowledgment explicit first, then define owner fencing and task completion monitoring. Do not claim durable/exactly-once semantics without Redis fault and deployed RPC tests. Larger than this patch. |
| **High under burst load: snapshot projection and publication** | Every answer persists the full growing game and constructs a full host view, including prior-response history and per-player correctness scans. Public reads also construct host analytics before filtering. Reveal fanout copies a full roster for each private player view. Local 200-player bursts exceeded call deadlines. | Deepen snapshot projection around role/phase and reusable historical aggregates; keep private shaping centralized. Potentially use bounded acknowledgments or deltas only with an explicit client reconnect contract. Cosmetic file splitting would not reduce CPU, memory copies or bytes. |
| **Next: one round-clock/lifecycle contract** | UTC is sampled separately for eligibility, response time and timers. A repeated valid start is a domain no-op but reschedules reveal/cleanup timers. Cleanup messages have no generation/phase token. Recovery reveal resets the 15-second advance window. | Centralize transition effects and distinguish state change from no-op; define monotonic runtime elapsed time plus persisted UTC recovery. Add cancellation/generation and clock-jump tests first. Avoid a speculative event-sourced engine rewrite. |

The first batch deliberately chooses execution/authorization safety rather than combining all five changes. The strongest performance concern is real but requires a larger projection/transport decision and independent review.

## Reproduced defects and regression tests

`test/quizworld_realtime/command_recovery_test.exs` uses real Registry/DynamicSupervisor/GameServer processes and the existing in-memory GameStore adapter.

1. **Timeout replay:** suspend the actor, invoke `Games.submit_answer`, inspect its queued calls, resume it and reconnect. Baseline: two commands, roughly four seconds, `{:error, :not_found}`, yet one locked answer after resume. Candidate: one command, roughly two seconds, `{:error, :timeout}`, same recoverable locked answer. The per-question duplicate guard does not make retries safe for all commands.
2. **Interrupted command replay:** queue an answer and kill the actor before processing. Baseline returned success after automatically dispatching the answer to the recovered actor. Candidate returns `{:error, :unavailable}` and leaves later snapshot reconciliation separate from mutation.
3. **Split private read:** an OTP system-debug hook replaces stored state and kills the real actor immediately after its standalone host-authorization reply. Baseline returned a host-shaped snapshot from a reset/replacement actor under the earlier authorization decision (the observed run lost the original roster). Candidate no longer has that intermediate standalone authorization step and returns the original credentialed view atomically. The hook deliberately injects a race; this is not evidence of a production exploit.
4. Additional coverage: true missing-actor recovery still dispatches; old room credentials fail after replacement; public/player/host-player privacy is preserved; invalid complete composed credentials reject; a private snapshot timeout stays an error and is not replayed.

`test/quizworld_realtime/round_invariants_test.exs` adds characterization/invariant coverage without changing rules:

- expired recovered round reveals and scores once;
- deadline checks reject an answer even before the timer message is handled;
- 24 simultaneous duplicate submissions lock exactly one answer and cannot score twice;
- previous-round timer messages leave the new round unchanged.

Baseline suite: **95 tests, 0 failures**. Candidate suite: **106 tests, 0 failures** in the initial full run; final seed/format/compile evidence is in the external handoff report. Existing poll, survival/team, composed-role Channels, private finished aggregates, reconnect and result payload tests remain in that full suite. The 11 new tests are not presented as a replacement for real browser or Redis fault acceptance.

## Meaningful local probe, not production certification

Reproducible script: [local_probe.exs](local_probe.exs). No new dependencies.

- Linux shared VPS; 2 schedulers/CPU threads; about 3.9 GiB RAM visible, swap in use. Other work on the host was not excluded. Baseline and candidate were run sequentially, not simultaneously, but these are **not controlled throughput comparisons**.
- Elixir 1.17.3, OTP 25; `MIX_ENV=test`, endpoint serving disabled; TestGameStore, no Redis/Supabase I/O. Disabled result persistence returns an explicit error rather than fabricated success.
- Synthetic classic games: three repetitions of 50 players × 10 rounds and three repetitions of 200 players × 20 rounds, 300-second question windows. Each round dispatches one answer per player concurrently. A host and each player have local PubSub drain listeners. Fixture roster creation uses `Game.join_player`, so HTTP join limits, Auth/QuizLoader, socket JSON encoding, browser rendering and network latency are **not measured**.
- Per-call monotonic latency includes mailbox waiting; actor queue/memory sampled every two milliseconds. Snapshot JSON size and one host encode sample are measured separately at the last reveal. The script verifies every intended question/player answer exists even when the caller saw an error.
- Each version exercised **13,500 answer calls**, 600 credentialed host snapshot calls, five independent one-second quiet deadline samples and one deliberately suspended answer call.

### Observations

Ranges below span three runs; they are per-run p95 ranges, **not** pooled p95 values.

| Scenario | Baseline | Candidate |
|---|---:|---:|
| 50-player answer calls across runs | 1,500; 0 errors | 1,500; 0 errors |
| 50-player per-run p95 call latency | 36.748–45.395 ms | 70.734–105.510 ms |
| 200-player answer calls across runs | 12,000; 167 `invalid_state` errors after replay | 12,000; 335 explicit `timeout` errors |
| 200-player per-run p95 call latency | 1,415.699–1,622.875 ms | 1,305.573–1,967.016 ms |
| 200-player maximum observed call latency | 3,609.884 ms | 2,016.302 ms |
| Suspended-call latency | 4,001.394 ms | 2,000.176 ms |
| Commands queued by that one suspended call | 2 | 1 |
| Quiet timer reveal delivery lag, five samples | 0–2 ms | 1–6 ms |

Both 200-player runs reached a sampled actor queue of 199. All intended answers were ultimately recorded in both versions, despite caller errors. These errors are **not a load-test pass**. They show the difference between an unacknowledged answer and a rejected answer, and why replaying after timeout is unsafe.

The final 200-player candidate sample's host snapshot was 636,769 JSON bytes, public view 25,666 bytes, private player view 25,846 bytes, and persisted game term 1,656,168 bytes. Maximum sampled candidate actor memory was 9,737,792 bytes (not total VM memory or a memory-leak test). Full-state publication, historical analytics reconstruction and mailbox queuing are substantial follow-up targets.

Do not infer that the candidate is faster: the changed answer success path is effectively unchanged, and host contention plus different timeout reporting confound this run. The verified improvement is bounded failure behavior/no replay and atomic credentialed reads. Quiet timer samples do not prove deadline behavior under the 200-player burst workload or wall-clock adjustment.

To compare the two changed modules with an explicit baseline in an isolated BEAM VM:

```sh
# From services/quizworld_realtime; baseline modules load in memory only.
env -u REDIS_URL -u SUPABASE_URL -u SUPABASE_SERVICE_ROLE_KEY MIX_ENV=test mix run --no-start \
  ../../docs/engine/local_probe.exs /tmp/quizworld-engine-baseline.json \
  d284a567c7b3f0c27518b2554d943b80c48a7191
```

The rest of the engine is identical between that baseline and this candidate. This mode does not overwrite source files, change a branch or deploy code.

## Outstanding hardening / release limits

- No live game was created and no Supabase report was written. Real Redis restart/outage/corruption, production result RPC persistence and browser acceptance remain lead-owned rollout gates.
- The current health `redis` flag means a Redix process exists, not that a PING or acknowledged write succeeded. There are no engine-specific duration/queue/recovery/rejected-answer/result-retry telemetry events or SLOs. Add low-cardinality, credential-free metrics before making capacity claims.
- HTTP rate limits aggregate by client IP and route: joining is capped at 30/minute, and snapshot polling at 600/minute. A classroom sharing a NAT can hit limits below the engine's 200-player roster cap. Channel commands bypass that HTTP limiter. The probe bypasses both transport paths.
- Malformed time-limit/points/answer data is only partially normalized. Scoring has a no-correct-answer safeguard, not complete schema validation. No validation/schema migration is bundled.
- Survival can finish early, while `ResultSync` iterates all quiz questions for its breakdown/scored count. Unplayed-question semantics can differ from played-round accuracy snapshots; this was found by code inspection, not repaired or live-verified.
- Final report timestamps are constructed during persistence attempts rather than stored as an immutable finish instant. Retry timestamp semantics deserve an explicit durable report contract.
- Existing host-only/host-player analytical visibility and partial-role fallback are unchanged. Atomic join snapshot is not a general credential expiry/revocation solution.
- No state struct or Redis serialization version changes; no migration/backfill required. This is not a hot-upgrade plan. Review, cherry-pick, exact-head CI and backend-first deployment verification remain mandatory before rollout.
