# Profile guards and durable API quota

Candidate: `20261025120000_profile_guards_durable_ai_quota.sql` (apply **only this exact file**, transactionally, after review). No production changes are made by the regression harness.

## Contract / live inventory

Read-only inventory of project `tqmygnkwkjtkteguemya` found:
- `profiles` has broad anon/authenticated INSERT/UPDATE grants despite owner UPDATE RLS. There is no INSERT policy. Owner UPDATE permits editing admin/XP/streak columns unless column privileges are narrowed.
- Actual profile form sends `username`, `display_name`, `avatar`, `updated_at`, and optionally `username_changed_at`. Grant authenticated UPDATE only for these; no browser INSERT is needed. Revoke table **and individual column** INSERT/UPDATE, including PUBLIC, so old column grants cannot defeat the fix. Existing SELECT/DELETE RLS and service-role access stay unchanged.
- `auth.users` AFTER INSERT -> `handle_new_user()` is postgres-owned SECURITY DEFINER and inserts `(id, username)`. Profiles BEFORE INSERT -> `set_default_display_name()` populates name/avatar. Neither function/trigger is replaced. Narrow browser grants do not impede the definer.
- Atomic completion and its internal function are postgres-owned SECURITY DEFINER. Completion remains authenticated/service callable; internal is postgres-only. Legacy `increment_xp(uuid,integer)` / `update_study_streak(uuid)` are already service-only in live production; repeat their client revocations defensively without changing their service grants.
- New `ai_request_quotas` table / `consume_ai_request_quota(uuid,text)` RPC are not yet deployed. The repository uses untyped Supabase clients, not a checked-in generated database type file.

## Durable semantics

All seven current guarded routes keep their existing per-minute limits. All four `/api/ai-*` routes share 50 accepted reservations per account in a 24-hour fixed window anchored by its first accepted AI reservation (not a calendar day or a sliding-window money budget). Import/conversion endpoints use durable minute windows without consuming or starting the AI allowance. One account row, bounded seven-entry JSON map, row-lock serialization, database clock, atomic admission+reservation. Rejected route/daily reservations do not increment counters. Auth deletion cascades the quota row.

Only service_role may execute the RPC; neither browser role can inspect or modify the table or invoke the RPC. Even service_role has no direct table DML grant: the pinned-search-path SECURITY DEFINER function is the write seam. The server first verifies identity with `auth.getUser()` and sends that ID, never request-supplied identity. No browser service key.

The server requires `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY`. Missing migration/key, RPC error/timeout, or malformed decision -> **503 with Retry-After: 60**, no provider call. Limit denials -> 429 with database retry/reset headers. Existing callers already await the async guard; no route or frontend edits required. Provider output/token caps remain unchanged.

Reservations are conservative: later input/provider failure, lost RPC responses, and retries can consume allowance; never refund a possibly spent request. A fresh migration starts empty (old in-memory counts cannot be recovered). This is an account quota, **not a global money cap**; provider/account hard spend limits remain an independent operational gate, especially for signup abuse.

## Local regression / receipts

Requires PostgreSQL 16 binaries in `/usr/lib/postgresql/16/bin`, psql, root/runuser access, postgres OS user, Python 3; harness starts fresh private Unix-socket clusters with networking disabled, never accepts a remote URL, and removes them afterward. Auth tables/trigger interfaces are synthetic local fixtures, not real Auth provisioning.

```sh
python3 supabase/tests/test_audit_data_guards.py
python3 supabase/tests/test_completion_guard.py
npx tsx --test lib/rate-limit.test.ts lib/ai-insights-repair.test.ts
npm run quality
npm run typecheck
```

The first suite tests transaction rollback before applying the migration locally, browser privilege denial, exact profile edit payload, signup trigger preservation, service-only quota isolation, parallel admission, cross-route daily cap, expiry, and auth-delete cleanup. The second exercises actual repository completion RPC scoring/replay after the new grants (175 XP once; streak 1; replay no duplicate). TypeScript tests use offline identity/RPC/provider fixtures and exercise the actual guard/service adapter/error handling; **no paid AI calls**.

For pre-fix RED reproduction only:
```sh
AUDIT_GUARDS_BASELINE=1 python3 supabase/tests/test_audit_data_guards.py AuditDataGuards.test_sensitive_owner_updates_and_inserts_denied
```
Expected failure: owner-sensitive updates succeed with reported pre-fix grants. Baseline inserts remain RLS-denied, so the baseline is not claimed to have an INSERT-policy exploit.

## Candidate verification

- Profile/quota PostgreSQL suite: **12 passed**. Concurrent route test admits exactly 10 of 30; cross-route daily race at count 49 admits exactly 1 of 20. All seven route limits and both expiry paths exercised.
- Completion/assignment PostgreSQL command: **31 passed**, including real completion/replay after narrowed profile privileges.
- Targeted TypeScript guard/insights/recovery/RPC checks: **20 passed**; quality and project typecheck passed.
- Production Next build passed using offline dummy Supabase build configuration (`http://127.0.0.1:9`, no real keys). Existing Next middleware-deprecation/Edge Runtime webpack warnings remain.
- Full unit attempt: **211 passed, 1 failed** because `lib/report-followup.test.ts` invokes Phoenix compilation and this new worktree initially had no Hex dependencies. Reusing main's dependency source exposed lock-version mismatches (thousand_island/hpax/mint/plug/req/bandit/phoenix/phoenix_live_view), so the full-suite gate is **not claimed passed**. No lockfile/source was changed and no production/backend work was done to work around it. Parent should rerun full checks with dependencies matching this branch's `mix.lock`.
- No live paid AI, production DDL/DML, push, or deploy performed. Live ordinary-client/signup and post-deploy readback remain operator-owned.

## Exact application and readback (parent/operator only)

1. Verify the project/ref, current profile columns, signup function owner/security mode, completion owner/security mode, and current grants. Review the exact migration file. No generic `db push` or historical migration replay.
2. Apply that file with the supported exact migration path in one transaction. An error before commit must roll back all statements. Apply the DB migration **before** deploying this server limiter. Existing app remains compatible during rollout.
3. Verify after commit:
```sql
SELECT grantee, privilege_type FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name IN ('profiles','ai_request_quotas')
ORDER BY table_name,grantee,privilege_type;
SELECT grantee,column_name,privilege_type FROM information_schema.column_privileges
WHERE table_schema='public' AND table_name='profiles'
  AND grantee IN ('PUBLIC','anon','authenticated') AND privilege_type IN ('INSERT','UPDATE')
ORDER BY grantee,column_name,privilege_type;
SELECT relrowsecurity FROM pg_class WHERE oid='public.ai_request_quotas'::regclass;
SELECT proname,pg_get_userbyid(proowner),prosecdef,proconfig,proacl
FROM pg_proc WHERE oid IN (
 'public.consume_ai_request_quota(uuid,text)'::regprocedure,
 'public.complete_study_session_atomic(uuid,uuid,text,jsonb,integer)'::regprocedure,
 'public.complete_study_session_atomic_internal(uuid,uuid,text,jsonb,integer)'::regprocedure);
SELECT rolname,
 has_function_privilege(rolname,'public.consume_ai_request_quota(uuid,text)','EXECUTE') AS quota_execute,
 has_table_privilege(rolname,'public.ai_request_quotas','SELECT') AS quota_read,
 has_column_privilege(rolname,'public.profiles','is_admin','UPDATE') AS admin_update,
 has_column_privilege(rolname,'public.profiles','total_xp','UPDATE') AS xp_update
FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role');
```
Expected browser INSERT/UPDATE table grants absent; authenticated column UPDATE exactly the five UI fields; no sensitive column update; quota table RLS true and no client policies/grants; only service_role (and owner) quota execute; completion ACLs/owner unchanged.
4. Deploy the server candidate with correct server-only key. Verify anonymous 401 and approved fixture owner profile save/admin-update denial. Do not call successful paid AI generation as a smoke test. Production ordinary-account/real-signup validation remains parent-owned, with disposable authorized accounts via Auth APIs, not direct auth.users writes.

## Safe rollback / disable

- Before commit: `ROLLBACK` (automatically exercised locally).
- After commit, do **not** restore broad profile grants or revert to the old process-local budget. Keep the schema/counters and tightened profile ACLs, even when rolling back unrelated application code.
- Emergency quota/AI disable, if explicitly authorized: `REVOKE EXECUTE ON FUNCTION public.consume_ai_request_quota(uuid,text) FROM service_role;` then verify `has_function_privilege` is false and guarded authenticated API requests return 503 without provider calls. Re-enable only after repair with `GRANT EXECUTE ... TO service_role` and exact ACL readback.
- Do not drop/reset the counter table to fix a problem: that grants everyone a new allowance. No destructive down migration is provided.
