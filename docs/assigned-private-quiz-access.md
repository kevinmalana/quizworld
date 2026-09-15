# Assigned private quiz read access — review proposal

## Scope / root cause

Based on fetched `origin/main` `c98088521d955914cff34783375a26bb15fc550f`.
No production write, QA membership change, deployment, push or merge was performed.

Read-only metadata from Supabase project `tqmygnkwkjtkteguemya` confirms:

- Quiz SELECT permits only creator or `is_public = true AND archived_at IS NULL`. No assignment access path exists.
- Questions/answers each have public-or-owner SELECT policies **and** legacy `read questions` / `read answers` policies with `USING(true)`.
- All affected tables have RLS enabled. Both anon/authenticated have SELECT/INSERT/UPDATE/DELETE table grants; existing write policies limit content to creators.
- Assignments use `quiz_id`, `classroom_id`, `assigned_by`; members use `classroom_id`, `user_id`, role (`student`/`teacher`). Assignment reads require current membership. INSERT requires assigned_by=self and same-class teacher; it does **not** validate quiz ownership.
- Current helpers are identity-scoped SECURITY DEFINER with empty search_path. The new policies do not add or change helpers, grants, table columns, RPCs or types.
- The retained QA assignment is creator-assigned and its quiz remains private/archived. No restoration or rejoin was performed.

The actual Study query already uses ordinary Supabase credentials with `*, questions(*, answers(*))`, exact UUID/slug and `archived_at IS NULL`. Classroom title lookup uses ordinary ID-scoped reads. Neither needs a public-filter removal or service-role bypass. Public discovery and Study SEO/redirect queries intentionally retain their public filters.

## Exact additive migration

`supabase/migrations/20260915190000_assigned_private_quiz_access.sql`

SHA-256: `8b9ff1744b5a9a6479d036d0ccdaa28a29500ab3c587e0c14a919655f7b17457`

1. Grant authenticated SELECT of active quizzes only when the current actor belongs to an assignment's classroom **and assigned_by equals the quiz creator**. A teacher cannot disclose another creator's private quiz by guessing its UUID and assigning it. Same-class co-teachers receive the same read access as students. Existing assignments from other creators do not confer private access; public quizzes remain accessible through existing public policy.
2. Add authenticated child SELECT policies following visible parent rows. Study/solo require answer text and `is_correct`; these are learning/practice resources, not a hidden-answer exam channel.
3. Add PUBLIC **restrictive SELECT** parent guards for questions and answers. PostgreSQL ORs permissive policies, so merely adding narrower permissive policies would leave the legacy leaks intact. Restrictive guards intersect every permissive path, including anonymous direct requests.
4. Preserve owner access to archived content for management and active-public access. Archive/removal/revocation deny the newly granted assignment access on the next request. Already downloaded browser content cannot be recalled.
5. No INSERT/UPDATE/DELETE authority is added. No data is rewritten or quiz publicized.

This remains an invoker/RLS chain: answers → questions → quizzes → assignments/membership. It introduces no security-definer bypass and no recursive quiz dependency. A classroom membership is authoritative until removed; assignment due dates are not an expiration boundary in the existing product.

## Tests and reproducibility

```sh
python3 supabase/tests/test_assignment_access.py
# Deliberately fails on baseline with 0 quiz rows (and legacy child exposure):
ASSIGNMENT_BASELINE=1 python3 supabase/tests/test_assignment_access.py

# Requires a local PostgREST executable, PostgreSQL 16, node dependencies and Chromium:
POSTGREST_BIN=/path/to/postgrest python3 supabase/tests/test_assignment_browser.py
npm run quality
npm run typecheck
npm run test:unit
```

The SQL harness initializes its own disposable tmpfs cluster, accepts no remote DB URL, tests exact forward bytes inside a rolled-back transaction, checks unchanged baseline policy metadata, then applies the bytes locally. All test mutations roll back. Cleanup stops/removes the cluster.

Verified: **16 SQL tests**, **28 focused unit tests**, **206 full unit tests**, quality and typecheck. SQL covers parent/child access, owner and co-teacher access, stranger and other-class teacher denial, guessed-ID assignment denial, public filtering, archived public/private denial, restore, revoke, leave, write denial and exact safe-disable bytes. Child-positive tests also remove legacy permissive policies to ensure the new grant does not depend on them.

Browser integration passed twice from fresh fixtures. It executes the real StudyPageClient and solo component, React, Supabase JS, HTTP transport, PostgREST 16.3, PostgreSQL 16 and RLS. Baseline real single-row query returns 406/PGRST116 and Study shows Quiz not found; after exact local migration, the private title/question/answer render, slug lookup and solo loading work. Real anonymous/outsider direct child reads are empty. Deleting the local membership revokes the query and Study UI on reload.

**Fixture boundaries:** minimal policy reproduction, not a production schema clone. Browser adapters supply Next navigation, Auth context, and a real Supabase client configured with locally signed test identities. It is not hosted Supabase Auth, full Next SSR, classroom-click navigation, CSS/visual acceptance, or completion/progress RPC verification. The REST responses are real, not mocked. Production login/session and UI acceptance remain required. Earlier fixture iterations needed a longer render wait and an answer-button accessible-name locator; the final two fresh runs pass. Expected 406 console messages are retained for baseline/revocation.

Node dependencies were shared without modifying the canonical tree; small Phoenix deps/build used private tmpfs directories. No huge dependency install. Evidence: `/root/quizworld-repair-evidence/assignment-access/`.

## Parent apply / safe disable

1. Independently review exact bytes and security scope. Reinspect target project and metadata for drift. Prefer testing against a disposable full production-schema clone, including game/presentation paths affected by closing anonymous child leaks.
2. Live migration history readback contained `20260820140000`, `20260820150000`, `20260902045027`, `20260915175100`, `20260915175136`. Last two provider-applied versions differ from earlier source filenames. **Do not generic db push/reset or replay old migrations.**
3. Apply only this reviewed exact file transactionally, using authorized provider tooling, and record only its version if tooling does not do so. Read back all five policy definitions/roles/permissiveness and unchanged grants/RLS. No frontend bundle change is required for this RLS repair.
4. With separately authorized dedicated QA state, restore/join only after inventory and cleanup plan. Exercise classroom assignment title → Study, actual answers, solo, completion/progress, anonymous/outsider/direct-child denial, archive, leave/rejoin, assignment revocation and unaffected public browsing/game paths. Restore original archive/memberships and preserve existing ledgers.
5. If disabling the feature, execute `supabase/tests/assignment-access-safe-disable.sql` transactionally and verify exact targets. SHA-256: `d1a48deafac08de3085122f22d0cdfb39e718bf5e3d95fc5fb0cf1a20bed356c`. It removes the three new permissive grants but **retains restrictive privacy guards**. Tests verify public and owner reads remain, student private reads disappear, and rolling back disable restores access. Do not drop restrictive guards to recreate the historical child leaks. Re-enable only the three missing permissive policies from reviewed forward bytes; do not rerun the entire CREATE POLICY file over retained guards.

## Separate finding / remaining gates

Live `complete_study_session_atomic` is SECURITY DEFINER. It checks authentication and answer/question consistency but does not check quiz visibility, archive state or assignment access before scoring/persisting. Assignment completion insertion itself requires student membership. This pre-existing RPC authorization gap is **not fixed by SELECT RLS**. No completion RPC was invoked in production or claimed secure by this patch. Scope is table read access and Study/solo loading; review a separate bounded RPC authorization change before claiming end-to-end private-study authorization or revoked-user persistence denial.

Existing owner archive management is preserved, including solo's current owner behavior (solo has no explicit archived_at client filter). Public metadata/title remains public-only. Neither behavior was silently broadened. No production-positive acceptance or release approval is claimed.
