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
  await expect(page.getByRole("heading", { name: /Kui palju võid/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Lisa avakuvale" })).toHaveCount(0);
});

const cases: { name: string; ua: string; expect: RegExp }[] = [
  {
    name: "Instagram's built-in browser on iPhone says to open the link in Safari first",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0.0",
    expect: /Instagrami sees.*„Ava Safaris”/,
  },
  {
    name: "Snapchat on Android says to open the link in the browser",
    ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 Snapchat/13.0",
    expect: /Snapchati sees.*„Ava brauseris”/,
  },
  {
    name: "Chrome on iPhone points to its Share button or menu",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1",
    expect: /menüüs.*„Lisa avakuvale”.*Safaris/,
  },
  {
    name: "Firefox on Android points to its menu",
    ua: "Mozilla/5.0 (Android 14; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0",
    expect: /menüü.*„Paigalda”/,
  },
];

for (const c of cases) {
  test.describe(c.name, () => {
    test.use({ userAgent: c.ua });
    test("shows the right steps", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("region", { name: "Lisa avakuvale" })).toContainText(c.expect);
    });
  });
}
