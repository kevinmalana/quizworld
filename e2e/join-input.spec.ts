import { expect, test } from "@playwright/test";

test.describe("Join PIN entry", () => {
  test("typing a six-character PIN fills every cell and enables joining", async ({ page }) => {
    await page.goto("/join");

    const cells = page.locator('input[aria-label^="PIN character"]');
    await expect(cells).toHaveCount(6);

    for (const [index, value] of ["A", "B", "C", "2", "3", "4"].entries()) {
      await cells.nth(index).fill(value);
    }

    await expect
      .poll(() => cells.evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value)))
      .toEqual(["A", "B", "C", "2", "3", "4"]);
    await expect(page.getByRole("button", { name: "Enter Game" })).toBeEnabled();
  });
});
