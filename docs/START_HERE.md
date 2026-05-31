# QuizWorld — Start Here

**Production:** https://www.quizworld.xyz  
**Repo:** github.com/kevinmalana/quizworld (branch: `main`)  
**Last verified:** 2026-05-31

---

## Required Reading (in order)

1. **`docs/CURRENT_AGENT_HANDOFF.md`** — current state, architecture, deploy pattern, known issues. Read this first.
2. **`docs/ENGINEERING_HANDBOOK.md`** — deeper architecture, schema, conventions (if diving into DB or game engine)

---

## ⚠️ Critical: Don't Touch This

`/root/.openclaw/workspace/quizworld_v12_push` — **dead old snapshot**. Never edit or deploy from it.

All work goes in `/root/.openclaw/workspace/quizworld` on `main`.

---

## Quick Reference

**Stack:** Next.js 15 + React 19 + Phoenix/Elixir + Supabase + Redis

**Build & test:**
```bash
npm run build              # must pass before deploy
npx playwright test        # E2E against production
```

**Deploy frontend:**
```bash
source /root/.openclaw/secrets/deployment.env
vercel deploy --prod --token "$VERCEL_TOKEN" --yes --archive=tgz
```

**Deploy Phoenix:** Push to GitHub `main` → Render auto-deploys.  
Render Root Directory must be set to `services/quizworld_realtime`.

**Secrets:** `/root/.openclaw/secrets/`

---

## What This App Is

- Quiz builder (manual, paste, URL, AI-generated)
- Study mode (flashcard, quickfire, progress tracking)
- Live multiplayer games: Classic, Survival, Team Battle (Phoenix WebSocket)
- Presentation mode (slide-style quiz delivery)
- Social layer (friends, classrooms, groups, leaderboard, achievements)
- Post-game reports + AI insights

---

## Historical Docs (ignore unless debugging old issues)

- `CHANGESET_HANDOVER_2026-03-31.md`, `HANDOVER_V5.md`, `OPENCLAW_DEPLOY_HANDOVER.md` — outdated
- `AUDIT-2026-05-19.md` — prior audit
- `AUDIT_REPORT.md` — 2026-05-31 full audit (21 bugs, most fixed)

Do not update historical docs to describe current behaviour.
