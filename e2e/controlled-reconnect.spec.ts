import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Opt-in replay of captured, test-owned production snapshots. This is a local
// frontend regression, NOT a fresh production game or persistence test. Never
// point this harness at production: it intercepts transport to control ordering.
const evidenceDir = process.env.QW_CONTROLLED_EVIDENCE_DIR;
const sessionDir = process.env.QW_CONTROLLED_SESSION_DIR;
const enabled = Boolean(evidenceDir && sessionDir);
const modes = ["classic", "survival", "team"] as const;

test.use({ trace: "off", screenshot: "off" });

test.describe("controlled host snapshot replay", () => {
  test.skip(!enabled, "Requires explicit captured test-account evidence/session paths");

  for (const mode of modes) for (const mixed of [false, true]) {
    for (const hostFirst of [false, true]) {
      test(`${mode} ${mixed ? "mixed" : "poll"}: ${hostFirst ? "delayed REST" : "same-revision host join"}`, async ({ browser, baseURL }) => {
        expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
        const evidence = JSON.parse(readFileSync(join(evidenceDir!, "controlled-results.json"), "utf8"));
        const secrets = JSON.parse(readFileSync(join(sessionDir!, "controlled-games.json"), "utf8"));
        const storage = JSON.parse(readFileSync(join(sessionDir!, "browser-state.json"), "utf8"));
        const game = evidence.games.find((g: { mode: string; mixed: boolean }) => g.mode === mode && g.mixed === mixed);
        const fixture = evidence.verification.games.find((g: { pin: string }) => g.pin === game.pin);
        const secret = secrets.games.find((g: { pin: string }) => g.pin === game.pin);
        storage.cookies = storage.cookies.map((cookie: Record<string, unknown>) => ({ ...cookie, domain: "127.0.0.1", secure: false }));
        const context = await browser.newContext({ storageState: storage });
        let aiAttempts = 0;
        let publicCompleted = false;
        let hostDelivered = false;
        try {
          await context.route("**/*", route => {
            if (/\/api\/ai-|openai|anthropic|openrouter|generativelanguage/.test(route.request().url())) {
              aiAttempts++;
              return route.abort();
            }
            return route.continue();
          });
          await context.addInitScript(value => {
            localStorage.setItem(`qw_host_session_${value.pin}`, JSON.stringify(value));
          }, { pin: game.pin, hostId: evidence.account, hostToken: secret.host_token, expiresAt: Date.now() + 3600000 });
          await context.route(`**/api/sessions/${game.pin}`, async route => {
            if (hostFirst) await new Promise(resolve => setTimeout(resolve, 2500));
            await route.fulfill({ json: { session: fixture.public }, headers: { "access-control-allow-origin": "*" } });
            publicCompleted = true;
          });
          await context.routeWebSocket("**/socket/websocket**", socket => {
            socket.onMessage(async message => {
              const [joinRef, ref, topic, event, payload] = JSON.parse(String(message));
              if (event === "phx_join") {
                await new Promise(resolve => setTimeout(resolve, 1000));
                const host = Boolean(payload.host_token);
                socket.send(JSON.stringify([joinRef, ref, topic, "phx_reply", { status: "ok", response: { session: host ? fixture.host : fixture.public } }]));
                if (host) hostDelivered = true;
              } else if (event === "heartbeat") {
                socket.send(JSON.stringify([joinRef, ref, topic, "phx_reply", { status: "ok", response: {} }]));
              }
            });
          });
          const page = await context.newPage();
          await page.goto(`${baseURL}/game/${game.pin}`);
          const ai = page.getByRole("button", { name: /Get AI Insights/ });
          await expect.poll(() => publicCompleted && hostDelivered).toBe(true);
          // Require repeated enabled observations after both deliveries, rather
          // than accepting transient enablement before a delayed REST update.
          let enabledObservations = 0;
          await expect.poll(async () => {
            enabledObservations = await ai.isEnabled() ? enabledObservations + 1 : 0;
            return enabledObservations;
          }, { intervals: [100, 250, 500] }).toBeGreaterThanOrEqual(3);
          expect(aiAttempts).toBe(0);
        } finally {
          await context.close();
        }
      });
    }
  }
});
