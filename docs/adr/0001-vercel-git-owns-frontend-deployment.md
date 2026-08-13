# ADR 0001: Vercel Git integration owns frontend deployment

- Status: Accepted
- Date: 2026-08-13

## Context

Vercel's Git integration already deploys pushes to `main`. GitHub Actions also contained a second production deployment using `amondnet/vercel-action`, but the required token was not configured. The native deployment succeeded while the workflow reported failure, creating conflicting operational signals.

## Decision

Vercel's Git integration is the only automated frontend deployment path.

GitHub Actions owns verification only: typecheck, quality checks, build, Phoenix tests and browser tests. It does not deploy to Vercel.

## Consequences

- One push creates one production frontend deployment.
- A missing GitHub Actions Vercel token cannot mark an otherwise healthy release as failed.
- Vercel deployment status remains visible through its GitHub status and Vercel dashboard.
- If deployment ownership changes later, this ADR must be replaced rather than adding a second active path.
