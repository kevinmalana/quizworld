# Product and interface contracts

QuizWorld is for people bringing a group together around a quiz: friends, classes and teams. The current application language is English. User-authored content may use other scripts; display text must wrap, and system font fallbacks remain available. This is not a claim of complete localization.

## Visual language: World Stage

Cool paper for choosing and reading, ink navy for the shared game, lime for consequential actions and acknowledged selections. Locally hosted Bricolage Grotesque provides display hierarchy; DM Sans carries controls and reading text. Their OFL notices are in `public/fonts/`. No third-party font request is required. Both faces are preloaded; `font-display: optional` keeps a slow first visit on readable system fallbacks rather than shifting the PIN/hero after paint.

The design borrows **interaction priorities**, not content or assets, from documented [Mentimeter joining](https://www.mentimeter.com/features/live-polling), [Wayground participation](https://wayground.com/), and [Kahoot hosting](https://kahoot.com/): make entry obvious, distinguish presenter/player authority, and give the actual question more space than the surrounding chrome. The homepage SVG is original and illustrates the application's gather → play → reveal phases. It is an explanation, not an invented live room or a quiz with fake players/scores.

- One readable primary task per region; do not rebuild overlapping shelves or nested cards to make a page look populated.
- Body and question text must grow rather than be clipped to a fixed-height tile.
- Colors reinforce letters, text and selected state; they never carry correctness alone.
- Explanatory and transition motion is finite. Functional loading/countdown indicators can repeat; reduced motion suppresses animation while retaining information. There is no canvas/WebGL/video payload or continuous homepage animation loop.
- The marketing page can explain itself without JavaScript. Real live play requires JavaScript and a connection to Phoenix.

## Journey contracts

| Surface | Visitor's job | Must remain true |
| --- | --- | --- |
| Home | Join a known game, or find a quiz | Game PIN is available before marketing on a phone; presentation codes have their own explicit route. Guest play does not require an account. |
| Library | Find relevant real content | Search matches **titles/categories**, not unsupported keywords. One result grid, exact server count, preserved sorting/filtering/pagination, title → real detail. Topic families expand on demand. No weekly/curated/popular claims beyond the query's actual scope. |
| Detail | Decide how to use a quiz | Real question preview; Host, Solo and Study remain distinct paths. Protected actions retain the selected quiz across login. |
| Host setup | Configure a lobby | Classic, Survival and Team are actual engine options. Host-only and host-and-play remain explicit. Launch opens a lobby; it does not start the first question. |
| Join | Enter a PIN, then choose identity | Home has one pasteable PIN input; `/join` retains six labelled digit fields with paste support. Labelled nickname with Enter submission; named avatar controls with selected state; errors announced without clearing useful input. |
| Waiting room | See who is here and get ready | Real issued PIN and decodable QR, joined/ready state, long names, mode minimums. Host controls are separate from player Ready. A host who plays retains both capabilities. |
| Question | Read and submit one answer | Immediate submission semantics preserved. Optimistic selection says Sending; only authoritative own-answer evidence says Locked. Late/disconnected/uncertain states never claim a confirmed answer. |
| Reveal | Understand what happened | Correctness only after the authorized phase; polls remain explicitly unscored. Actual earned points and supplied explanations, never invented AI content. |
| Results | Understand outcome and choose next step | Own result before the podium when identity is present; mode-specific winners and real ranked scores. Private counts/history stay role-scoped. Reports and AI insights retain their existing auth/completeness gates. |

Study, presentation authoring/audience, profile, classroom, group, ranking and creation routes remain available in navigation. They inherit shared typography/control improvements but are not represented as fully redesigned workflows in this release.

## Accessibility and resilience

Native navigation dialog: focus containment, Escape and focus return. Skip link, visible focus, 44px minimum primary interaction targets. Search clear returns focus to the searchbox. No hover-only essential action. Phone PIN input must display all six characters without internal scrolling at 320px; checking document overflow alone is insufficient.

Test 320/360/390px phones, tablet and desktop, plus 200% zoom/reflow. Include long names/answers, loading, no results, query failure with retry, waiting/active/reveal/finished, uncertain submission, reconnect and expired credentials. Screen-reader acceptance announcements must not become a countdown announcement every second. Automated checks supplement—not replace—keyboard and visual inspection.

## Explicit non-goals

No invented room continuity, fake activity/popularity, new account requirement for guests, paid generation, new media subscriptions, database reset/migration, production CORS/CSP relaxation, or browser-authoritative scores. Do not add new unsupported pause/kick/settings controls merely to match a reference screenshot.
