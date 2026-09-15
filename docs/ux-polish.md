# UX polish: easier entry, clearer choices, complete results

## Scope and rationale

This is an incremental implementation in the existing World Stage application, not a prototype or a rebrand. Preserve paper/navy/lime, local fonts, the interactive round illustration, canonical quiz routes, anonymous participation and backend authority. No assets, dependencies, auth contracts or game-engine rules are added.

Fresh anonymous production captures of home, Explore, Join and Host informed the first four changes. Separate production multiplayer QA identified the report defect; no QA credentials or retained records are used by this implementation.

1. **Choose the main task faster.** Loaded Explore cards previously repeated Host, Play, Study, Share and View details. Keep Host and View details prominent; place solo play, study and share under native, keyboard-accessible More options. The canonical links and selected quiz ID are unchanged. This follows the existing product contract of one primary task per region, rather than adding another promotional shelf.
2. **Find hosting without hunting.** Host was missing from desktop navigation and buried after ten mobile destinations. It now sits beside Join in both contexts. All other destinations, native dialog dismissal and focus return remain available.
3. **Understand the joining step and recover honestly.** Replace the oversized controller emoji with Step 1 of 2, explain where the PIN comes from and that nickname selection comes next, reassure anonymous players, and expose the presentation entry link. Lookup failures no longer universally blame a nonexistent room: only the backend's documented not-found message does. Keep the entered PIN and associate the feedback with its inputs. No automatic mutation retries, auth changes or PIN routing changes.
4. **Know what sign-in leads to.** Host entry now confirms when quiz intent exists and explains setup → invite → start, without claiming a quiz has been fetched or validated. Primary actions precede the instructional steps on narrow screens. Existing `prepareHostLogin` preserves the exact selected quiz through both the login URL and session storage. Opening a lobby is explicitly not starting a game.
5. **Show the sole winner.** Production QA found Overview's Top Players blank with one participant. Render available podium positions instead of slicing players before remapping indices. Preserve second/first/third desktop ordering, actual score sorting, medals and single gold bar. Zero, one, two, three and four-player SSR regressions exercise the real report component; no persisted data or ranking rules change.

## Verification boundaries

`e2e/ux-polish.spec.ts` requires a loopback base URL, aborts game-session requests by default and uses anonymous public catalog reads. It tests card disclosure and canonical destinations, join recovery, desktop/mobile host navigation, and exact selected-quiz login intent. It does not complete login or create a live room.

`lib/report-podium-ui.test.ts` renders the actual `GameReport` with explicitly local fixtures. Existing cross-runtime report tests additionally exercise actual Phoenix-produced report payloads.

Evidence, screenshots, exact candidate SHA/build ID, red/green receipts and final gate results are recorded outside Git in `/root/quizworld-ux-polish-evidence/REPORT.md`. Candidate builds use an intentionally non-resolving game-service URL; this verifies the UI, not production connectivity. No deployment or production mutation is authorized by this change.

## Deliberately not claimed

No competitor superiority claim, full accessibility certification, physical-device keyboard test, exhaustive authenticated navigation layout, or full multiplayer re-acceptance. The separate live QA is evidence of the existing product, not candidate-build acceptance. Follow-up product ideas should earn their own evidence rather than expanding this bounded polish into another redesign.
