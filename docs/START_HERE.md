# QuizWorld — Start Here

**Production:** https://www.quizworld.xyz
**Repo:** github.com/kevinmalana/quizworld
**Last verified:** 2026-05-19

---

## Required Reading (in order)

1. **CURRENT_AGENT_HANDOFF.md** — current state, deploy pattern, blockers
2. **ENGINEERING_HANDBOOK.md** — architecture, schema, conventions (if diving deep)

That's it. Other docs are historical or supplementary.

---

## Quick Reference

**Stack:** Next.js 16 + React 19 + Phoenix/Elixir + Supabase + Redis

**Tests:**
```bash
npm run check           # TypeScript + Phoenix
npx playwright test     # E2E (production)
```

**Deploy:**
```bash
git push origin main    # GitHub
vercel deploy --prod    # Production
```

**Secrets:** `/root/.openclaw/secrets/`

---

## What This App Is

- Quiz builder (manual, paste, AI-generated)
- Study mode (flashcard, quickfire)
- Live multiplayer games (Phoenix WebSocket)
- Social layer (friends, classrooms, groups)
- Gamification (XP, achievements, leaderboards)

---

## Historical Docs (ignore unless needed)

- `V6_*.md`, `V8_*.md`, `V9_*.md`, `V11_*.md`, `V12_*.md` — outdated releases
- `QUIZWORLD_HANDOFF_2026-05-07.md` — superseded by CURRENT_AGENT_HANDOFF.md
- `PHOENIX_V2_HANDOFF.md` — historical handoff

Do not update historical docs to describe current behavior.
