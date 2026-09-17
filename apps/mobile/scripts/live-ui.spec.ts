import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const credentials = JSON.parse(
  readFileSync("/tmp/quizworld-mobile-fixture.json", "utf8"),
);
test("native-rendered UI plays a real isolated Phoenix game and restores after reload", async ({
  page,
  request,
}) => {
  await page.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.href === "https://quizworld-fixture.invalid/answer.svg")
      return route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="30" fill="navy"/></svg>',
      });
    return ["127.0.0.1", "localhost"].includes(u.hostname)
      ? route.continue()
      : route.abort();
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const calls: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") calls.push(r.url());
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Join live game", exact: true })
    .click();
  await page.getByLabel("Game PIN", { exact: true }).fill("APP002");
  await page
    .getByRole("button", { name: "Continue to name", exact: true })
    .click();
  await page
    .getByLabel("Player name", { exact: true })
    .fill("Mobile UI tester");
  await page.getByRole("button", { name: "Join game", exact: true }).click();
  await expect(
    page.getByText("You’re in the lobby.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "I’m ready", exact: true }).click();
  await expect(
    page.getByText("Ready — waiting for the host.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("live-lobby.png") });
  const host = async (action: string) => {
    const res = await request.post(
      `http://127.0.0.1:4187/api/sessions/APP002/${action}`,
      { data: { host_token: credentials.APP002 } },
    );
    expect(res.ok()).toBe(true);
  };
  await host("start");
  await expect(
    page.getByLabel("Answer 1 illustration", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Correct fixture answer", exact: true })
    .click();
  await expect(
    page.getByText("Correct — confirmed by the game.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("live-reveal.png") });
  await page.reload();
  await page
    .getByRole("button", { name: "Join live game", exact: true })
    .click();
  await expect(
    page.getByText("Correct — confirmed by the game.", { exact: true }),
  ).toBeVisible();
  await host("advance");
  await expect(
    page.getByText("Local acceptance question 2", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Other fixture answer", exact: true })
    .click();
  await expect(
    page.getByText("Not this time — confirmed by the game.", { exact: true }),
  ).toBeVisible();
  await host("advance");
  await expect(page.getByText("Game complete.", { exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("live-finished.png") });
  expect(errors).toEqual([]);
  expect(calls.every((u) => u.startsWith("http://127.0.0.1:4187/"))).toBe(true);
});
