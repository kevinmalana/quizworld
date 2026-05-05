# QuizWorld v12 Changeset Handover

Last updated: March 31, 2026 — v12 (updated from v11)

This file documents the current QuizWorld changeset bundle packaged for agent handoff.

---

## What Changed In v12

v12 is a fix pass on top of the v11 builder redesign. The only file changed is still `app/create/page.tsx`. There are no new API routes, no new database tables, and no new migrations.

### Builder changes

v12 keeps the v11 focused-editor design, but fixes the user-facing regressions that showed up after the redesign:

- Builder switches to a stacked mobile/tablet layout instead of forcing the fixed desktop sidebar
- Question list becomes a horizontal scroller on smaller screens
- Answer grids and preview cards collapse to one column on narrow screens
- Preview stays reachable on small screens
- Timer and points controls now appear in an in-flow `Question Settings` block on small screens
- AI source drafts loaded from URL/document/paste keep the correct `sourceType`

### What did not change in v12

- All database tables and queries (quiz_drafts, quiz_draft_questions, quiz_draft_answers, quiz_versions, quizzes)
- All Supabase RPC calls (publish_quiz, republish_quiz)
- All URL params (?draft=, ?quiz=, ?quiz=&duplicate=1, ?version=)
- All sessionStorage behavior (key: qw_create_draft_v81)
- All autosave and fingerprint logic
- All question validation rules
- All source import logic (URL import, document import, paste import, AI source draft)
- All other project files

---

## What Changed In v11

v11 was the major builder UX redesign. It introduced the focused editor, top bar, tabbed source step, and redesigned publish step. See `docs/V11_RELEASE.md` for the full historical note.

---

## What Changed In v10

v10 was the major feature release. For full detail see docs/QUIZ_BUILDER_AGENT_HANDOVER.md. Summary:

- Account-backed draft persistence (quiz_drafts, quiz_draft_questions, quiz_draft_answers)
- Quiz versioning and republish flow (quiz_versions, publish_quiz RPC, republish_quiz RPC)
- Version restore entry point (?version=<id>)
- URL import via /api/import-url
- Document import (text/HTML/CSV/JSON files, pasted PDF text)
- AI source draft generation via /api/ai-source-draft
- Bulk paste import with two parser formats
- Builder diagnostics (per-question error/warning badges)
- Preview/playtest mode
- Autosave (2500ms debounce, fingerprint-based)
- Timer coaching and Apply Suggested Timers
- Dashboard: Saved Drafts, Edit, Duplicate, Archive/Restore, Version History, Restore As Draft
- Archive lifecycle (archived_at column on quizzes table)

---

## Files Changed In v12

Only one file changed:

- app/create/page.tsx (responsive/mobile fixes and AI source-type preservation)

---

## Files Changed In v10

Frontend and builder:

- app/create/page.tsx
- app/dashboard/page.tsx
- app/explore/page.tsx
- app/game/[pin]/page.tsx
- app/host/page.tsx
- app/join/page.tsx
- app/profile/page.tsx
- app/study/page.tsx
- app/study/[id]/page.tsx
- app/api/import-url/route.ts
- app/api/ai-source-draft/route.ts
- components/page-hero.tsx
- components/section-card.tsx
- lib/game-engine/config.ts
- lib/quiz-drafts.ts
- lib/quiz-import.ts
- lib/quiz-ai.ts

Phoenix service:

- services/quizworld_realtime/lib/quizworld_realtime/auth.ex
- services/quizworld_realtime/lib/quizworld_realtime_web/controllers/session_controller.ex
- services/quizworld_realtime/lib/quizworld_realtime_web/endpoint.ex
- services/quizworld_realtime/lib/quizworld_realtime_web/live/game_live/show.ex
- services/quizworld_realtime/lib/quizworld_realtime_web/plugs/cors.ex

Database and migrations:

- supabase_setup.sql
- supabase/migrations/20260331_v93_production_hardening.sql
- supabase/migrations/20260331_v94_quiz_drafts.sql
- supabase/migrations/20260331_v95_quiz_versioning.sql
- supabase/migrations/20260331_v96_quiz_archive.sql

---

## Verification Completed

v12 specific verifications:

- `npm run build` passed with standard Supabase env vars set
- preview toggle confirmed available on small screens in code
- mobile Question Settings block added for timer and points
- AI source draft loading now preserves URL/document/paste source type

v11 verifications carried forward:

- DB column mapping in persistDraft() matches quiz_drafts, quiz_draft_questions, quiz_draft_answers
- toPublishPayload() correctly maps timeLimit to time_limit and isCorrect to is_correct
- Both publish_quiz and republish_quiz RPC signatures match call sites
- All CSS variables (--accent-light, --success-light, --primary-light, --secondary-light, --bg-subtle) confirmed in globals.css
- All utility classes (btn-ghost, btn-sm, btn-lg, input-lg) confirmed in globals.css
- Syntax error in loadImportedQuestions corrected

v10 verifications carried forward:

- local next start booted successfully
- /api/import-url rejected invalid URLs correctly
- /api/import-url successfully fetched readable text
- /api/ai-source-draft rejected too-short source text correctly
- /api/ai-source-draft returned expected missing-env error

Not fully verified:

- Live Supabase end-to-end create/save/publish
- Live AI generation against a configured external model
- Phoenix mix test / mix compile (requires Elixir environment)

---

## Required Runtime Env For AI Source Draft

- QUIZWORLD_AI_API_KEY
- QUIZWORLD_AI_MODEL
- QUIZWORLD_AI_API_URL (optional, defaults to OpenAI-compatible endpoint)

---

## Recommended Next Steps For Agents

After unpacking this bundle:

1. Copy app/create/page.tsx into your project (replaces v10 version)
2. No DB migrations needed for v12 — but apply v94/v95/v96 if not already done
3. Run npm run build to confirm TypeScript compilation
4. Deploy or boot the Next.js app
5. Set the AI env vars if AI source drafting should be active
6. Run the smoke checklist in OPENCLAW_DEPLOY_HANDOVER.md
