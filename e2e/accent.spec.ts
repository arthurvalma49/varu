import { expect, test } from "@playwright/test";
import { openDemo } from "./helpers";

test("accent colour defaults to cyan and can be changed in Seaded", async ({ page }) => {
  await openDemo(page);
  const accent = () => page.evaluate(() => document.documentElement.dataset.accent ?? "blue");
  expect(await accent()).toBe("cyan");
  await page.getByRole("button", { name: "Seaded" }).click();
  await page.getByRole("radio", { name: "Sinine" }).click();
  expect(await accent()).toBe("blue");
  await page.reload();
  expect(await accent()).toBe("blue");
});
