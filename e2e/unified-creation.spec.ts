import { expect, test } from "@playwright/test";

test.describe("unified creation", () => {
  test("AI presentation generation requires authentication", async ({ request }) => {
    const response = await request.post("/api/ai-presentation-draft", {
      data: {
        sourceMode: "topic",
        sourceText: "A detailed introduction to the solar system",
        slideCount: 8,
      },
    });

    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringMatching(/sign in/i) });
  });

  test("creation hub offers quiz and presentation paths", async ({ page }) => {
    await page.goto("/create/activity");
    await expect(page.getByRole("heading", { name: /what do you want to create/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /create a quiz/i })).toHaveAttribute("href", "/create");
    await expect(page.getByRole("link", { name: /create a presentation/i })).toHaveAttribute("href", "/present?mode=ai");
  });

  test("global Create action opens the output-first hub", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation").getByRole("link", { name: "Create", exact: true })).toHaveAttribute(
      "href",
      "/create/activity",
    );
  });

  test("AI presentation mode explains the editable generation workflow", async ({ page }) => {
    await page.goto("/present?mode=ai");
    await expect(page.getByRole("heading", { name: /generate an interactive presentation/i })).toBeVisible();
    await expect(page.getByLabel(/topic or brief/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /generate editable draft/i })).toBeVisible();
    await expect(page.getByText(/review every slide before presenting/i)).toBeVisible();
  });
});
