# QuizWorld v9 Developer Onboarding

## Start Here

1. [docs/START_HERE.md](./docs/START_HERE.md)
2. [docs/V9_RELEASE.md](./docs/V9_RELEASE.md)
3. [docs/HANDBOOK.md](./docs/HANDBOOK.md)
4. [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
5. [docs/DEV_GUIDE.md](./docs/DEV_GUIDE.md)

## What Changed In v9

- Live gameplay now has a dedicated Phoenix service boundary.
- Supabase remains the source of truth for auth and content.
- Frontend game-engine config now lives in `lib/game-engine/`.
- The repo is no longer a single deployable if you want the full v9 architecture.

## Important Constraint

This workspace does not currently have Elixir/Phoenix tooling installed, so Phoenix code changes must be validated in an Elixir-capable environment.
