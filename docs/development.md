# Frontend development and verification

Read the [domain context](../CONTEXT.md) before changing behavior and [product contracts](product-design.md) before changing presentation. Engine-specific architecture and its known limitations live in [engine/README.md](engine/README.md).

## Presentation ownership

- `app/globals.css`: foundation tokens, reset, existing cross-product utilities and global navigation/account controls.
- `styles/primitives.css`: named small shared typography/form/navigation primitives.
- `styles/home.css`, `styles/explore.css`, `styles/game.css`: route-specific composition. Explore also owns the quiz-detail split.
- `components/game/PlayerIdentityForm.tsx`: controlled, accessible identity form. It owns no auth or join request.
- `components/game/PlayerAnswerGrid.tsx`: selected/sending/acknowledged state and accessible answer targets. The route passes authoritative own-answer evidence; selection alone is not acknowledgement.
- `components/game/RoundPreview.tsx`: a local explanatory illustration, completely separate from multiplayer state.
- `WaitingLobbyPanel` and `GameFinishedPanel`: render roles and real derived results; they do not create players, allocate teams, persist scores or mutate engine state.
- `app/game/[pin]/page.tsx`: remains the orchestration boundary. Its complexity is an acknowledged follow-up seam, not an excuse to rewrite the working engine into React.

Do not add another skin override stylesheet. Change the owner, run its regressions, then remove superseded selectors/imports. The former warm skin was removed; duplicated Explore globals moved to its owner. Other historical global utilities remain and must be removed only after their callers are verified. `SectionCard` remains available for unrelated routes; discovery deliberately uses semantic flat regions instead of nesting it around every grid/control.

## Deterministic gates

```sh
npm run quality
npm run typecheck
npm run test:unit
npm run build
npm run check:phoenix
```

These are the same stages as `npm run check`. Supply the documented build environment from `.env.example`; public runtime URLs are embedded at build time. `ERL_FLAGS='+S 2:2'` can constrain Erlang schedulers in small CI/local environments without changing product behavior. Phoenix dependencies must be installed even for the TypeScript suite's cross-runtime report test.

Focused browser checks against a **running candidate build**:

```sh
BASE_URL=http://127.0.0.1:3000 npx playwright test \
  e2e/play-studio.spec.ts e2e/warm-ui.spec.ts \
  e2e/warm-lobby-layout.spec.ts e2e/join-input.spec.ts e2e/host-layout.spec.ts
```

The older `warm-*` test names retain useful PIN/search/QR regressions; they no longer load the deleted skin. `warm-lobby-layout` renders the real component via a separate `node --import tsx` process because Playwright's JSX transform is not React SSR. It is a layout check, **not multiplayer proof**.

Tests for changed contracts include native identity submission/name/avatar labeling, selected/sending/unconfirmed answer status, honest catalog counts/search behavior, mobile navigation, no duplicate shelves, early real library content, and compact cookie dismissal. Red tests must fail for the missing behavior before implementation; do not accept a broken import as the only behavioral evidence.

## Real isolated multiplayer acceptance

Never point loopback tests at production games or relax production CORS/CSP to make them pass.

1. Use fresh password authentication for an explicitly authorized dedicated test identity; validate exact Supabase project/user and read existing **owned private** quiz fixtures. Do not replay historical room credentials.
2. Start candidate Phoenix with a harness outside the repository using `MIX_ENV=test mix run --no-start`. Before startup configure loopback-only Endpoint, exact local origins, `TestGameStore`, `redis_url: nil`, real `Auth`/`QuizLoader`, and a local result-sync adapter whose `persist_finished_game/1` explicitly returns `{:error, :local_acceptance_persistence_disabled}`. Never return fabricated persistence success.
3. Build Next with the actual local `NEXT_PUBLIC_GAME_SERVICE_URL`; run that production build. Production CSP may reject insecure loopback transports. A **loopback-only isolated Playwright context** may use `bypassCSP: true`; record that boundary. It proves the local protocol/application flow, not production policy connectivity.
4. Fresh host login → actual launch response → issued PIN/host credential → separate guest contexts → Ready/start/answer/reveal/finish. Run host-only and host-playing separately, polls plus scored questions, nonvoters and mode minimums. Store newly issued credentials only in private mode-0600 files outside Git/evidence.
5. Observe real WebSocket frames without replacement. Confirm no pre-reveal correctness, own-only player answers/counts, and host-only history. Reload finished host/player pages and compare nonempty authoritative `question_history`, `correct_counts`, and `updated_at`; navigation away is not a roster-removal API.
6. Check invalid credentials, local expiry, same-identity new tabs, offline/reconnect, and full Survival/Team UI outcomes. Block AI/provider endpoints and assert **zero attempts**. AI eligibility may be tested; a provider call is not needed.
7. Wait for QR image decode before screenshot; decode the actual screenshot and compare its exact canonical URL/PIN. The QR can retain the production join origin even for a local room: **do not follow it into production**.

This setup uses real Supabase auth/quiz reads; it is not an offline database emulator. Disabled persistence means it does **not** verify production durable reports/CSV, Redis restart recovery or production service health. Keep those as separately named release gates.

## Visual, accessibility and performance receipts

Capture and inspect actual home/library/detail/host/join/lobby/question/locked/reveal/results screens. Enumerate viewport results in a machine-readable file, assert expected count, and inspect screenshots—not only `scrollWidth`. Test 320/360/390/768/1440 CSS px, keyboard and 200% CSS zoom plus narrow reflow. Label CSS zoom honestly rather than claiming a physical-device/browser-menu test.

Use reduced motion to confirm zero running decorative animations, and a normal-motion capture before/after the interactive phase change. Run automated contrast/name checks plus manual focus/contrast checks on the **actual dark question stage**; a token-pair table alone is not a WCAG certification.

Compare production builds with the same browser, fresh context, route, viewport and cache policy. Record LCP/CLS and decoded JS/CSS bytes separately from transfer size. Local unthrottled samples are not field Core Web Vitals or a benchmark guarantee. Candidate budgets: CLS ≤0.1, no route-level JS increase >5% from the pinned baseline, no decorative raster/video payload added to entry, and first library result before 700px on a 390px phone. Store raw measurements and failures, not invented percentile labels.
