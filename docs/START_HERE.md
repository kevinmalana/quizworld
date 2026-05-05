# Start Here

This is the authoritative entrypoint for the current QuizWorld `v12` architecture.

## Read Order

1. [V12_RELEASE.md](./V12_RELEASE.md)
2. [V9_RELEASE.md](./V9_RELEASE.md) for historical v9 rollout context
3. [PHOENIX_V2_HANDOFF.md](./PHOENIX_V2_HANDOFF.md)
4. [V9_CONTRACT.md](./V9_CONTRACT.md) for the service-boundary contract that still informs the current split
5. [HANDBOOK.md](./HANDBOOK.md)
6. [ARCHITECTURE.md](./ARCHITECTURE.md)
7. [BUSINESS_DOCUMENTATION.md](./BUSINESS_DOCUMENTATION.md)
8. [USE_CASES.md](./USE_CASES.md)
9. [TECHNICAL_DOCUMENTATION.md](./TECHNICAL_DOCUMENTATION.md)
10. [STYLE_GUIDE.md](./STYLE_GUIDE.md)
11. [DEV_GUIDE.md](./DEV_GUIDE.md)
12. [TESTING_GUIDE.md](./TESTING_GUIDE.md)
13. [BA_GUIDE.md](./BA_GUIDE.md)
14. [QUIZ_BUILDER_AGENT_HANDOVER.md](./QUIZ_BUILDER_AGENT_HANDOVER.md)
15. [../OPENCLAW_DEPLOY_HANDOVER.md](../OPENCLAW_DEPLOY_HANDOVER.md)
16. [../services/quizworld_realtime/README.md](../services/quizworld_realtime/README.md)

## What The App Is

QuizWorld v12 is:

- a Next.js frontend for auth, content, dashboard, study, and profile
- a Supabase-backed content/auth layer
- a Phoenix realtime service for live multiplayer sessions
- an optional Redis-backed state cache for the Phoenix service
- a builder workflow with drafts, versioning, archive/visibility controls, source import, and AI-assisted review
- a responsive builder that now works cleanly on mobile/tablet without losing timing, scoring, or preview controls

## What To Ignore Unless You Need History

These files are historical:

- [V8_4_RELEASE.md](./V8_4_RELEASE.md)
- [V8_3_RELEASE.md](./V8_3_RELEASE.md)
- [V8_2_RELEASE.md](./V8_2_RELEASE.md)
- [V8_1_RELEASE.md](./V8_1_RELEASE.md)
- [V6_CHANGELOG.md](./V6_CHANGELOG.md)
- [V6_DESIGN_SYSTEM.md](./V6_DESIGN_SYSTEM.md)

They should stay historical. Do not “update” them to describe current behavior.
