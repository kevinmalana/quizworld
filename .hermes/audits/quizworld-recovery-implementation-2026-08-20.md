# QuizWorld recovery implementation record — 2026-08-20

## Scope

Recovery branch: `fix/security-and-ux-recovery`

Production baseline before rollout: `efa1232d6ade3b37fa8f1bc1b891ed44fc330da3`

Supabase project: `tqmygnkwkjtkteguemya` (`quizworld`)

## Production audit evidence

- `live-supabase-schema-2026-08-20.json` — tables, columns, RLS policies, functions, migration history and advisor summary.
- `live-supabase-constraints-2026-08-20.json` — constraints, indexes, grants, SECURITY DEFINER ACLs and row counts.

The audit was read-only. It confirmed that production had no tracked migration history, public presentation/slide/response policies, no notification or Q&A tables, the `study_sessions.correct/total/study_mode` schema, broad table privileges, and broad execution grants on SECURITY DEFINER functions.

## Implemented recovery

### Database

- Replaced the unsafe copy/paste bundle and duplicate migration versions.
- Added `20260820140000_quizworld_recovery_compatibility.sql` as the additive compatibility phase.
- Added `20260820150000_quizworld_recovery_lockdown.sql` as the post-deploy security phase.
- Preserved historical presentation activity and introduced immutable run IDs.
- Added secure Q&A and notification storage/RPCs.
- Replaced client-composed study persistence with an authenticated atomic completion RPC and server-calculated XP.
- Added revision-aware complete quiz draft persistence, including video, shuffle, answer order and AI evidence metadata.
- Kept multiplayer result ingestion service-role-only and game-instance-idempotent.

### Phoenix

- Scoped presentation credentials, Redis keys, activity and durable rows by immutable run.
- Removed destructive presentation-run resets.
- Validated presenter and participant channel roles.
- Removed raw participant rows from public WebSocket activity.
- Added server-side safe aggregates and server-owned reveal state.
- Split public, host and player game snapshots.
- Added persisted result-sync status, supervised retries and cleanup protection.

### Frontend

- Added serialized latest-state autosave for quiz and presentation authoring.
- Added optimistic draft revision conflict recovery.
- Removed presentation tokens from URL query strings.
- Switched notifications and study completion to trusted RPCs.
- Removed the invalid browser game-result fallback.
- Preserved and displayed AI confidence, rationale and citations for author review.

## Required rollout order

Production has no historical entries in `supabase_migrations.schema_migrations`. Do not run a generic history replay or `db push`. Apply only the two reviewed migration files through the Supabase migration API so each new recovery migration is recorded from this controlled baseline.

The final exact migration bytes were validated against a disposable PostgreSQL 17 schema modeled from the live audit. Compatibility and lockdown both applied twice transactionally. The validated hashes are `cedb8c36ed558cd22996f25b18580849e3892b3cf5972b89d3648a1a6a787992` and `4572a61a6173300cea90a22584ffbc7c765c8e2eb19b9239193e6062bc0bfc69`. Probes passed for study-write denial, host-only reports, answer-derived XP, one-time achievement XP, canonical taxonomy, immutable presentation runs, Q&A, imported-slide preservation, concurrency-idempotent result ingestion and final grants. The deterministic application gate passed with 70 TypeScript unit tests and 72 Phoenix tests.

1. Verify CI and the integrated Vercel preview at the exact reviewed branch SHA.
2. Apply `20260820140000_quizworld_recovery_compatibility.sql` through the Supabase migration API.
3. Merge a backend-only rollout PR containing the reviewed Supabase/Phoenix files. Wait for Render to deploy and verify health, Redis, WebSocket roles, run isolation and result sync before exposing the dependent frontend.
4. Merge the remaining frontend rollout PR from the already-reviewed integrated tree. Verify Vercel production at the exact merged SHA and run the browser workflows.
5. Apply `20260820150000_quizworld_recovery_lockdown.sql` only after both runtimes use the replacement RPCs.
6. Run live anonymous-denial, authenticated workflow and persistence probes.
7. Verify production frontend SHA equals merged `main`.

A single integrated merge is intentionally not used: Vercel and Render deploy independently, so it cannot guarantee the required Phoenix-before-frontend ordering.

Do not apply the lockdown migration before the replacement Phoenix/frontend code is healthy.

## Rollback

- Application rollback: revert the production merge on `main`; Vercel and Render deploy the revert.
- Database rollback: use a reviewed forward migration. Do not reset production or restore the removed public response policies.
- The additive compatibility objects are safe to leave in place during an application rollback; the lockdown must only be applied after application verification.
