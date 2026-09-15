# Private membership / assignment permission repair

## Scope and observed production state

Read-only MCP inspected project `tqmygnkwkjtkteguemya`; **no production SQL write, migration, membership mutation, deploy, or push** was performed by this worker.

The actual tables are `trivia_groups`, `trivia_group_members`, `classrooms`, `classroom_members`, `classroom_assignments`. All five have RLS enabled. `anon` and `authenticated` have SELECT/INSERT/UPDATE/DELETE table grants; policies, not missing table grants, control these failures.

Observed policies (before repair):
- `trivia_groups_select`: public OR creator OR `is_group_member(id, auth.uid())`.
- `classrooms_select`: creator OR `is_classroom_member(id, auth.uid())`.
- `trivia_group_members_insert`, `classroom_members_insert`: only `auth.uid() = user_id`, with no role or invitation restriction.
- `trivia_group_members_delete`: only `auth.uid() = user_id`.
- `classroom_members_delete`: self OR `is_classroom_teacher(classroom_id, auth.uid())`.
- No classroom membership UPDATE policy.
- `Members can read assignments`: classroom membership subquery.
- `Teachers can create assignments`: only `auth.uid() = assigned_by` (name does not match enforcement).
- No assignment DELETE policy.

Thus a correct private code lookup is filtered before the old client can join; teacher assignment DELETE is filtered to zero rows. The old UI ignored that result. Local baseline tests reproduce the zero-row teacher DELETE, unauthorized direct private memberships/elevated roles, and unauthorized assignment creation.

Working comparison: existing `create_classroom_with_teacher` uses SECURITY DEFINER, empty search_path, auth.uid(), authenticated-only execution and atomic teacher membership creation. This repair follows that pattern for redemption without exposing private records before joining.

Live joins have unique `join_code`; membership pairs have unique `(group_id,user_id)` / `(classroom_id,user_id)`; roles are CHECK-constrained. Live aggregate validation found no non-six-character-uppercase-alphanumeric stored codes. No non-internal triggers were found on either membership table or assignments. Existing assignment deletion cascades to `assignment_completions` and `notifications`; this migration does not change those FKs.

Recorded live migration history contains only `20260820140000`, `20260820150000`, `20260902045027`; older schema/policies exist outside recorded history. **Never generic db push/reset.**

## Exact proposal

`supabase/migrations/20260915120000_private_code_membership_permissions.sql`

1. Add `join_trivia_group_by_code(text)` and `join_classroom_by_code(text)`, returning only the joined resource UUID.
2. Use `auth.uid()` exclusively; no actor or role parameter. Reject missing identity. Normalize surrounding spaces/case, require exactly six ASCII letters/digits, use exact equality (not wildcard). Invalid and nonexistent codes share the same message.
3. Insert only member/student. Unique constraints + ON CONFLICT DO NOTHING make concurrent/repeated joins idempotent and preserve existing elevated roles. Ordinary members can leave and redeem again. No SELECT policy changes.
4. Lock down direct memberships: public group self-join as member; own group bootstrap as admin; own classroom bootstrap as teacher. A private resource UUID alone is not sufficient. Existing atomic classroom creation remains unchanged.
5. Require actual same-classroom teacher membership for assignment create/delete; preserve assigned_by=self on create.
6. Frontend uses RPC for codes, checks errors/nonempty replies, and requires exactly one returned row for assignment deletion and adjacent membership mutations. No false navigation or success on zero-row failure.

There is no generated database types file or typed Database generic in this source: `lib/supabase/client.ts` deliberately exports broad `SupabaseClient`. No fabricated type generation is claimed. New RPC signatures are exercised at the actual Supabase HTTP transport boundary.

## Review / risks

- Self-reviewed for least privilege, search_path, function ACL, actor derivation, role immutability, exact lookup, conflict behavior and preserved private SELECT rules; **independent parent review is still required before applying**.
- New functions explicitly revoke PUBLIC/anon and grant authenticated. SECURITY DEFINER is necessary to redeem a private code before membership, and is limited to the exact resource and current identity.
- A six-character code is a bearer invitation. Existing UUID-derived defaults provide only a short code space; this patch does not add account/IP rate limiting or code rotation. Do not claim brute-force resistance. Rate limiting/longer rotating invites are a follow-up product/security decision.
- Existing rows/roles are not rewritten. Prior unauthorized memberships cannot be identified safely from role alone; audit existing elevated memberships before treating historical data as trusted.
- Deletion now works as designed and existing CASCADE removes completion/reminder rows. No bulk cleanup in this migration.
- Removed users who still know a valid code can rejoin. There is no ban/revocation model; no permanent-removal guarantee is introduced.
- RPC errors remain generic in UI, including expired auth/network failures. No private names/code values are logged.

## Bounded adjacent findings (not silently widened)

1. **Fixed security hole**: direct membership inserts previously allowed choosing teacher/admin or joining by private UUID; assignment inserts required no teacher authority.
2. **Fixed misleading UX, backend feature still blocked**: co-teacher promotion has no UPDATE policy; group admin removal is denied by self-only DELETE. UI now shows an error. No role-promotion or admin-delete permission is added without dedicated governance review.
3. **Deferred**: sole group admin can leave; only client code prevents sole classroom teacher leave. Server-side last-manager enforcement needs race-safe ownership/transfer semantics. Redemption preserves existing roles but does not restore a deleted owner membership automatically.
4. **Deferred**: group creation is still two requests and ignores owner-membership failure. Needs atomic creation RPC, separate test/rollout.
5. **Deferred, security relevant**: `group_pinned_quizzes` SELECT policy is `true`, INSERT only checks `pinned_by=self`; private pin metadata can be enumerated and nonmembers can create pins by ID. No pin policies were changed in this bounded proposal.
6. **Deferred**: manual completion INSERT checks self/source but not assignment membership; helper `is_*_member`/`is_classroom_teacher` functions are public executable, accept arbitrary user IDs and lack pinned search_path. These were observed, not exploited against unrelated users.
7. Student classroom counts are limited by self/teacher membership SELECT; do not call the displayed count an independently verified full roster count.

## Verification

Evidence lives outside the repository at `/root/quizworld-repair-evidence/permissions/`.
- Handler tests extract actual page handlers via TypeScript AST, execute with real Supabase client, mock only HTTP transport, and assert UI state + URLs/payloads. This is not a full browser interaction claim.
- Local PostgreSQL 16 minimal fixture reproduces observed relevant RLS, constraints and grants. It omits unrelated production tables/columns/FKs and is **not** a full production dump or Supabase/PostgREST deployment.
- Python SQL tests run authenticated/anonymous PostgreSQL roles, auth.uid claim simulation locally, rollback normal cases, and test concurrent redemption using eight real connections. No simulated auth is sent to production.
- RED artifacts precede implementation (`red-delete.txt`, `red-joins.txt`, `red-sql.txt`, `red-adjacent.txt`, `red-group-error-visibility.txt`). New absent RPC SQL cases fail as missing functions on baseline; existing authorization/DELETE defects fail as wrong permitted operations/row counts.
- Full unit command may require Phoenix deps because `lib/report-followup.test.ts` shells out to Mix; missing dependencies are an environment gate, not evidence that backend tests passed.

## Apply / rollback instructions for parent

1. Review exact bytes/hash, diff, tests and remaining security findings. Reinspect live target/history for drift.
2. Prefer exact-file transactional validation on a disposable production-schema clone; the minimal local fixture is not that clone.
3. Apply only reviewed migration to verified project, in a transaction, then record only version `20260915120000` if provider history tooling does not do so. Read back exact definitions, ACLs and policy expressions.
4. Exercise ordinary authenticated dedicated-account code joins and negative controls after migration. Coordinate retained QA inventory before mutations. Verify membership role/readback, same-resource teacher deletion and actual row absence; assignment cascades are destructive to dependent QA records.
5. Only then build/deploy frontend from parent-integrated reviewed source; verify UI errors and mobile code paste, join/leave/rejoin and promotion/removal denial. No production/browser positive claim is made here.

Safe feature rollback: revert frontend and apply `supabase/tests/permission-safe-disable.sql` transactionally if necessary. It removes the two new RPCs and DELETE policy but **retains tightened INSERT policies**; do not restore known role-escalation vulnerabilities. This intentionally returns private join/delete to unavailable while preserving security. It does not delete memberships or recreate deleted assignments/completions; recover deleted records only from an independently approved backup. A full historical rollback of INSERT policies would reintroduce documented vulnerabilities and is not supplied as a routine operational action.
