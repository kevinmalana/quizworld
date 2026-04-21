# Changelog

## v12 (2026-03-31)

- Fixed the v11 builder regressions on mobile/tablet.
- Builder layout now stacks on smaller screens instead of forcing a fixed desktop sidebar.
- Question list becomes a horizontal scroller on smaller screens.
- Answer grids and preview cards collapse to one column on narrow screens.
- Preview toggle is now available on small screens.
- Timer and points controls are available in the main editor flow on small screens via Question Settings.
- AI source drafts preserve their original source type when loaded into the builder.
- Builder questions can now be reordered directly from the focused editor or the sidebar.
- No database schema changes, no new migrations, no new API routes.
- `npm run build` verified successfully with standard Supabase env vars present.

## v11 (2026-03-31)

- Complete quiz builder UX redesign (app/create/page.tsx).
- Builder step replaced with full-viewport three-column layout: question sidebar, focused card editor, timer/points/stats panel.
- Source step replaced with tab-based picker (Manual / Paste / Topic Starter / From URL / Document) and a single swappable workspace card.
- New top bar with inline title editing, draft status pill, and step breadcrumb.
- Redesigned publish step with two-column layout: settings left, live quiz preview right.
- New components: AnswerCell (color-coded 2x2 answer grid), QuestionEditor (focused single-card editor), SidebarItem (question list entry with status dot).
- No database schema changes, no new migrations, no new API routes.
- All v10 logic (autosave, draft persistence, versioning, publish RPCs, URL params) preserved exactly.

## v10 (2026-03-31)

- Account-backed draft persistence via quiz_drafts, quiz_draft_questions, quiz_draft_answers tables.
- Quiz versioning and republish flow via quiz_versions table and publish_quiz/republish_quiz RPCs.
- Version restore entry point at /create?version=<id>.
- URL import via /api/import-url.
- Document import (text/HTML/CSV/JSON files and pasted PDF text).
- AI source draft generation via /api/ai-source-draft (OpenAI-compatible endpoint).
- Bulk paste import with two parser formats (marker-style and lettered-choice).
- Per-question diagnostic badges (errors and warnings).
- Preview/playtest mode for complete questions.
- Autosave with 2500ms debounce and fingerprint-based dirty detection.
- Timer coaching and Apply Suggested Timers bulk action.
- Dashboard: Saved Drafts, Edit, Duplicate, Archive/Restore, Version History, Restore As Draft.
- Archive lifecycle column (archived_at) on quizzes table.
- Production hardening for Phoenix host auth, CORS, Supabase security.

## v9

- Added a Phoenix realtime game service under `services/quizworld_realtime/`.
- Added frontend game-engine config under `lib/game-engine/`.
- Documented the new Next.js + Supabase + Phoenix + Redis architecture.

## v8.4

- Restored atomic quiz publish through a DB RPC.
- Moved host game start, reveal, and advance transitions back to server-side RPCs.
- Removed the incorrect play-count-on-start trigger from the canonical setup.
- Fixed 6-character PIN validation.
