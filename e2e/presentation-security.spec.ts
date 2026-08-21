import { expect, request, test } from "@playwright/test";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const PHOENIX_URL = process.env.E2E_PHOENIX_URL || process.env.NEXT_PUBLIC_GAME_SERVICE_URL || "";

function requireEnv(values: Array<[string, string]>) {
  const missing = values.filter(([, value]) => !value).map(([name]) => name);
  test.skip(missing.length > 0, `Missing ${missing.join(", ")}`);
}

function containsAnswerKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsAnswerKey);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(([key, child]) =>
    ["is_correct", "isCorrect", "correct_answer", "correctAnswer", "answer_key", "answerKey"].includes(key)
      || containsAnswerKey(child)
  );
}

test.describe("presentation security recovery", () => {
  test("anonymous REST cannot read slides, responses, or Q&A", async () => {
    requireEnv([["NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL], ["NEXT_PUBLIC_SUPABASE_ANON_KEY", ANON_KEY]]);
    const context = await request.newContext({
      extraHTTPHeaders: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });

    for (const table of ["slides", "slide_responses", "qna_questions"]) {
      const response = await context.get(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`);
      expect(response.status(), `${table} request`).toBe(200);
      expect(await response.json(), `${table} rows`).toEqual([]);
    }
    await context.dispose();
  });

  test("public Phoenix snapshots recursively omit answer keys", async ({ request: api }) => {
    const presentationId = process.env.E2E_PRESENTATION_ID || "";
    requireEnv([["E2E_PHOENIX_URL", PHOENIX_URL], ["E2E_PRESENTATION_ID", presentationId]]);
    const response = await api.get(`${PHOENIX_URL}/api/presentations/${presentationId}`);
    expect(response.ok()).toBeTruthy();
    const payload = await response.json();
    expect(containsAnswerKey(payload)).toBe(false);
  });

  test("participant joins the current run and sees server-owned visibility", async ({ page }) => {
    const joinCode = process.env.E2E_PRESENTATION_JOIN_CODE || "";
    requireEnv([["E2E_PRESENTATION_JOIN_CODE", joinCode]]);
    await page.goto(`/present/join?code=${encodeURIComponent(joinCode)}`);
    await page.getByPlaceholder(/your name/i).fill(`Security check ${Date.now()}`);
    await page.getByRole("button", { name: /join/i }).click();
    await expect(page).toHaveURL(/\/present\/.+\/live/);
    await expect(page.locator("body")).not.toContainText(/is_correct|correct_answer|answer_key/);
    await expect(page.getByText(/results hidden/i)).not.toBeVisible();
  });

  test("two browsers synchronize poll visibility and server-owned quiz reveal", async ({ browser }) => {
    const enabled = process.env.E2E_PRESENTATION_INTERACTION_FIXTURE || "";
    const presentationId = process.env.E2E_PRESENTATION_ID || "";
    const runId = process.env.E2E_PRESENTATION_RUN_ID || "";
    const presenterToken = process.env.E2E_PRESENTER_TOKEN || "";
    const joinCode = process.env.E2E_PRESENTATION_JOIN_CODE || "";
    requireEnv([
      ["E2E_PRESENTATION_INTERACTION_FIXTURE", enabled],
      ["E2E_PRESENTATION_ID", presentationId],
      ["E2E_PRESENTATION_RUN_ID", runId],
      ["E2E_PRESENTER_TOKEN", presenterToken],
      ["E2E_PRESENTATION_JOIN_CODE", joinCode],
    ]);

    const hostContext = await browser.newContext();
    await hostContext.addInitScript(({ id, token, run }) => {
      localStorage.setItem(`qw_presenter_token_${id}`, JSON.stringify({ token, runId: run }));
    }, { id: presentationId, token: presenterToken, run: runId });
    const host = await hostContext.newPage();
    await host.goto(`/present/${presentationId}/live`);
    await host.keyboard.press("Escape");
    await expect(host.getByText(/results visible/i)).toBeVisible();

    const participantContext = await browser.newContext();
    const participant = await participantContext.newPage();
    await participant.goto(`/present/join?code=${encodeURIComponent(joinCode)}`);
    await participant.getByPlaceholder(/your name/i).fill(`Two browser ${Date.now()}`);
    await participant.getByRole("button", { name: /join/i }).click();
    await expect(participant.locator(".present-poll-option").first()).toBeVisible();
    await participant.locator(".present-poll-option").first().click();

    await host.getByRole("button", { name: "Hide", exact: true }).click();
    await expect(host.getByText(/results hidden/i)).toBeVisible();
    await expect(participant.locator(".present-poll-result").first()).toContainText("Hidden");

    await host.getByRole("button", { name: /next/i }).click();
    await expect(participant.locator(".present-quiz-option").first()).toBeVisible();
    await participant.locator(".present-quiz-option").first().click();
    await host.getByRole("button", { name: /reveal answers/i }).click();
    await expect(participant.locator(".present-quiz-option.is-correct")).toBeVisible();

    await participantContext.close();
    await hostContext.close();
  });
});
