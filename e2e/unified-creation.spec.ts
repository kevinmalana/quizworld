import { expect, test } from "@playwright/test";

test.describe("unified creation", () => {
  test("AI quiz and presentation generation require authentication", async ({ request }) => {
    const [presentation, quiz] = await Promise.all([
      request.post("/api/ai-presentation-draft", {
        data: {
          sourceMode: "topic",
          sourceText: "A detailed introduction to the solar system",
          slideCount: 8,
        },
      }),
      request.post("/api/ai-source-draft", {
        data: { sourceMode: "topic", sourceText: "The solar system", questionCount: 5 },
      }),
    ]);

    expect(presentation.status()).toBe(401);
    expect(quiz.status()).toBe(401);
    await expect(presentation.json()).resolves.toMatchObject({ error: expect.stringMatching(/sign in/i) });
    await expect(quiz.json()).resolves.toMatchObject({ error: expect.stringMatching(/sign in/i) });
  });

  test("creation hub carries output and source choices into authoring", async ({ page }) => {
    await page.goto("/create/activity");
    await expect(page.getByRole("heading", { name: /what do you want to create/i })).toBeVisible();
    await page.getByRole("button", { name: /study set/i }).click();
    await page.getByRole("button", { name: /document/i }).click();
    await expect(page.getByRole("link", { name: /continue with document/i })).toHaveAttribute(
      "href",
      "/create?source=document&purpose=study",
    );
    await page.getByRole("button", { name: /^Presentation / }).click();
    await page.getByRole("button", { name: /^Deck / }).click();
    await expect(page.getByRole("link", { name: /continue with deck/i })).toHaveAttribute(
      "href",
      "/present?mode=import&source=deck",
    );
  });

  test("global Create action opens the output-first hub", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation").getByRole("link", { name: "Create", exact: true })).toHaveAttribute(
      "href",
      "/create/activity",
    );
  });

  test("quiz source dialogs are semantic and Escape-closeable", async ({ page }) => {
    await page.goto("/create");
    await page.getByRole("button", { name: /ai from topic/i }).click();
    const dialog = page.getByRole("dialog", { name: /ai topic generator/i });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("quiz conversion requires authentication", async ({ request }) => {
    const response = await request.post("/api/quizzes/not-a-quiz/convert-presentation");
    expect(response.status()).toBe(401);
  });

  test("public quizzes can be reused as presentations", async ({ page }) => {
    await page.goto("/explore");
    await expect(page.getByText("Loading quizzes...")).toBeHidden({ timeout: 20_000 });
    const quizLink = page.locator('a[href^="/quiz/"]').first();
    await expect(quizLink).toBeVisible({ timeout: 10_000 });
    const quizHref = await quizLink.getAttribute("href");
    expect(quizHref).toMatch(/^\/quiz\//);
    await page.goto(quizHref!);
    await expect(page.getByRole("button", { name: /turn into presentation/i })).toBeVisible();
  });

  test("AI presentation mode explains the editable generation workflow", async ({ page }) => {
    await page.goto("/present?mode=ai");
    await expect(page.getByRole("heading", { name: /generate an interactive presentation/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Topic or brief", exact: true })).toBeVisible();
    const source = page.getByLabel("Source");
    await expect(source).toBeVisible();
    await expect(source.locator("option")).toHaveText(["Topic or brief", "Document text", "Web page URL", "Template"]);
    await expect(page.getByRole("button", { name: /generate editable draft/i })).toBeVisible();
    await expect(page.getByText(/review every slide before presenting/i)).toBeVisible();
  });
});
