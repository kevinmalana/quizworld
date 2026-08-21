import { expect, test, type Page } from "@playwright/test";

const EMAIL = process.env.E2E_TEST_EMAIL || "";
const PASSWORD = process.env.E2E_TEST_PASSWORD || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

async function signIn(page: Page) {
  test.skip(!EMAIL || !PASSWORD, "Authenticated recovery fixture is not configured");
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

async function accessToken(page: Page) {
  return page.evaluate(() => {
    for (const [key, raw] of Object.entries(localStorage)) {
      if (!key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      try {
        const parsed = JSON.parse(raw) as { access_token?: string };
        if (parsed.access_token) return parsed.access_token;
      } catch {}
    }
    return null;
  });
}

async function deleteOwnedRow(page: Page, table: string, id: string) {
  if (!SUPABASE_URL || !ANON_KEY) return;
  const token = await accessToken(page);
  if (!token) return;
  await page.request.delete(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
  });
}

test.describe("authenticated recovery workflows", () => {
  test("dashboard exposes Continue, Open Snapshot, and Duplicate lifecycle actions", async ({ page }) => {
    const draftId = process.env.E2E_DRAFT_ID || "";
    const versionId = process.env.E2E_VERSION_ID || "";
    const quizId = process.env.E2E_QUIZ_ID || "";
    test.skip(!draftId || !versionId || !quizId, "Dashboard lifecycle fixtures are not configured");
    await signIn(page);
    await page.goto("/dashboard");
    await expect(page.locator(`a[href="/create?draft=${draftId}"]`)).toHaveText(/continue editing/i);
    await expect(page.locator(`a[href="/create?version=${versionId}"]`)).toHaveText(/open snapshot/i);
    await expect(page.locator(`a[href="/create?quiz=${quizId}&duplicate=1"]`).first()).toHaveText(/duplicate/i);
  });

  test("authenticated source generates, saves, and launches a presentation", async ({ page }) => {
    test.skip(process.env.E2E_RUN_AI !== "1", "Paid AI release probe is disabled");
    await signIn(page);
    await page.goto("/present?mode=ai&source=topic");
    await page.getByRole("textbox", { name: "Topic or brief", exact: true }).fill(
      "Explain the water cycle to Year 7 students with one poll and one knowledge-check quiz",
    );
    await page.getByRole("button", { name: /generate editable draft/i }).click();
    await expect(page).toHaveURL(/\/present\/[0-9a-f-]+\/edit\?generated=ai/, { timeout: 90_000 });
    const presentationId = page.url().match(/\/present\/([^/]+)\/edit/)?.[1];
    expect(presentationId).toBeTruthy();
    await expect(page.getByLabel("Audience view preview")).toBeVisible();
    await page.getByRole("button", { name: /present/i }).click();
    await expect(page).toHaveURL(/\/present\/.+\/live/, { timeout: 30_000 });
    await deleteOwnedRow(page, "presentations", presentationId!);
  });

  test("study-set draft autosaves, publishes, and opens study", async ({ page }) => {
    await signIn(page);
    await page.goto("/create?purpose=study");
    await page.getByRole("button", { name: /start from scratch/i }).click();

    const stamp = Date.now();
    await page.getByPlaceholder("Quiz title…").fill(`Recovery study set ${stamp}`);
    await page.getByPlaceholder("Type your question…").fill("Which answer verifies this recovery flow?");
    await page.getByPlaceholder("Answer A").fill("The persisted answer");
    await page.getByPlaceholder("Answer B").fill("A discarded answer");
    await page.locator(".builder-answer-marker").first().click();

    await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /publish/i }).click();
    await expect(page).toHaveURL(/\/study\/[0-9a-f-]+/, { timeout: 20_000 });
    const quizId = page.url().split("/study/")[1]?.split(/[?#]/)[0];
    expect(quizId).toBeTruthy();
    await deleteOwnedRow(page, "quizzes", quizId!);
  });

  test("presentation save returns canonical slides without clobbering a later edit", async ({ page }) => {
    await signIn(page);
    await page.goto("/present");
    const stamp = Date.now();
    await page.getByPlaceholder("New presentation title…").fill(`Recovery deck ${stamp}`);
    await page.getByRole("button", { name: /^create/i }).click();
    await expect(page).toHaveURL(/\/present\/[0-9a-f-]+\/edit/);
    const presentationId = page.url().match(/\/present\/([^/]+)\/edit/)?.[1];
    expect(presentationId).toBeTruthy();

    await expect(page.getByLabel("Audience view preview")).toBeVisible();
    const titleInput = page.getByRole("textbox").first();
    let releaseFirstSave!: () => void;
    const firstSaveGate = new Promise<void>((resolve) => { releaseFirstSave = resolve; });
    let delayed = false;
    await page.route("**/rest/v1/rpc/save_presentation_v2", async (route) => {
      if (!delayed) {
        delayed = true;
        await firstSaveGate;
      }
      await route.continue();
    });
    const firstSaveRequest = page.waitForRequest("**/rest/v1/rpc/save_presentation_v2");
    await titleInput.fill(`First title ${stamp}`);
    await firstSaveRequest;
    await titleInput.fill(`Latest title ${stamp}`);
    releaseFirstSave();
    await expect(titleInput).toHaveValue(`Latest title ${stamp}`);
    await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(titleInput).toHaveValue(`Latest title ${stamp}`);
    await deleteOwnedRow(page, "presentations", presentationId!);
  });
});
