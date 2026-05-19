# QuizWorld v12 Release Notes

Released: March 31, 2026

---

## Summary

v12 is a stability and usability follow-up to the v11 builder redesign.

It keeps the focused-editor builder introduced in v11, but fixes the user-facing regressions that mattered most:

- mobile/tablet users can edit timer and points again
- preview is available on small screens
- the builder layout collapses cleanly on narrow viewports
- AI source drafts preserve the correct source identity when loaded into the builder

No database migrations are required. No API routes changed. No Supabase or Phoenix contracts changed.

---

## What Changed

### Responsive builder behavior

The builder no longer forces the desktop three-panel layout onto narrow screens.

- the main builder area now stacks on small screens
- the question list becomes a horizontal scroller instead of a cramped fixed sidebar
- answer grids collapse from two columns to one column on narrow screens
- preview cards also collapse to one column on narrow screens

### Small-screen editing controls

In v11, timer and points controls only existed in the desktop right rail. In v12, small screens get an in-flow `Question Settings` block directly under the active question editor.

This restores full question editing on phone and tablet breakpoints.

### Preview access

The preview toggle is no longer hidden on small screens. Authors can open playtest preview directly from the top bar on mobile as well as desktop.

### AI source identity

When a creator generates an AI draft from imported URL text, document text, or pasted source text, loading that draft into the builder now preserves the correct `sourceType` instead of flattening everything to `ai-topic`.

That keeps draft resume behavior and source-tab continuity aligned with how the draft was actually created.

---

## What Did Not Change

- database schema
- Supabase RPCs
- Phoenix service code
- game-engine contract
- import parsing routes
- AI source-draft API route
- draft/version/archive data model

v12 is a frontend builder fix pass only.

---

## Verification

Verified in this handoff:

- `npm run build` passed with standard Supabase env vars present
- responsive builder fixes are present in `app/create/page.tsx`
- preview access is present on small screens
- small-screen timer/points controls are present
- AI source-draft loading preserves source type

Not fully verified here:

- live Supabase end-to-end draft/publish
- live AI provider completion with real env vars
- Phoenix runtime compilation/tests, which still require an Elixir-capable environment

---

## Upgrade Notes

Upgrading from v11:

1. Replace `app/create/page.tsx` with the v12 version
2. No new migrations are needed
3. Run `npm run build`
4. Re-run the `/create` smoke checks, especially on mobile/tablet widths
