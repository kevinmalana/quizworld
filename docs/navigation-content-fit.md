# Navigation content-fit correction

Follow-up to candidate `c6bfc625ae0aa0f9d2f6bb76d41723b72e8be247` and its independent signed-in overflow blocker.

- Use the existing native navigation dialog below **960px**, rather than enabling seven inline destinations at 768px. At 960px the full logo, destinations and five admin controls fit without shrinking text or targets. Host remains the second menu destination, or an inline desktop link.
- Remove obsolete tablet compression declarations: later `.nav-item` rules overrode their padding/font changes anyway.
- Restore the intended phone account-link placement in the dialog below 640px with sufficient selector specificity. Generic `a[href]` had forced duplicate inline account links back into the header, causing text overlap at 320px. No destination is removed; Profile, Dashboard, Admin and Sign Out are explicitly tested in the dialog.
- Keep Notifications visible on phones: it has no duplicate menu destination. No auth, routing, sign-out or game logic is changed.

## Regression evidence

`e2e/navigation-boundaries.spec.ts` bundles the real Navigation and NotificationBell components, substituting only auth/data/router/link integration seams. Candidate production HTML supplies its real compiled CSS/fonts. These are **local role fixtures**, not authenticated browser sessions or proof of completed account actions. Every external browser origin is blocked for these fixtures.

Guest/member/admin are checked at 320/390, 639/640/641, 767/768, 959/960/961 and 1440. Assertions include full control bounds, center hit testing, text-range logo clearance, expected destinations, keyboard traversal with scrolling, native dialog opening/Escape/focus return, and early Host placement. Chromium's browser-chrome focus stop is allowed, but background header focus is not. No geometry assertion was weakened.

Failing-before member/admin768 receipts reproduce viewport overflow. Subsequent strict phone tests exposed missing Notifications and visual inspection exposed logo text overlap despite passing element-box checks; additional failing-before receipts cover both. Final source has only this stylesheet fix, the regression file, and this rationale.

Evidence lives outside the repository at `/root/quizworld-ux-polish-evidence/navigation-fix/`; original independent receipts remain untouched. No push/deploy, production sessions, or game mutations. Candidate uses the intentionally invalid game-service URL; inherited production QA is not candidate acceptance.
