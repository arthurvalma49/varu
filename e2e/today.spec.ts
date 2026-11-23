import { expect, test } from "@playwright/test";
import { absences, cancelled, openDemo } from "./helpers";

test("Puudun logs a lesson exactly once, and Kirjas can take it back", async ({ page }) => {
  await openDemo(page);
  await page.getByRole("button", { name: /^Puudun: Ühiskonna/ }).click();
  expect((await absences(page)).map((a) => a.lessons)).toEqual([{ uhiskonnaopetus: 1 }]);

  await page.getByRole("button", { name: /Ühiskonnaõpetus: kirjas, muuda/ }).click();
  await page.getByRole("button", { name: "Eemalda puudumine", exact: true }).click();
  expect(await absences(page)).toEqual([]);
});

test("a double lesson can be skipped by halves", async ({ page }) => {
  await openDemo(page);
  await page.getByRole("button", { name: /^Puudun: Hispaania/ }).click();
  await page.getByRole("button", { name: /Puudun tunnist 09:00/ }).click();
  expect((await absences(page))[0].lessons).toEqual({ "hispaania-keel": 1 });
});

test("Tund jääb ära marks a lesson cancelled and Taasta restores it", async ({ page }) => {
  await openDemo(page);
  await page.getByRole("button", { name: "Muud valikud: Matemaatika" }).click();
  await page.getByRole("button", { name: "Tund jääb ära", exact: true }).click();
  expect((await cancelled(page))["2026-11-19"]).toEqual({ matemaatika: 2 });
  await page.getByRole("button", { name: "Taasta" }).click();
  expect((await cancelled(page))["2026-11-19"] ?? {}).toEqual({});
});

const firstSection = (page: import("@playwright/test").Page) => page.locator("section h2").nth(1);

test("today stays until its last lesson ends, then tomorrow takes over", async ({ page }) => {
  await openDemo(page, "2026-11-19T15:30:00+02:00");
  await expect(firstSection(page)).toHaveText(/^Täna, N 19\. nov/);
});

test("after the last lesson the next school day is shown", async ({ page }) => {
  await openDemo(page, "2026-11-19T16:15:00+02:00");
  await expect(firstSection(page)).toHaveText(/^Homme, R 20\. nov/);
});

test("a self-study day stays on today with its own message", async ({ page }) => {
  await openDemo(page, "2026-11-24T10:00:00+02:00");
  await expect(page.getByRole("heading", { name: "Täna on iseõpe." })).toBeVisible();
});
