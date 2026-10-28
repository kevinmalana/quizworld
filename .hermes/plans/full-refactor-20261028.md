# QuizWorld full staged refactor — 2026-10-28

## Goal and approved outcome

Kevin approved a full refactor and evidence-backed improvements while doing it. Cover the entire product's contracts and regression surface, improving weak modules rather than rewriting healthy ones for file-count/line-count targets. Preserve existing features, data and Phoenix authority.

Base: production/main `487a7c2b6c65ca920344c03fc50d93a2f7fc8b26`. Audit: `/root/quizworld-evidence/audit-20261028/REPORT.md`. Integration branch: `refactor/full-product-20261028` at `/root/projects/quizworld-refactor-20261028`. Canonical checkout and its untracked user files remain untouched.

## Boundaries

Kevin subsequently authorized deployment on 2026-10-28, after the candidate is complete, integrated, tested and independently reviewed. GitHub/Vercel release writes are authorized for that verified candidate, not for the unfinished partial work. No paid API calls, new pricing policy, automatic account deletion, data resets or hosted schema/policy changes. Do not invent usage, remove retained QA history, weaken private access or move multiplayer scoring/results into React. Any trusted-play provenance redesign needing new persistence remains an explicit follow-up, not a silently fabricated fix. Preserve legacy-engine refusal/config behavior while deleting only code unreachable behind it.

## Implementation stages

1. **Presentation runtime/recovery** — explicit disconnect notification, pending-command/uncertain-outcome handling, stale socket fencing; one run/slide-aware snapshot application rule; prevent previous input reaching a new slide. Reproduce first with actual transport and React fixtures. Child owns presentation-only paths.
2. **Game route and shared command contracts** — remove unreachable legacy reads/subscriptions/commands while preserving rejection gates; deepen orchestration/command outcome seams; use stable reasons rather than English copy for control flow. Keep all private identity/epoch and authoritative-acceptance safeguards. Parent owns game/join/engine-client paths.
3. **Product/operations contract improvements** — correct unsupported library/usage/comparison claims; label legacy play-counter provenance rather than imply verified completions; fix safe admin return intent and improve authorized operator data contracts without loosening RLS; make docs reflect deployed durable quota/checkpoint/result handling. Separate child owns these paths.
4. **Cross-product consistency sweep** — inspect authoring/autosave, study, classrooms/groups, presentation editing, reports and social/auth siblings against changed seams. Refactor only where a concrete duplication or bug warrants it; add missing regressions. Preserve the independently useful existing modules.
5. **Integration and verification** — review child diffs, integrate exact local commits, typecheck merged tree, run quality + complete frontend + production build + Phoenix gates sequentially, focused UI/keyboard/mobile and privacy/uncertain-result probes. No missing-browser skip; record explicit system-Chrome adapter if used. Test persisted state only in isolated environments; no production fixture writes.
6. **Independent review and release** — read-only reviewer of exact integrated commit, resolve confirmed defects, rerun affected/full gates as needed; refresh authoritative docs. Push the candidate through PR/CI, verify merged-tree parity, deploy under the owner's explicit approval, read back the production SHA/alias and run a read-only live smoke. Record release/rollback handles and explicit remaining limitations.

## Parallel ownership

All children start from the same base with separate worktrees. No install into shared node_modules, push, PR, deploy, hosted migration or credential output. Presentation and product-contracts changes are disjoint; the parent handles game flows and final docs integration. Children run targeted checks; the parent owns the serialized full merged gate on this constrained host.

## Acceptance

- Both reproduced presentation failures have meaningful RED-to-GREEN coverage.
- Supported live-game/public/private and guest flows remain compatible; no replay of uncertain writes.
- Shared logic earns its seam; no generic recovery framework or duplicate styling layer.
- Marketing/metrics do not invent supply/adoption; the old public play counter is not relabelled as a verified completion.
- No schema/dependency/environment/credential changes without recorded justification and approval of external effects.
- All required local gates pass on the integrated tree; independent review has a concrete verdict; unproven live/auth/load/email/provider acceptance is stated explicitly.
- Canonical branch and user files, production identities, accounts, history and data remain preserved.
