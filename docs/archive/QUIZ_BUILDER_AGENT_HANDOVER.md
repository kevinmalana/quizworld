# Quiz Builder Agent Handover

Last updated: March 31, 2026 — v12

This document is for agents working on the QuizWorld quiz builder. It covers the current architecture, how everything connects to the database, what changed in each version, and what to do next.

---

## Current Source Of Truth

Use this repo as the base:

- `/Users/kevinmalana/Documents/quizworld`

Do not use older zip snapshots as the main source of truth.

---

## Version History Summary

- v9 and earlier: Session-only, no draft persistence, no versioning
- v10: Added draft persistence, versioning, URL/doc import, AI draft review, archive/duplicate lifecycle
- v11: Complete quiz builder UX redesign. Three-column layout, focused card editor, tab source picker, redesigned publish step. Zero DB schema changes.
- v12 (current): Fix pass on top of v11. Restores mobile/tablet usability, keeps preview available on small screens, and preserves source-based AI draft identity. Zero DB schema changes.

---

## v12 What Changed

v12 is a focused fix pass on top of the v11 redesign. There are no new database tables, no new migrations, and no new API routes. The only file changed from v11 is still `app/create/page.tsx`.

### Responsive builder fixes

- On small screens, the builder now stacks vertically instead of forcing the fixed desktop sidebar.
- The question list becomes a horizontal scroller on small screens.
- Answer grids collapse from 2 columns to 1 column on narrow screens.
- Preview cards also collapse to 1 column on narrow screens.
- Preview toggle remains available on small screens.
- Timer and points controls now appear in an in-flow `Question Settings` block on small screens, instead of being available only in the desktop right rail.
- AI source drafts now preserve whether they came from URL, document, or pasted text when loaded into the builder.

### No breaking changes

Every URL parameter, draft flow, autosave behavior, and publish RPC call is identical to v11:

- ?draft=<id> still loads a saved draft
- ?quiz=<id> still loads a published quiz for editing
- ?quiz=<id>&duplicate=1 still duplicates into the builder
- ?version=<id> still loads a version snapshot
- supabase.rpc("publish_quiz", ...) is unchanged
- supabase.rpc("republish_quiz", ...) is unchanged
- sessionStorage key qw_create_draft_v81 is unchanged
- quiz_drafts, quiz_draft_questions, quiz_draft_answers tables are unchanged
- All query patterns against quiz_versions are unchanged

---

## v11 What Changed

v11 was the big builder redesign. It introduced:

- the three-panel builder with focused question editing
- the inline title/top bar flow
- the tabbed source step
- the redesigned publish step

That design direction remains intact in v12.

---

## Current Builder Files

Primary frontend builder files:

- app/create/page.tsx (v12, responsive fix pass on top of the v11 redesign)
- app/dashboard/page.tsx
- lib/quiz-drafts.ts
- lib/quiz-import.ts
- app/api/import-url/route.ts
- lib/quiz-ai.ts
- app/api/ai-source-draft/route.ts

Database files (no changes from v10):

- supabase_setup.sql
- supabase/migrations/20260331_v94_quiz_drafts.sql
- supabase/migrations/20260331_v95_quiz_versioning.sql
- supabase/migrations/20260331_v96_quiz_archive.sql

---

## How The Builder Works (v12)

### Create flow

1. User lands on the source step
2. Picks a tab: Manual, Paste, Topic Starter, From URL, or Document
3. Enters the builder step
4. Edits questions in the focused card editor, navigates via sidebar or Prev/Next
5. Moves to the publish step via Publish in the top bar
6. Fills in title, category, visibility; reviews the checklist; publishes

### Draft load behavior (unchanged from v10)

- browser sessionStorage for local recovery
- Supabase draft tables via ?draft=<id>
- published quiz content via ?quiz=<id>
- version snapshots via ?version=<id>
- duplicate builder entry via ?quiz=<id>&duplicate=1

### Draft save behavior (unchanged from v10)

- autosave runs 2500ms after the last edit change (debounced, fingerprint-based)
- first autosave creates a new quiz_drafts row and switches URL to ?draft=<id>
- Save Draft button is a manual save-now alternative
- both sessionStorage and Supabase layers remain active simultaneously

### Publish behavior (unchanged from v10)

- supabase.rpc("publish_quiz", ...) for new quizzes
- supabase.rpc("republish_quiz", ...) for editing an existing quiz
- both RPCs validate all fields server-side; errors surface to the UI
- each publish/republish writes a new quiz_versions snapshot

### Question validation rules

- Question text missing: error
- One or more answers blank: error
- Not exactly one correct answer: error
- Duplicate answer text: warning
- Duplicate question text across quiz: warning
- Question text over 140 chars: warning
- Timer 10s or less on question over 90 chars: warning
- Placeholder starter copy still present: warning

The sidebar status dot reflects errors only. The publish checklist surfaces both errors and warnings.

---

## Required Database Migrations (unchanged from v10)

No new migrations are needed for v12.

Fresh project path:
1. supabase_setup.sql
2. supabase/migrations/20260331_v93_production_hardening.sql
3. supabase/migrations/20260331_v94_quiz_drafts.sql
4. supabase/migrations/20260331_v95_quiz_versioning.sql
5. supabase/migrations/20260331_v96_quiz_archive.sql

Existing project upgrading:
1. Apply any missing prior migrations
2. Apply the v93 through v96 migrations in order

---

## Current Limitations

These carry over from v10:

- Topic Starter generates a local placeholder draft, not a real AI authoring pipeline
- URL import extracts readable text only; it does not auto-generate questions
- Document import accepts pasted PDF text and text-based files; binary PDF parsing is not bundled
- AI source draft depends on external env vars (QUIZWORLD_AI_API_KEY, QUIZWORLD_AI_MODEL) and is not runtime-verified against a live provider
- No one-click rollback to make a historical version live
- No collaborative editing

---

## Best Next Steps

Recommended order:

1. Add explicit version rollback — a one-click "Restore this version as live" action from the dashboard
2. Verify the AI source-draft route against a live configured provider end-to-end
3. Add richer import normalization in lib/quiz-import.ts for arbitrary prose formats
4. Add a fact-check/review step between AI generation and Load Into Builder

---

## What Has Been Verified (v12)

- DB column mapping in persistDraft() matches quiz_drafts, quiz_draft_questions, quiz_draft_answers schema
- toPublishPayload() correctly maps timeLimit to time_limit and isCorrect to is_correct before passing to RPCs
- Both publish_quiz and republish_quiz RPC call signatures match their Supabase function signatures
- All CSS variables used (--accent-light, --success-light, --primary-light, --secondary-light, --bg-subtle) confirmed present in app/globals.css
- All utility classes used (btn-ghost, btn-sm, btn-lg, input-lg) confirmed present in app/globals.css
- Syntax error in loadImportedQuestions corrected (setPreviewSelections({) fixed to setPreviewSelections({}))
- `npm run build` passed on the v12 code when standard Supabase env vars were present
- mobile/tablet builder controls restored for timer and points
- preview toggle restored for small screens
- AI source-draft loading preserves source type

---

## Short Guidance For Agents

- v12 is purely a frontend fix pass inside `app/create/page.tsx`
- no new DB work is needed beyond what v10 already required
- all business logic, validation, autosave, and publish flows are identical to v11/v10
- keep the focused-editor builder direction; v12 just makes it safe on smaller screens
