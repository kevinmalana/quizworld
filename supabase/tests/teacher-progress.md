# Teacher assigned Study progress — review candidate

## Root cause and scope

`app/classrooms/[id]/page.tsx:199` reads `study_progress` with member-user and assigned-quiz ID filters. The mastery grid consumes the six selected per-quiz fields unchanged. Production read-only catalog inspection confirmed RLS enabled, owner-only permissive SELECT/ALL policies, and SELECT-only grants for anon/authenticated. Existing real production QA had saved student 100% mastery while the teacher read only their own row (see external `final-live/REPORT.md`).

The new migration adds one authenticated SELECT policy, without changing table shape, grants, functions, client queries, or existing own-progress policies. No generated types exist here and no types/signatures change. No completion/XP implementation is touched.

## Authorization contract

- Teacher must have a **current teacher membership** in the same classroom as both the assignment and a **current student membership** for the progress owner.
- Assignment must target the exact progress quiz. Active public quizzes are eligible; private quizzes require creator-authorized sharing (`assigned_by = creator_id`) in **that same classroom**. Existing parent-table RLS also applies.
- Unassigned quiz history, peer/nonmember/co-teacher history, guessed private assignments, and unrelated-class combinations remain inaccessible. Ordinary unfiltered table enumeration is also restricted, not merely the UI filters.
- Quiz archive denies teacher access to student progress even if that teacher owns the quiz. Restoring an active eligible quiz restores visibility. This intentionally differs from the owner's ability to manage archived quiz content.
- Assignment deletion, student leave/kick/promotion, teacher leave/demotion, private-sharing withdrawal, and public-to-private without creator sharing revoke access on the next statement snapshot. Already-returned data cannot be recalled; in-flight concurrent statement cancellation is not claimed. Another independently qualifying classroom assignment can still authorize the same user/quiz pair.
- Existing own-progress access remains unchanged, including archived/unassigned history. This is **current cumulative per-quiz progress**, not assignment-local attempt history; earlier attempts on the same assigned quiz are included by the existing model. No unrelated quizzes, session ledger, global XP totals, or new metrics are exposed by this migration.

## Reproduction and verification

Run from repository root (PostgreSQL 16 tools and local postgres OS account required):

```sh
# Deliberate RED: saved 100% student row is invisible before the migration.
TEACHER_PROGRESS_BASELINE=1 python3 supabase/tests/test_teacher_progress.py TeacherProgress.test_teacher_reads_saved_student_mastery
# GREEN: real disposable local PostgreSQL, exact migration bytes.
python3 supabase/tests/test_teacher_progress.py
# Real Supabase JS executes the expression extracted from the unchanged page.
POSTGREST_BIN=/path/to/postgrest NODE_PATH=/path/to/shared/node_modules \
  python3 supabase/tests/run_teacher_progress_query.py
```

20 SQL tests pass. Setup also verifies transactional rollback, unchanged grants and function definitions. HTTP integration first requires 200/empty rows, applies the exact migration locally, then requires saved 100%/2 correct/2 studied plus timestamp, and verifies co-teacher access, own history, unrelated-history/broad-enumeration denial, anonymous/outsider/other-class denial, archive/restore and student-leave revocation.

Fixtures reproduce relevant inspected RLS and prior already-applied assignment access policy, not a full production schema clone. Prior policy bytes are fixture context only, not another deployable migration. Local signed fixture identities never leave loopback; there is no hosted Auth/session spoofing. Full Next build, actual classroom DOM rendering, production positive read, completion RPC rerun and production deployment remain **unverified here**. The unchanged actual Supabase query and data shape are exercised, not mocked transport responses.

## Review/apply/disable gates

Independent parent review is required before applying. No push/merge/deploy or production writes were performed. Only `20260915210000_teacher_assigned_study_progress.sql` is the new migration; do not replay fixture SQL or prior migrations. The release base must retain the already-applied assigned quiz access policies. Disable, if approved, by dropping only `"Teachers read current assigned student progress"` on `public.study_progress`; local tests verify this returns to owner-only visibility.
