# Study completion authorization follow-up

## Scope and decision

Additive follow-up to `6541c6a64104e2014ee7ebdfa3dd0d734e4417de`; none of that commit's files are edited. No production mutations, QA calls, pushes, deployments or client privilege changes.

Read-only inspection of project `tqmygnkwkjtkteguemya` found exactly `public.complete_study_session_atomic(uuid,uuid,text,jsonb,integer)`, owned by postgres, SECURITY DEFINER, `search_path=public`, default NULL duration, EXECUTE granted only to postgres/authenticated/service_role. Its body matches the recovery migration's scoring implementation: authenticated identity and valid answer IDs are checked, but quiz access is not. SELECT RLS cannot protect writes made by this definer. Live catalog dependency and public function-body caller queries both returned empty arrays.

The sole application RPC caller is `app/study/[id]/StudyPageClient.tsx:126`: ordinary Supabase client, current quiz UUID, stable attempt UUID, submitted question/answer IDs, flashcard/quickfire mode, NULL duration. Its load query excludes archives. Existing quiz owner SELECT policy intentionally includes archives; solo's owner read behavior also remains. This bounded RPC fix preserves owner archive completion (including a study page loaded before its owner archives the quiz), rather than introducing a new owner prohibition. Nonowners must have an active public quiz or a creator-consented assignment in a classroom they currently belong to. Co-teachers retain the same read/complete authority as assigned students; only student membership produces assignment completions, unchanged from the original body.

## Migration and security review

`supabase/migrations/20260915200000_study_completion_access_guard.sql`

SHA-256: `9b17fb7348da1d39d848c7eb5493ed7f87b2ea3c93deb84e9843e5f2cdbe0979`

- Rename existing body to `_internal`; revoke ALL from PUBLIC, anon, authenticated, service_role. Only postgres retains execution. A public schema name does not confer EXECUTE. This avoids rewriting scoring, XP, progress, streak, assignment completion and retry logic.
- Recreate the original public signature/default, definer mode, pinned search path and grants. Fully qualify guard tables, auth identity and delegated function. No caller-provided role/user authority.
- Check quiz existence/access before invoking the unchanged body. Nonexistent/private/archived-inaccessible resources all raise `42501: Quiz is not accessible.`
- Require `ca.assigned_by=q.creator_id`, not merely classroom membership: teachers can assign guessed quiz UUIDs in the existing schema.
- Authorization precedes idempotent replay. Authorized retry response and no-double-award behavior are unchanged; a request after revocation fails even when its attempt was previously saved. Existing ledgers are not deleted.
- No table/column/policy changes. Original client RPC types remain identical; no generated type churn from a deliberately non-client-callable internal implementation. No full local Supabase/type generator or production schema clone was used.

Apply only the exact reviewed file **in one transaction as postgres**, after the assignment-read migration. Reinspect owner, grants, overloads, body and dependencies for drift first. Do not replay the historical recovery migration, use generic db push, or run this rename twice. Read back both ACLs and the unchanged internal body after any separately authorized application. Never regrant the internal function to clients. Prefer a forward correction; reverting to the old public body would deliberately reopen the vulnerability. Independent release review and production acceptance remain required.

The guard follows request-time PostgreSQL snapshot semantics, not a locking protocol: it denies requests after committed revocation, but does not promise cancellation of a completion already in flight concurrently with revocation. Assignment due dates remain non-expiring, consistent with existing reads. This is not a general anti-farming or unrelated RPC audit.

## Reproduction and results

```sh
python3 supabase/tests/test_completion_guard.py
# Focus only the added RPC suite:
python3 supabase/tests/test_completion_guard.py CompletionGuard
# Red-capable original symptom (must fail with UNEXPECTED COMPLETION SUCCESS):
COMPLETION_BASELINE=1 python3 supabase/tests/test_completion_guard.py CompletionGuard.test_nonmember_guessed_private_completion_denied_without_writes
npm run quality
./node_modules/.bin/tsx --test lib/database-recovery-migrations.test.ts lib/frontend-rpc-contracts.test.ts
```

The harness initializes a private tmpfs PostgreSQL 16 cluster with its own Unix socket, no TCP listener or remote URL, and cleans up only that cluster. Existing host PostgreSQL/other servers and shared node dependencies are untouched. It imports the frozen assignment fixture/harness, adds minimal ledger tables, and executes the actual recovery RPC SQL followed by exact new migration bytes. Forward migration rollback is catalog-compared before local commit.

Verified 30 tests (16 existing read tests plus 14 added RPC tests), 12 focused TS contract tests, quality guard and diff whitespace checks. Baseline outsider, archived, revoked and guessed-assignment checks fail with actual unauthorized completion success; authorized student scoring already passes baseline. Green checks cover student scoring and all ledgers, public/owner/co-teacher positives, archive restore, nonmembers/other classroom/unassigned/guessed assignments, revoke/leave, replay and revoked replay, invalid foreign question/answer IDs, missing quiz, anonymous/missing identity, service-role identity requirement, and direct internal EXECUTE denial. Catalog assertions preserve the original internal body, exact public ACL, owner, security mode, search path and default argument count. Denials assert zero sessions/progress/completions/XP; successful retry asserts one ledger update.

Fixture boundaries: real PostgreSQL RPC/role execution, not mocked function results, but minimal ledger tables rather than every production constraint/trigger. No new HTTP/PostgREST, hosted Auth, frontend completion, concurrent-request or production QA acceptance was run in this follow-up. The earlier read-only browser suite is not completion evidence. A test expectation initially contained doubled literal braces for `proconfig`; fixed to PostgreSQL's real catalog serialization before the final green run.
