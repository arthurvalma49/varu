import { expect, test } from "@playwright/test";
import { absences, openDemo } from "./helpers";

test("Juba puudutud tunnid saves one starting entry and can clear it", async ({ page }) => {
  await openDemo(page);
  await page.getByRole("button", { name: "Seaded" }).click();
  await page.getByRole("button", { name: "Ajalugu" }).click();
  await page.getByRole("button", { name: "Juba puudutud tunnid" }).first().click();
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Matemaatika: rohkem" }).click();
  await page.getByRole("button", { name: "Valmis" }).click();
  let saved = await absences(page);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ id: "start-2026-09-01", lessons: { matemaatika: 3 } });

  await page.getByRole("button", { name: "Juba puudutud tunnid" }).first().click();
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Matemaatika: vähem" }).click();
  await page.getByRole("button", { name: "Valmis" }).click();
  saved = await absences(page);
  expect(saved).toEqual([]);
});
