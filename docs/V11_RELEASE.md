# QuizWorld v11 Release Notes

Released: March 31, 2026

---

## Summary

v11 is a complete quiz builder UX redesign. It replaces the old vertical-scroll card layout with a professional three-panel editing environment that closely matches the way creators actually work: browse all questions at a glance, focus on one at a time, and publish when ready.

No database migrations are required. No API routes changed. The v10 feature set (draft persistence, versioning, AI source draft, URL import, document import) is fully intact.

---

## What Changed

### Builder step

The builder now uses a three-column full-viewport layout (height: 100vh minus the nav bar):

Left sidebar (220px): A scrollable list of every question in the quiz. Each row shows a small numbered badge, truncated question text, and a status dot. The dot is green when the question is complete, red when it has validation errors, and grey when the question is empty. "Blank Question" and "T/F Starter" buttons are pinned to the bottom of the sidebar.

Center panel: A focused editor showing exactly one question at a time. The active question number, error/warning counts, question text area, and 2x2 answer grid are all visible without scrolling. Prev/Next buttons at the bottom let the creator step through all questions. Pressing "Next" on the last question adds a new blank card automatically.

Right panel (hidden on mobile, 180px on desktop): Stacked Timer selector (10s / 20s / 30s / 60s), Points selector (500 / 1000 / 2000), and a stats summary (Ready / To Fix / Est. Time). A suggested-timer button appears when the AI recommends a different timer based on question reading length.

### Top bar

A compact 56px bar at the top of the builder (no scroll):

- Back arrow returns to the source step without losing work
- Quiz title displayed inline; click the pencil icon to edit it in place without a modal
- Draft status pill: colour-coded (green = saved, amber = unsaved changes, red = sync error)
- Step breadcrumb: 1 Source > 2 Build > 3 Publish
- Save Draft, Preview, and Publish buttons

### Source step

The old section-card layout is replaced with five tab pills across the top. Clicking a tab swaps the workspace card below:

- Manual: start with a blank question card
- Paste: import formatted text using the * correct / - wrong or A./B./C./D. + Answer: format
- Topic Starter: enter a topic to generate a five-question placeholder draft
- From URL: enter a URL to fetch readable page text, then convert to quiz cards
- Document: upload or paste text from a document; HTML files are normalised automatically

The AI Source Draft panel appears inline under the Paste, From URL, and Document tabs when there is enough source material to send.

### Publish step

The publish step is now two columns on medium and larger screens:

Left: Title input field, 2x4 category grid with emoji and colour highlighting for the selected category, Public/Private visibility toggle, pre-publish checklist (questions complete, no placeholder copy, timers OK, title set), and the Publish / Save Draft call-to-action buttons.

Right: A live quiz card preview that updates in real time as the creator changes the title and category. Below that, a 2x2 stats grid (Ready / Needs Work / Warnings / Est. Time) and a preview of the first complete question showing all four answer choices with correct highlighting.

### New components

AnswerCell replaces the old AnswerOption component. It renders a rounded card with a color-coded top-left badge (red/blue/amber/green for A/B/C/D), a correct-answer toggle that fills the badge with a checkmark, and an inline text input that fills the remaining space.

QuestionEditor is the focused single-card editor. It accepts a Question object and fires onChange/onDelete/onDuplicate callbacks. The timer and points controls moved to the right panel in the builder step, so QuestionEditor only handles the question text and the four answer cells.

SidebarItem is a new component for the question list. It accepts index, active state, issue count, complete state, and a click handler.

---

## What Did Not Change

- Database schema (no new tables, no new migrations)
- API routes (/api/import-url, /api/ai-source-draft)
- Supabase RPC calls (publish_quiz, republish_quiz)
- URL parameter handling (?draft=, ?quiz=, ?quiz=&duplicate=1, ?version=)
- sessionStorage draft recovery (key: qw_create_draft_v81)
- Autosave logic (2500ms debounce, buildDraftFingerprint, skipAutosaveRef)
- All question validation rules
- All import parsing (lib/quiz-import.ts)
- All AI draft helpers (lib/quiz-ai.ts)
- All draft type definitions (lib/quiz-drafts.ts)
- All design tokens (globals.css, CSS custom properties)
- All other pages and components

---

## Upgrading From v10

1. Replace app/create/page.tsx with the v11 version
2. No other file changes needed
3. Run npm run build to verify
4. No database migrations needed

---

## Known Limitations Carried From v10

- Topic Starter generates placeholder copy, not a live AI authoring pipeline
- URL import extracts readable text; it does not auto-generate questions
- Binary PDF parsing is not bundled (paste extracted text instead)
- AI source draft requires QUIZWORLD_AI_API_KEY and QUIZWORLD_AI_MODEL env vars
- No one-click version rollback UI
- No collaborative editing
