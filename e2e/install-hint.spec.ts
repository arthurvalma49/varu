import { expect, test } from "@playwright/test";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1";

test.describe("on an iPhone in Safari", () => {
  test.use({ userAgent: IPHONE_UA });

  test("the first screen explains how to add Varu to the home screen", async ({ page }) => {
    await page.goto("/");
    const hint = page.getByRole("region", { name: "Lisa avakuvale" });
    await expect(hint).toBeVisible();
    await expect(hint).toContainText("enne seadistamist");
    await hint.getByRole("button", { name: "Hiljem" }).click();
    await expect(hint).toBeHidden();
    await page.reload();
    await expect(page.getByRole("region", { name: "Lisa avakuvale" })).toBeHidden();
  });
});

test("desktop browsers without an install prompt see no hint", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Kui palju tunde/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Lisa avakuvale" })).toHaveCount(0);
});
