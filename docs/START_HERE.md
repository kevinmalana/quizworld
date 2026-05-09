# Start Here

This is the authoritative entrypoint for the current QuizWorld production architecture. Older release docs still mention v9/v12 for history; start with the current handoff first.

## Read Order

1. [CURRENT_AGENT_HANDOFF.md](./CURRENT_AGENT_HANDOFF.md) — current source map, deploy pattern, verification baseline
2. [V12_RELEASE.md](./V12_RELEASE.md)
3. [V9_RELEASE.md](./V9_RELEASE.md) for historical v9 rollout context
4. [PHOENIX_V2_HANDOFF.md](./PHOENIX_V2_HANDOFF.md)
5. [V9_CONTRACT.md](./V9_CONTRACT.md) for the service-boundary contract that still informs the current split
6. [HANDBOOK.md](./HANDBOOK.md)
7. [ARCHITECTURE.md](./ARCHITECTURE.md)
8. [BUSINESS_DOCUMENTATION.md](./BUSINESS_DOCUMENTATION.md)
9. [USE_CASES.md](./USE_CASES.md)
10. [TECHNICAL_DOCUMENTATION.md](./TECHNICAL_DOCUMENTATION.md)
11. [STYLE_GUIDE.md](./STYLE_GUIDE.md)
12. [DEV_GUIDE.md](./DEV_GUIDE.md)
13. [TESTING_GUIDE.md](./TESTING_GUIDE.md)
14. [BA_GUIDE.md](./BA_GUIDE.md)
15. [QUIZ_BUILDER_AGENT_HANDOVER.md](./QUIZ_BUILDER_AGENT_HANDOVER.md)
16. [../OPENCLAW_DEPLOY_HANDOVER.md](../OPENCLAW_DEPLOY_HANDOVER.md)
17. [../services/quizworld_realtime/README.md](../services/quizworld_realtime/README.md)

## What The App Is

QuizWorld is:

- a Next.js frontend for auth, content, dashboard, study, and profile
- a Supabase-backed content/auth layer
- a Phoenix realtime service for live multiplayer sessions
- an optional Redis-backed state cache for the Phoenix service
- a builder workflow with drafts, versioning, archive/visibility controls, source import, and AI-assisted review
- a responsive, componentized builder that works cleanly on mobile/tablet without losing timing, scoring, or preview controls

## Current Cleanup/Component Map

The 2026-05-09 cleanup pass moved most large route JSX into components. Future agents should keep route files as containers and put reusable UI in:

- `components/builder/` for `/create` builder UI and source modals
- `components/game/` for `/game/[pin]` live-game panels
- `components/study/` for study hall/session cards and panels
- `components/dashboard/` for dashboard cards
- `components/explore/` for explore quiz cards
- `styles/builder.css`, `styles/game.css`, `styles/present.css`, `styles/study.css` for route-specific CSS

Main verification gate: `npm run check`, then `BASE_URL=https://www.quizworld.xyz npx playwright test --project=chromium` before/after deploy.

## What To Ignore Unless You Need History

These files are historical:

- [V8_4_RELEASE.md](./V8_4_RELEASE.md)
- [V8_3_RELEASE.md](./V8_3_RELEASE.md)
- [V8_2_RELEASE.md](./V8_2_RELEASE.md)
- [V8_1_RELEASE.md](./V8_1_RELEASE.md)
- [V6_CHANGELOG.md](./V6_CHANGELOG.md)
- [V6_DESIGN_SYSTEM.md](./V6_DESIGN_SYSTEM.md)

They should stay historical. Do not “update” them to describe current behavior.
