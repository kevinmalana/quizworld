# QuizWorld live-game engine contracts

Audit base: remote `main` at `d284a567c7b3f0c27518b2554d943b80c48a7191` (2026-09-13). This document describes the live **quiz** engine, not presentation sessions or self-paced study. See [CONTEXT.md](CONTEXT.md) for domain vocabulary and [AUDIT.md](AUDIT.md) for risks and evidence boundaries.

## Module ownership and the seam

```text
HTTP SessionController / Phoenix GameChannel / GameLive
                       |
                     Games
       command error classification + missing-actor recovery
                       |
              one GameServer per PIN
       serial commands, timers, publication, result-sync tasks
                 /                 \
               Game              GameStore
    rules + role-scoped views       |
                                StateStore -> Redis
                       |
                  ResultSync -> Supabase result RPC
```

- `Game` contains game rules, answer locking, scoring, mode rules and snapshot projection. It has no Redis/network calls, but reads UTC directly and generates credentials; it is not a completely pure module.
- `GameServer` serializes changes to a room. Successful mutations prepare timers, persist the game and publish role-scoped snapshots before replying. Timer callbacks follow a separate, substantially duplicated publication path.
- `Games` is the external seam for transports. Callers should not reproduce lookup/recovery logic. A missing actor and an uncertain command outcome are different results.
- `GameStore` has two actual adapters: production `StateStore` and local `TestGameStore`. Its declared `:ok` write contract currently cannot express degraded durability.
- `ResultSync` creates a durable report through `record_game_result_v2`, separately from live Redis recovery. A live game acknowledgment is not a durable-report acknowledgment.

### The reliability change

`Games.authorized_snapshot(pin, credentials)` now asks **one** `GameServer` call to validate the credentials and construct their snapshot from the same immutable game value. The former `authorize` then `snapshot(role)` sequence carried a stale authorization decision across actor replacement. The old standalone `GameServer.authorize/2` interface has no remaining repository callers and is removed.

`Games` handles call outcomes as follows:

| Outcome | Result and recovery policy |
|---|---|
| Successful domain operation | Existing success tuple/snapshot |
| Domain rejection | Existing `{:error, reason}`; no recovery |
| Registry lookup finds no actor (or an already dead PID before dispatch) | Attempt read-only store recovery once, resolve the owning PID, then call that exact PID once |
| `GenServer.call` times out | `{:error, :timeout}`; **no restore and no replay** |
| Actor exits during call / other exit, including `:noproc` | `{:error, :unavailable}`; **no replay** |
| No stored game for a genuinely missing actor | `{:error, :not_found}` |

Timeout is **not cancellation**. The queued request may subsequently lock an answer. The browser reconciles using the credentialed reconnect endpoint, preserving composed host/player authority and same-revision own-answer evidence. If that read fails, the game remains visible and Check game status retries only the read. Socket/REST command errors retain structured reasons; public HTTP read timeout/unavailable are 504/503 (action/reconnect failures retain their 422 compatibility status). There are no command IDs, cross-transport exactly-once delivery, cancellation or durable acknowledgments.

Snapshots add the nonsecret `game_instance_id`. Channels bind to the atomically authorized instance, reject replacement-instance publications, and reauthorize command reply snapshots with credentials rather than cached roles. This prevents a prior host channel receiving a later room's private answers when a PIN is reused. It does not add expected-question fencing to every mutation.

`GameServer.snapshot(pin, role)` and `Games.snapshot_for_role(pin, role)` remain **trusted internal interfaces**, not authorization checks. Do not expose caller-selected roles through an HTTP/Channel parameter.

## State machine

```text
waiting -- start(host, at least one player, nonempty quiz) --> active
active  -- host reveal / deadline / all eligible answered --> reveal
reveal  -- host advance / 15-second auto-advance ----------> active(next)
reveal  -- last question / survival fewer than two alive --> finished
```

| State | Permitted operations | Important effects |
|---|---|---|
| `waiting` | Join, Ready, credentialed snapshots/reconnect, host start | Join generates independent player ID/token. Nicknames are trimmed, limited to 20 characters and unique case-insensitively. Maximum roster: 200. Ready is a signal, not a server-enforced start requirement. |
| `active` | Eligible player answer, host reveal, snapshots/reconnect | First accepted answer per player/question is locked. The final eligible answer auto-reveals. New joins are closed. |
| `reveal` | Host advance, snapshots/reconnect | Scores/eliminations/team totals are already settled; a second reveal rejects instead of scoring again. Auto-advance is scheduled for 15 seconds. |
| `finished` | Snapshots/reconnect, asynchronous result persistence | No more answer or advance mutations. Result sync starts pending/in-flight independently. |

Additional current behavior:

- `start` with a valid host token outside `waiting` returns the unchanged game. At the server layer this is not side-effect-free: it still resets timers and publishes/persists a snapshot. Repeated start during reveal can postpone auto-advance. This audit does **not** change that behavior.
- Host disconnect does not pause the game. Nonresponding players remain in the roster; Presence is connection information, not answer eligibility. There is no player-removal operation in this engine.
- Question and auto-advance messages carry the question index and check the expected phase. Old-round messages cannot advance a later round. Cleanup messages are untagged; see risks.
- Backend starts all modes with one or more players. Any frontend two-player minimum for survival/team is a stricter UI policy, not an engine invariant.

## Timing and scoring

- `question_started_at` is UTC. `Game.submit_answer` checks UTC against that start plus `max(time_limit, 1)` seconds. The comparison rejects strictly **after** the deadline; the exact instant is inclusive.
- The client-supplied response time is ignored. Recorded response time is nonnegative UTC elapsed time when the actor processes the answer, **including mailbox delay**, not network arrival time.
- Answer-window validation, response time and submitted-at currently read UTC separately. This is not a single sampled monotonic clock. Clock jumps or the small interval between checks are not covered by a stronger fairness guarantee.
- Timers schedule only the remaining UTC-derived window, including after a restore. An already-expired restored active round reveals immediately, rather than opening a fresh full-duration window.
- A late answer is rejected even if its timer message has not yet been handled. A valid answer is checked for current-question membership and duplicate locking before recording.
- A scored correct answer gets `round(points * (0.5 + 0.5 * max(0, 1 - response_time_ms / total_time_ms)))`; incorrect/unanswered players get zero. Scores change at reveal, not submission.
- Poll responses have null correctness and zero awarded points on reveal and in reports; polls do not eliminate players. Normalized poll answer-option flags are false, not a hidden correct choice.
- A malformed scored question with no correct option logs a warning and awards zero instead of crashing during reveal. Other malformed quiz field types are not comprehensively validated at the engine seam.
- No request carries an expected question index/phase or command ID. Membership in the current question guards normal database-unique answer IDs, but it is not a general stale-command fence, particularly for reused fallback true/false IDs or delayed host commands.

## Modes

- **Classic:** every roster player is eligible each round. Sum individual round points.
- **Survival:** wrong answers and nonanswers eliminate still-alive players on scored reveals. Eliminated players cannot submit. Polls neither eliminate nor score. Advance finishes once fewer than two players survive, even when the quiz has unused questions.
- **Team:** round-robin assignments at start, using the player map's key order (not a documented randomization or join-order promise). Two teams below eight players; three at eight to fifteen; four from sixteen. Team scores sum player round awards. Elimination is inactive.
- Unrecognized mode/question-type input falls back to classic/multiple-choice. Canonical database answer IDs are preserved for true/false questions where provided.

## Roles, credentials and private snapshots

Hosting and playing are separate capabilities. A host-player has a host token **and** its player ID/token; hosting alone cannot answer. Full composed credentials validate both sides independently. Player reconnect restores the existing player; it does not create another roster entry.

| View | Current answers | Correct counts | Question history | Active option counts |
|---|---|---|---|---|
| Public/spectator | Omitted | Omitted | Omitted | Hidden |
| Player | Own only; active reply hides correctness/time/points | Own only | Omitted | Hidden |
| Host / host-player | All submitted rows | All players | Included | Visible |

All views omit player tokens, host token and host ID. Public views still expose the roster and scores. Current correct options are hidden while active and shown at reveal/finish. History includes **previous** questions during an ordinary reveal; the current final question is included on finish. Correct-count aggregates include the current revealed question and exclude polls.

Host-player currently has full host analytical visibility, including other live answers/counts. This is an explicit description of existing behavior, **not** a claim of competitive fairness. Partial composed payloads can fall through to host-only authorization; complete-but-invalid composed credentials reject. Tightening partial payload semantics needs an agreed client contract.

PubSub publications:

- Public topic: `game:<pin>`; public-shaped phase/roster updates.
- Host topic: `game:<pin>:host`; host-shaped updates, including each answer.
- Player topic: `game:<pin>:player:<player_id>`; private reveal/finished results.
- Active answer submissions publish only to the host topic. The answering player receives its own acknowledgment.
- Host channels ignore the public update; player channels ignore public reveal/finished updates and consume their private result update.

These topics remain scoped by **PIN**, not game instance. Atomic initial snapshot authorization alone was insufficient when old channels retained subscriptions after PIN reuse (see the historical [AUDIT.md](AUDIT.md)). Channels now reject publications with absent or mismatched instance metadata, and command replies reauthorize the joined credentials against the same instance before returning private data.

## Recovery and durability limits

- A transiently supervised actor restarts after abnormal exits, not ordinary cleanup. Registry uniqueness is per node, not a cluster-wide ownership lease.
- Child startup attributes carry an instance ID. Recovery references fetch the latest stored game rather than keeping a stale full game in a supervisor child spec.
- Restore callers do not write the store. Only the Registry-owning actor upgrades legacy instance IDs and persists recovered state; a lagging restore cannot roll back a newer actor's acknowledged roster.
- Stored active games preserve the original question start. Timer references are cleared for production persistence; in-flight result sync becomes pending. TestGameStore is in-memory and does not model Redis serialization, TTL or failure.
- Waiting inactivity cleanup is two hours; active/reveal cleanup one hour; finished cleanup fifteen minutes. Transitions reset cleanup timers. Timer-reference fencing ignores already-delivered canceled cleanup events. Finished games with sync not succeeded postpone cleanup.
- Redis records use a six-hour TTL refreshed by writes. This is bounded recovery, not a permanent event journal. A sufficiently long downtime can lose even pending report state.
- `StateStore` currently returns `:ok` if Redis is absent, ignores Redis write failures, and rescues some errors as success. `fetch_game` also collapses transport/decode failures to `:not_found`. This refactor does **not** fix store-level error classification.
- On ordinary child restart, missing/mismatched stored state can cause initialization from creation attributes (fresh credentials/empty roster). Restore-only references fail instead. No production failover guarantee is made.
- Result sync is a Task.Supervisor child with retries on reported errors and bounded exponential delay (maximum sixty seconds). Exceptions/exits raised within the task are converted to errors; an externally killed/hung task lacks an owner-side monitor/watchdog and can leave `:in_flight` stuck until room restart.
- Redis recovery and durable Supabase reports are separate. Result payloads contain per-question analytics and game instance identity. This local audit validates payload/test contracts, not deployed RPC atomicity or successful live writes.
- Redis alone does **not** make multi-node mutation safe. Without a distributed owner/fencing scheme two nodes can restore and mutate the same PIN independently.

## Verification

From `services/quizworld_realtime`:

```sh
env -u REDIS_URL -u SUPABASE_URL -u SUPABASE_SERVICE_ROLE_KEY MIX_ENV=test mix test --seed 0
env -u REDIS_URL -u SUPABASE_URL -u SUPABASE_SERVICE_ROLE_KEY MIX_ENV=test mix run --no-start \
  ../../docs/engine/local_probe.exs /tmp/quizworld-engine-probe.json
```

The probe refuses non-test mode and disables endpoint serving, Redis, Supabase and successful result sync before application startup. It runs synthetic actors with PubSub drain listeners, not browser/HTTP clients. See [AUDIT.md](AUDIT.md) for conditions and results. Do not extrapolate it to production capacity.

## Official guidance consulted

- [OTP `gen_server:call/3`](https://www.erlang.org/doc/apps/stdlib/gen_server.html#call/3): timeout waits for a reply, lookup failure is `noproc`, and server exits are distinct. OTP 24+ process aliases discard late replies; they do not cancel server work.
- [Elixir GenServer](https://hexdocs.pm/elixir/GenServer.html): serialized callbacks, system debugging and lifecycle semantics. Fault tests use real actors with `:sys.suspend` and debug events, not fabricated transport responses.
- [OTP time correction](https://www.erlang.org/doc/apps/erts/time_correction.html): system time can jump; monotonic time is appropriate for elapsed runtime durations. A future clock change must also define cross-restart UTC recovery.
- [Phoenix Channels](https://hexdocs.pm/phoenix/channels.html): per-client channel processes and PubSub distribution do not provide distributed ownership of game state or durable replay.
