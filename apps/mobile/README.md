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
# Deterministic E2E build with intercepted synthetic public-catalog fixtures.
# These are NOT live catalog credentials or live content evidence.
CI=1 EXPO_NO_DOTENV=1 EXPO_NO_TELEMETRY=1 EXPO_PUBLIC_SUPABASE_URL=https://quizworld-mobile-fixture.invalid EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_local_fixture_not_a_real_key npm run export:web
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

## Live games — same website PIN, same Phoenix authority

Study → **Join live game** opens native PIN/name/lobby/ready/question/answer/reveal/results screens, not a web wrapper. The default service is `https://quizworld-xs0g.onrender.com`, verified from deployed `www.quizworld.xyz` game-page assets. Hosting and classroom administration remain on the website; the app joins as a guest player without a host token. It does not calculate multiplayer scores/timing, award XP or write results.

Player ID/token are server-issued and saved separately from guest practice: Expo SecureStore on native, tab-scoped sessionStorage in the browser preview. Backgrounding suspends the connection; foregrounding reauthorizes the same identity. Phoenix reconnect restores snapshots. Duplicate taps are locked immediately; timed-out answers are uncertain and never automatically replayed. Finished games stop realtime activity. Invalid/closed/full games show actual server errors. Leaving forgets local identity, not the host's roster/history.

Android React Native otherwise supplies the backend URL as WebSocket Origin, which the existing Phoenix website-origin allowlist rejects. The native-only adapter supplies the canonical QuizWorld website Origin, without weakening backend checks or granting any role. Browsers retain their genuine Origin. Tests exercise that adapter against real isolated Phoenix with Node `ws`; **this is not Android/iOS installation evidence**.

HTTPS question/answer images render; embedded video is explicitly delegated to the host's screen for now. Classic gameplay has end-to-end local acceptance. Team and survival snapshots render their server fields, but full native mode/media/accessibility parity still requires device acceptance. No native countdown claims: the answer window and reveal are controlled by Phoenix.

### Deterministic isolated live acceptance

Requires the repository's Elixir/OTP toolchain and test dependencies (`MIX_ENV=test mix deps.get` in `services/quizworld_realtime`). No Redis, Supabase credentials, result writes or production games are used. Port 4187 must be free; the runner owns and stops only its fixture process. It refuses an already-running backend. Build the test web export first:

```sh
CI=1 EXPO_NO_DOTENV=1 EXPO_NO_TELEMETRY=1 EXPO_PUBLIC_GAME_SERVICE_URL=http://127.0.0.1:4187 EXPO_PUBLIC_SUPABASE_URL=https://quizworld-mobile-fixture.invalid EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_local_fixture_not_a_real_key npm run export:web
CI=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome npm run test:live
```

The protocol tests cover native-Origin transport, join/ready/answer/reconnect/reveal/finish and missing/closed/full games. Playwright exercises the actual mobile components and reload recovery against real Phoenix; host actions are real HTTP commands from the harness, **not the full website host UI**. Synthetic answer artwork is intercepted locally. Browser evidence and JS exports do not close native-device, secure-storage-on-device or full web-host-to-installed-app gates.

## Working scope

- Guest quickfire and self-assessed flashcards; explicit check/reveal/continue.
- Persisted checked-answer checkpoint, result history (last 100 sessions), saved revision-aware missed questions, deterministic 1/3/7-day retry schedule.
- Bundled samples support offline practice and review. Web preview uses browser storage; native uses AsyncStorage. The preview has no offline-installed PWA/service-worker guarantee.
- Local export and confirmed scoped device-data reset/removal; existing-account email/password sign-in and truthful unavailable billing.
- Navy/lime design with platform system fonts as the brief's permitted fallback. No fonts are downloaded as an offline prerequisite.

## Trust boundaries and unfinished work

Practice storage is unencrypted, identity-scoped, bounded, and not authoritative. It is **not SQLite**, server-authorized private content, paid entitlement evidence, verified XP, or classroom completion. When the personal RPC capability is confirmed, a metadata-only immutable outbox is saved atomically alongside new answers/removals. Checked answers are saved before state advances; unchecked selection is transient. A corrupt saved payload is not silently overwritten.

Public packs are convenience text caches, not licensed offline downloads. Starting/resuming/reviewing a public session, Study focus/foreground, and every answer/advance recheck current public access **and the full source revision** online. Pending, offline and error screens hide the question and offer retry/exit; current access is not a cloud-sync receipt. Bundled samples still work offline. Cached public questions are hidden in the unvalidated review list. **Account → Clear downloaded data** explicitly removes the current scope’s public checkpoint/reviews and all legacy local history titles, retains bundled practice and other accounts, and returns to Home. Clear failure is visible; stale callbacks cannot recreate cleared data. This is not forensic erasure or removal of exports/backups. Revocation checks occur at request boundaries, not continuously.

[Personal sync implementation and exact deployment proposal](docs/personal-sync-deployment.md) documents the additive migration and locally verified outbox → RPC receipt → cross-device review flow. Account offers Connect/Sync and a distinct confirmed cloud clear. Missing deployed capability fails closed as unavailable. Server-owned permanent generations block pre-clear uploads, and retry payloads are bound to immutable UUID receipts. No production migration/provider mutation was made. The official-completion bridge remains out of scope; local history is never replayed to the XP/classroom scoring RPC.

Missing store/commercial gates include installed-device auth/keychain acceptance, native MFA/social/email callback flows, deployed personal-sync and real-device acceptance, transactional licensed pack downloads, automatic restricted-content purge, verified real IAP/restore/manage, authenticated in-app account deletion, curated content rights/accuracy, privacy/store metadata, final app identifiers/icons, and physical Android/iOS QA. Generic Expo app metadata/icons remain placeholders. No purchase or deletion success is simulated.

Accessibility semantics, expanding answer rows, safe areas and disabled states exist, but VoiceOver/TalkBack, largest text, meaningful focus restoration and native back/lifecycle behavior still require device verification. The initial tab is labeled Home rather than the proposed Study. Sticky answer actions, review Skip, current-session-only review filtering, and all brief-level acceptance details are not complete. Existing free review is not paywalled.

## Verification and review

Recovery verification originally passed mobile TypeScript, 6 unique unit cases, one Chromium E2E and web/Android/iOS JS exports. Review removed duplicate fixture registration and added checked-answer corruption, storage bounds, public access/revocation, and revision/schedule coverage. The E2E suite also covers stale-detail revocation and explicit corrupt-storage reset. Synthetic catalog tests are not evidence of live content or backend authorization. Exact-head results are recorded in the review report, not inferred from earlier exports.

The separate path-scoped `.github/workflows/mobile.yml` installs this package and runs TypeScript/unit checks, a deterministic web export and local Chromium E2E, then Android/iOS JS exports serially with one worker. It requires no secrets or production backend. Root CI remains separate; a root green check is not mobile or signed-native evidence. Complete root checks are not run locally without root dependencies. The recovery dependency audit reported 10 moderate transitive advisories, no high/critical; review advisories again before release.

Independent standards/spec/security review is still required before merge. Do not merge or announce store availability based on these browser/export results. Local recovery evidence and exact source/artifact checksums are recorded in `/root/quizworld-mobile-build/IMPLEMENTATION.md` and sibling artifacts on the build host.

## Native accounts — bounded implementation, not production acceptance

Existing **email/password** accounts use the official Supabase client with only the public project URL and anon/publishable key. Service/secret keys are refused by the auth configuration guard. SDK browser persistence, URL token detection and background auto-refresh are disabled. A serialized controller owns login, rotation and logout; `getUser(access_token)` validates identity with the server before account practice is mounted. Accounts with verified MFA factors fail closed and must use the website until native challenges are implemented.

Only the refresh capability is persisted: native `expo-secure-store` with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`; access tokens/user responses remain in SDK memory. The web **test preview** deliberately uses tab-only sessionStorage and is not encrypted-native-storage evidence. SecureStore may survive iOS uninstall; no uninstall-erasure guarantee. Storage failures block authenticated UI and offer explicit retry/forget; a failed keychain deletion is not successful logout.

App resume and a foreground timer before expiry revalidate the session. While checking or after an authentication/network/storage error, the account/navigation subtree is removed: no cached account names, exported practice, mistakes or old async UI can bleed into guest/B. Revalidation conservatively returns to Study; saved checked-answer checkpoints remain resumable. Reopening an account offline requires reconnect/retry or explicit forget-to-guest; authenticated offline entitlement is **not** implemented. Personal sync requires a current session and a connection; it does not change content access rights.

Guest practice retains its original key and is **not merged**. Account practice uses an immutable `quizworld:account-study:v1:<server-user-id>` key; player reconnect capabilities also use per-account SecureStore keys. Signing out hides retained local practice rather than deleting unsynced work. Clear/export affects only the current scope. These are application identity boundaries, not encryption of practice data or protection against someone extracting/editing the app sandbox. Private/classroom content remains excluded.

Sign-out immediately hides account UI and serially clears local credentials before best-effort current-session (`scope: local`) server revocation. Other website sessions are unchanged. Network failure is disclosed; issued JWTs may remain valid until expiry under Supabase's normal logout semantics. No global revocation or account deletion is claimed.

### Provider and release boundary

No production settings changed and no test account was created or real user authenticated. Tests use synthetic HTTP/auth/storage fixtures. Existing website source supports email/password; live provider password settings, confirmed-account login and native secure storage must be accepted with a separately authorized disposable account and physical Android/iOS devices before release.

Password login needs **no native callback or redirect allowlist change**. This slice does not initiate signup, magic links, OAuth or reset emails, consume arbitrary deep links, or claim native password recovery. Account help opens `https://www.quizworld.xyz/login` in the browser; its existing website callback is `/auth/callback`. Future native email/OAuth flows need an approved app identifier/scheme or universal link, exact callback implementation, explicit provider allowlist review/configuration and real PKCE mailbox/device acceptance. No invented native redirect has been enabled.

Personal sync is implemented and tested locally, not deployed/production-accepted. Licensed offline packs, deletion backend, native MFA/social/email flows, billing/store signing/publishing and independent review are still open. This is **not core complete or production-ready**.

### Focused auth verification

`npm run check` includes controller races, server validation errors, lifecycle timers, public-only key validation, account-local repositories and a bundle of the **actual native adapter** with a mocked Expo SecureStore boundary. `npm run test:e2e` includes Account → practice → sign-out → B → A/reload/failed-session flows with intercepted synthetic Supabase transport, plus the real PracticeProvider under deferred native-storage fixtures. None is real-account or installed-device proof.

When changing public environment variables between fixture/native exports, add `--clear` to `expo export` to avoid Metro reusing previously inlined configuration. Auth E2E blocks every external request except the intercepted `.invalid` fixture, so a stale build cannot submit synthetic credentials to production. Do not publish the fixture export.
