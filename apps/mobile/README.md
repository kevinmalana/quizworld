# QuizWorld mobile — development study companion

An isolated Expo 57 / React Native client, not a web wrapper and **not a store-ready release**. Existing Next.js and Phoenix applications are unchanged; the root TypeScript configuration excludes this separately installed application.

## Run locally

Use Node 22.19+ (verified here with 22.23.2). Dependencies have their own lockfile; this is not an npm workspace.

```sh
cd apps/mobile
npm ci
npm run check
# Optional public catalog: copy .env.example to ignored .env.local and supply
# only the public project URL and anon/publishable key. No service-role keys.
EXPO_NO_TELEMETRY=1 NODE_OPTIONS=--max-old-space-size=768 npm run export:web
npm run preview
# http://127.0.0.1:8085 — loopback only
```

The samples require no configuration, sign-in, network, or payment. The public library is opt-in, uses anonymous GET requests to public/unarchived quizzes, and rejects unsupported/media/multiple-correct-answer packs. Public community content is not a reviewed exam bank.

```sh
# Install Chromium separately if necessary; no production E2E targets.
# Set PLAYWRIGHT_CHROMIUM_EXECUTABLE to an existing Chrome if using one.
CI=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome npm run test:e2e
# Stop a manually started preview before CI E2E: Playwright owns its server.

# Export platform-specific JS/Hermes bytecode/assets, serially, one worker.
# Different directories prevent overwriting the web preview.
EXPO_NO_TELEMETRY=1 NODE_OPTIONS=--max-old-space-size=768 npx expo export --platform android --max-workers 1 --output-dir /tmp/quizworld-export-android
EXPO_NO_TELEMETRY=1 NODE_OPTIONS=--max-old-space-size=768 npx expo export --platform ios --max-workers 1 --output-dir /tmp/quizworld-export-ios

# Metro for separately provisioned test devices:
npm start
```

Exports are **not APK/AAB/IPA files**, signed applications, device tests, or proof of App Store/Play approval. No EAS/cloud build or developer-account purchase is required by the commands above. Development signing, native toolchains and device setup are separate gates.

## Working scope

- Guest quickfire and self-assessed flashcards; explicit check/reveal/continue.
- Persisted checked-answer checkpoint, result history (last 100 sessions), saved revision-aware missed questions, deterministic 1/3/7-day retry schedule.
- Bundled samples support offline practice and review. Web preview uses browser storage; native uses AsyncStorage. The preview has no offline-installed PWA/service-worker guarantee.
- Local export and confirmed device-data reset/removal; truthful unavailable native authentication/billing.
- Navy/lime design with platform system fonts as the brief's permitted fallback. No fonts are downloaded as an offline prerequisite.

## Trust boundaries and unfinished work

Local storage is unencrypted, guest-only, bounded, and not authoritative. It is **not SQLite**, an immutable sync outbox, an authenticated cache, paid entitlement evidence, verified XP, or classroom completion. Checked answers are saved before state advances; unchecked selection is transient. A corrupt saved payload is not silently overwritten.

Public packs are cached as personal text snapshots, not licensed permanent offline downloads. Starting a saved public review or resuming a public session rechecks visibility online. Ongoing sessions do not continuously recheck access. Revocation does not yet automatically purge previously cached text: manual removal/reset remains available. Do not use this prototype for private/classroom/student records or a commercial offline catalog.

Missing store/commercial gates include native auth/secure token storage, account isolation, sync APIs and conflict handling, transactional licensed pack downloads, automatic restricted-content purge, verified real IAP/restore/manage, authenticated in-app account deletion, curated content rights/accuracy, privacy/store metadata, final app identifiers/icons, and physical Android/iOS QA. Generic Expo app metadata/icons remain placeholders. No purchase or deletion success is simulated.

Accessibility semantics, expanding answer rows, safe areas and disabled states exist, but VoiceOver/TalkBack, largest text, meaningful focus restoration and native back/lifecycle behavior still require device verification. The initial tab is labeled Home rather than the proposed Study. Sticky answer actions, review Skip, current-session-only review filtering, and all brief-level acceptance details are not complete. Existing free review is not paywalled.

## Verification and review

Recovery verification produced: mobile TypeScript pass; 7 passing unit test invocations (6 unique cases because the storage test imports the model test's fixture); 1 Chromium E2E pass covering guest practice, mistake persistence/reload, resume, offline retry and truthful account; web, Android and iOS exports pass. A separate 390×844 browser check captured real screenshots and loaded 20 live public catalog rows using GET-only requests with zero page errors.

The existing root CI does not install or run this package's checks. Run mobile commands explicitly. Root quality passed using the mobile TypeScript module via `NODE_PATH`; complete root web typecheck/build was not run in the recovery worktree because root dependencies are not installed. Root config parsing verified zero mobile files in the web TypeScript file list. The saved dependency audit reports 10 moderate transitive advisories, no high/critical; no forced incompatible Expo downgrade was applied.

Independent standards/spec/security review is still required before merge. Do not merge or announce store availability based on these browser/export results. Local recovery evidence and exact source/artifact checksums are recorded in `/root/quizworld-mobile-build/IMPLEMENTATION.md` and sibling artifacts on the build host.
