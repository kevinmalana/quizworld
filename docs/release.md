# Release and rollback gates

A feature branch is not a released product. Main is deployment-triggering; an independent reviewer must approve the exact integrated candidate before merge. CI, a READY provider record, HTTP reachability and real user-flow acceptance are separate signals.

## Before merge

- Pin remote `main`, candidate SHA, backend SHA and the currently deployed frontend/backend identities. Preserve unrelated worktrees and user changes.
- Review the actual engine diff and run backend formatting, warnings-as-errors compile and ExUnit **before** integration. Re-run on the integrated tree.
- Run all deterministic stages in the README and focused browser regressions against a production build. Inspect actual phone/desktop screenshots and raw measurements.
- Complete real isolated multiplayer acceptance as described in [development.md](development.md), including composed host/player roles and public/private data boundaries. Document disabled persistence, local CSP bypass, missing production credentials and any unverified flow explicitly.
- Independent business-aware review should cover guest entry, selected-quiz login return, real discovery labels/counts, host-only/host-playing/minimum players, submission acknowledgement vs optimistic state, poll neutrality, result privacy, reconnect and consequential actions. Do not turn a recommendation into a silent additional release scope.
- Re-fetch upstream and re-run relevant gates if the base or candidate changes. The reviewed SHA must be the pushed/merged candidate; no unreviewed fixup after approval.

## Deployment order and controls

GitHub Actions verifies code; Vercel Git integration owns the frontend deployment, and Render owns Phoenix from `services/quizworld_realtime`. Do not create a second frontend deployment path.

For backend-dependent frontend work, release the reviewed backwards-compatible backend first, verify its build identity and health/capabilities, then release the frontend that consumes it. If both integrations watch main, explicitly control this with reviewed backend-only and frontend changes or provider deployment controls; do not assume service build timing supplies the order. Schema changes are a separate reviewed migration workflow, not part of a visual refactor.

Read back exact external targets after writes:

1. Remote main/PR merge identity and required CI conclusions.
2. Render deployment/build SHA, health status and expected capabilities; verify browser-origin compatibility without weakening CORS.
3. Vercel deployment SHA, state and aliases, then actual public alias HTTP response. A protected raw preview URL is not itself an outage.
4. Browser smoke beyond `/`: entry, real catalog/detail, guest host/login destination, invalid-room handling, navigation/320px PIN regression, and release-authorized realtime acceptance.
5. Compare each stylesheet served by actual routes with the candidate's generated CSS bytes/hash; chunk names can change between environments. Confirm local font assets load and no CSP/JS exception appears on the public alias.

A local isolated game does not prove production durable results/CSV or Redis failover. Those need their own authorized checks. State exactly which tests were not run; do not describe a small local load probe as production capacity.

## Optional analytics release checks

- QuizWorld uses measurement ID `G-1YJEL65QPS`, not a numeric stream ID. A stream configured with `https://quizworld.xyz` also receives hits from the canonical `https://www.quizworld.xyz`; the stream URL is not a hostname access-control rule. The non-www site redirects to www. Do not change Google property settings as part of a code deployment.
- Only resolved signed-out visitors who explicitly confirm adult status and opt in load analytics, on `/`, `/kahoot-alternative`, `/aws-practice-test`. The old essential-cookie acknowledgement is not analytics consent. Every signed-in account is excluded rather than trying to infer a safe student/teacher role.
- The Google tag runs in a disposable empty same-origin frame, with no app forms, links, searches, titles or history. This is a measurement-context/lifetime boundary, **not a security sandbox against malicious Google code** (same-origin is required for working GA cookies). Do not place Google in the app root or send raw URLs/DOM values into the frame. Its only input is a validated fixed public page label. On unmount the documented `ga-disable-…` flag is set before destroying the document; revocation also clears only owned host-only cookies.
- Enhanced Measurement may remain **ON**. It observes the empty frame, not the app: standard app form/search/download/video/outbound-click tracking is deliberately unavailable. Automatic frame scroll/engagement events may appear and must not be interpreted as app engagement. `send_page_view: false` suppresses configuration pageviews, not all enhanced events. Manual `page_view` uses only canonical constant locations/titles and an empty referrer; no duplicate default pageview is intended.
- Ads consent remains denied, `allow_google_signals` and `allow_ad_personalization_signals` are false. This does not attest to Google Admin settings, retention, reporting timezone/currency or dashboard receipt. The public notice discloses pseudonymous session cookies, technical/IP processing and withdrawal. No User-ID, account/student identity or behavioural local-storage log is created.
- Run the local fixture suite (network stub), and separately perform an authorized real Google network smoke: denied => no Google requests; opt-in => actual `/g/collect` HTTP response for the exact ID with fixed `dl`/`dt`, empty `dr`; malformed query/hash/referrer/title absent; private SPA transition and revocation => no further requests. A 200 tag download alone is not collection proof. Repeat against the production alias only after approved merge/deployment, not before.
- An opaque `sandbox="allow-scripts"` frame was not a working GA transport: the tag loaded but emitted no collect request. Do not substitute it without real collection proof. Never claim an isolated frame supplies full application Enhanced Measurement.

Official configuration references (check again when updating Google integration):
- [GA4 configuration fields](https://developers.google.com/analytics/devguides/collection/ga4/reference/config): manual page fields, `send_page_view`, signals and cookie scope/lifetime.
- [Consent implementation](https://developers.google.com/tag-platform/security/guides/consent): consent before config and ads consent types. This integration blocks the loader entirely before opt-in; it does not send denied-consent pings.
- [Privacy controls](https://developers.google.com/tag-platform/security/guides/privacy#disable-analytics): `ga-disable-MEASUREMENT_ID` stops cookie writes/sending before teardown.
- [Enhanced Measurement](https://support.google.com/analytics/answer/9216061): automatic events and the history-based pageview distinction.

## Rollback

Record the known-good SHA and provider deployment IDs before release. If the new application fails, stop dependent rollout stages, revert the reviewed production merge or restore the approved provider deployment, then verify frontend alias/backend identity, health and relevant flows again. A successful revert command is not a recovery receipt.

The World Stage candidate has no schema migration, paid generation or production data cleanup. Never delete games/results/history as a release rollback. Database reversal, when necessary for another release, requires a reviewed forward migration rather than destructive reset.

## Evidence shape

Use external CI/evidence artifacts for time-specific logs/screenshots, not an accumulating in-repository status diary. A final receipt should name: exact candidate/base/live identities; changed product scope; deterministic counts; browser scenario results; screenshot/contrast/performance checks; isolated-vs-production boundaries; independent reviewer/approval; deployment readback; remaining blockers. Do not use “world-class”, “all green” or “fully verified” as a substitute for those receipts.
