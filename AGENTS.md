# QuizWorld Agent Rules

This repo is production software. Optimize for clear ownership, small changes, and verifiable behavior.

## Current Source Of Truth

- Start with `docs/CURRENT_AGENT_HANDOFF.md`, then `docs/START_HERE.md`.
- Historical release docs are context only. Do not make them describe current behavior.
- Active Phoenix backend source is only `services/quizworld_realtime/`.
- Public production alias is `https://www.quizworld.xyz`.

## Non-Negotiable Guardrails

- Do not grow large route files when a feature component or helper module is the right home.
- Do not add broad inline styles to app routes or complex components. Prefer route CSS files or small shared UI components.
- Do not add new `any` at Supabase, Phoenix, presentation, or AI boundaries unless a type-safe adapter is impractical and the reason is documented.
- Do not weaken E2E assertions to only check visibility when behavior can be asserted.
- Do not deploy without a local gate and a production smoke plan.
- Do not revive deleted duplicate Phoenix folders or old preview/mock routes.
- Do not leave docs claiming a verification state that has not been run.

## Preferred Architecture

- App routes should orchestrate data/loading and compose components.
- Reusable UI belongs in `components/**`.
- Pure conversion/validation belongs in `lib/**`.
- AI provider calls and AI policy should live outside API route handlers where possible.
- Route-specific styling belongs in `styles/*.css`; repeated controls should become shared components.

## Required Checks

Before claiming a code change is done:

```bash
npm run quality
npm run check
```

For production-affecting UI or flow changes, also run:

```bash
BASE_URL=https://www.quizworld.xyz npx playwright test --reporter=line
```

For high-risk live game changes, run an authenticated host plus second-browser/mobile player smoke test through finish/leaderboard.

## Completion Report

Every agent making changes should report:

- Files changed
- Tests/checks run
- Local vs production status
- Docs updated or not needed
- Known risks and next cleanup target

