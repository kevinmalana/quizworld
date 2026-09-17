# Personal sync v1 — exact deployment proposal (NOT applied)

**Local implementation is authorized and implemented. Production SQL is not authorized by this document.** Keep PR31 draft, require independent review before merge, and obtain separate approval for these exact bytes on project `tqmygnkwkjtkteguemya`. No other project, production data/config, signup/email, paid build, billing or deletion-backend work is included.

## Exact artifacts

- Forward: `supabase/migrations/20260917210000_personal_sync_v1.sql`
  - SHA-256: `974de7b47946f1974dc7e156cd1911d5cefaee306ba1d357e2dbd97ae03224ca`
- Safe disable: `supabase/rollback/20260917210000_personal_sync_v1_disable.sql`
  - SHA-256: `31ab808eb1c4051cdab7689f997cc08b83bb0a479106eed67e3c5d06a9ceba5f`
- Locally catalog-generated types: `apps/mobile/src/personal-db.generated.ts`. RPC runtime validation: `personal-contract.ts`.

No existing applied migration was modified. New objects only: `personal_sync_accounts`, `personal_sync_limits`, `personal_practice_events`, their policies/identity sequence, internal `personal_public_revision_v1(uuid)` and authenticated `personal_sync_v1(text,jsonb)`. No official completion/XP/profile/assignment/multiplayer write exists in these functions.

## Contract and authorization

Account UI **Connect personal sync** checks the deployed RPC's exact contract version, authenticated owner and server generation before enabling new-event capture. Missing/disabled RPC is **Cloud sync unavailable**, not sent/synced. Sync is manually requested; no background upload job. The existing verified auth controller supplies a snapshot of the same account's in-memory SDK access token, checks expiry and fences late responses. Tokens are absent from practice storage, exports, logs and RPC bodies.

Only current public, unarchived text quizzes with 1–100 questions, 2–8 text answers and exactly one author-marked correct answer are supported. Each immutable event is a strict metadata envelope: version, UUID event/session/quiz/question/answer identifiers, server-bound content revision, kind (`answer` or `remove`), learner-reported correct/recall, client time, and server generation. No text, email, credentials, entitlement or XP. Flashcard correctness remains self-report. Server receipt time/cursor, not client clocks, order review and determine its 1/3/7-day schedule. A `remove` event removes the derived review item in receipt order; replay of an already-known earlier answer cannot restore it. Removing a revoked/stale item cannot upload a new event; use account-wide cloud clear for revoked metadata.

Owner is always `auth.uid()`, never a payload field. RLS permits authenticated own-row SELECT only; no direct client mutation grants. Anonymous callers and direct calls to the internal revision helper are denied. Definer functions have empty search paths and qualified relations. Account FKs deliberately cascade only on auth account deletion. Quiz/question identifiers have no FK that would turn a content deletion into a learner-history mutation or expose content.

A locked per-account row serializes first requests, quota checks, receipt order, clear and pull. `INSERT ... ON CONFLICT DO NOTHING` returns the original durable receipt for identical payload retries; changed JSON under an existing UUID conflicts. Access and revision are rechecked even on replay. Pull readback must contain the exact event before the client removes it from its durable outbox. An uncertain response is pending unless a separate durable readback proves acceptance.

## Canonical source revision

`personal-revision.ts` and `personal_public_revision_v1` implement the same SHA-256 encoding:

1. Scalar sequence: `qw-personal-1`, quiz UUID, title, category (null/empty → `Other`), question count.
2. Questions sorted by `order_index`, then UUID: UUID, text, explanation (null → empty), answer count.
3. Answers sorted by UUID: UUID, text, correctness (`1`/`0`).
4. Each scalar encoded as UTF-8 **byte length**, `:`, then exact scalar bytes. Counts delimit arrays. No JSON object order, whitespace or locale dependency.

Full-source revision is retained for subset review. Media and unsupported types are rejected, not ignored as a license. Query fields are explicitly pinned in SQL; quiz lookup is by PK, child lookups by quiz/question foreign-key columns, with bounded counts. Before production approval verify the live schema and child indexes/query plans against these exact fields; the disposable fixture is not a clone of live indexes/triggers. The local nine-vector shared test covers Unicode, delimiters/newlines, title/category, explanation normalization, answer text/correctness and question/answer ordering.

This deliberately changes the old device-only revision algorithm. Old cached revisions fail closed and require reopening current content; there is no unsafe rewrite of old answers to a current revision. Pre-contract public review is retained as explicitly local-only metadata keys and never silently backfilled. Bundled/guest practice stays local, separately scoped.

## Clear semantics and bounds

**Clear personal cloud practice** persists a compare-and-swap intent using the last server generation before sending. The server increments generation and deletes that account's event rows atomically only when the expected generation is current. The account generation row is retained without TTL, cleanup or expiry. An old/fabricated generation cannot upload. Older queued events are blocked, never rebased to the new generation. An uncertain clear retries the same expected generation and cannot delete fresh new-generation practice twice. If newer events exist after a retry, UI says they were preserved and offers another explicit clear. Successful reconciliation removes public local checkpoints/review/history and remounts routes; bundled work and other accounts remain.

The default **1,000 events/account** is an operational storage/transfer cap, not researched user usage. A database operator may configure `personal_sync_limits.event_limit` in **1–2,000** after separate authorization; cap readback is part of capability and tests exercise a limit of one. Each envelope is at most 2,048 bytes of JSON text, with additional database/index overhead. There is no automatic retention cleanup. Account generation cannot be removed when clearing or disabling. Replay receipts are retained until an explicit clear; after clear, all old-generation payloads remain permanently rejected.

Device pending cap is 2,000 events plus the existing whole-state storage bound; a failed atomic write does not publish the answer or claim it queued. Device review displays at most 500 items and reports overflow without deleting cloud metadata. Full bounded pull is intentional v1 simplicity, not an unbounded stream. Limits may deny new practice capture until sync/clear; quota/error UI is explicit.

Local **Clear downloaded data** discards that device's pending events and public content but does not delete cloud receipts; a later explicit sync can restore accessible review. All-device removal uses the distinct cloud-clear confirmation. These are app-level clears, not erasure of exports/screenshots/OS backups. No paid/offline-license access extension exists. Current anonymous public access and exact revision are required for hydration and existing interaction/foreground guards remain. Revocation/clear enforcement is at request boundaries, not continuous remote deletion of already-rendered content.

## Local reproducible acceptance

Run serially from the repository root on the authorized disposable Linux host:

```sh
python3 supabase/tests/test_personal_sync.py
POSTGREST_BIN=/path/to/postgrest python3 supabase/tests/run_personal_sync_transport.py
cd apps/mobile
npm run check
npm run export:web -- --clear
npm run test:e2e
```

The SQL harness owns a new tmpfs PostgreSQL16 cluster with a private Unix socket, no listening TCP DB, synthetic `auth.users`/`auth.uid()` fixtures, and explicit ordinary roles. It never accepts a remote database URL. It tests exact migration transaction rollback, safe-disable rollback, official sentinel data/function/policy/catalog preservation, A/B/anonymous/direct-helper denial, private/archive/media/revision/reference/shape rejection, payload conflicts, concurrent submissions/clear, configurable capacity, and permanent generations.

The transport harness starts **real PostgREST 16.3** on loopback using fixture-signed A/B JWTs. The actual mobile fetch adapter only strips the Supabase gateway prefix locally; SQL/HTTP responses are not faked. Two independent device repositories prove outbox persistence → RPC commit → lost response → identical retry/pull → cross-device review/reload, account B isolation, remove, uncertain clear, old-generation rejection, and access/lifecycle fencing. Types are generated/verified from the applied local catalog. Auth provisioning here is synthetic fixtures, not a GoTrue signup, real account login or installed-device proof. Component/browser tests separately label their mocked native/auth/RPC boundaries. Existing baseline test files are untouched.

CI repeats this with a pinned downloaded PostgREST archive checksum and no remote credentials. PostgREST archive SHA-256: `4eb414eb948c8800863cc8c9896a17b611b2dccf9ff581f4d57f42ec9ccee40d`.

## Separate production approval and rollout

1. Independent exact-diff security/standards/spec review; inspect live schema, old policies/grants, query plans and migration history **read-only** on the named project.
2. Obtain explicit approval for the exact forward path/hash above, operator cap and account-clear semantics. No generic `db push` or history repair of unrelated migrations.
3. Apply only this file transactionally through the supported exact-migration/SQL path for the verified project, then record only version `20260917210000` as applied if history reconciliation is necessary. Read back exact function definitions, ownership, ACLs, RLS/policies, limit and migration history.
4. With separately authorized disposable accounts, verify ordinary-client A/B/anonymous behavior against the deployed capability, retry/conflict/clear and current public content. No existing user is a fixture. Native Android/iOS secure-store, lifecycle and network acceptance remains required before production-ready/store claims.
5. Safe rollback is the exact disable SQL above: revoke authenticated RPC execution, keep events and generations intact. Never drop/truncate generation state or add TTL as a rollback; that would allow content resurrection on reenable. Destructive removal would need a distinct approved data migration and backup plan.

Native official-completion bridge, deletion backend, licensed packs, MFA/social/email flows, billing/EAS/store publication and design changes are not part of this slice.
