// Own and clean up a loopback-only Phoenix fixture. No production credentials/results.
const { spawn, spawnSync } = require("node:child_process");
const { resolve } = require("node:path");
const { existsSync, unlinkSync } = require("node:fs");
const { setTimeout: delay } = require("node:timers/promises");
async function main() {
  const url = "http://127.0.0.1:4187/api/health";
  if (
    await fetch(url).then(
      () => true,
      () => false,
    )
  )
    throw new Error(
      "Port 4187 is already occupied; refusing to use an unknown backend.",
    );
  const file = "/tmp/quizworld-mobile-fixture.json";
  if (existsSync(file)) unlinkSync(file);
  const server = spawn(
    "mix",
    ["run", "--no-start", "../../apps/mobile/scripts/live-fixture.exs"],
    {
      cwd: resolve(__dirname, "../../../services/quizworld_realtime"),
      stdio: "inherit",
      env: {
        ...process.env,
        MIX_ENV: "test",
        ERL_FLAGS: "+S 2:2",
        REDIS_URL: "",
        SUPABASE_URL: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
      },
    },
  );
  let launchError;
  server.on("error", (error) => {
    launchError = error;
  });
  try {
    let ready = false;
    for (let i = 0; i < 120; i++) {
      if (launchError) throw launchError;
      if (server.exitCode !== null)
        throw new Error("Fixture server exited before readiness.");
      if (
        existsSync(file) &&
        (await fetch(url).then(
          (r) => r.ok,
          () => false,
        ))
      ) {
        ready = true;
        break;
      }
      await delay(500);
    }
    if (!ready) throw new Error("Fixture server not ready within 60 seconds.");
    for (const args of [
      ["tsx", "--test", "scripts/live.integration.ts"],
      ["playwright", "test", "--config", "playwright.live.config.ts"],
    ]) {
      const result = spawnSync("npx", args, {
        cwd: resolve(__dirname, ".."),
        stdio: "inherit",
        env: process.env,
      });
      if (result.status !== 0)
        throw new Error(
          `Acceptance failed: ${args[0]} (status ${result.status})`,
        );
    }
  } finally {
    if (server.exitCode === null) {
      server.kill("SIGTERM");
      await new Promise((resolve) => server.once("exit", resolve));
    }
    if (existsSync(file)) unlinkSync(file);
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
