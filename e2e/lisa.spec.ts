import { expect, test } from "@playwright/test";
import { absences, openDemo } from "./helpers";

test("Lisa shows lessons already logged as done and saves only the rest", async ({ page }) => {
  await openDemo(page);
  await page.getByRole("button", { name: /^Puudun: Hispaania/ }).click();
  await page.getByRole("button", { name: "Puudun mõlemast" }).click();
  await page.getByRole("button", { name: "Lisa puudumine" }).first().click();
  await expect(page.getByText("kirjas", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Salvesta" }).click();
  const saved = await absences(page);
  expect(saved).toHaveLength(2);
  expect(saved[1].lessons["hispaania-keel"]).toBeUndefined();
});

test("several days: tap first and last day, school days only are saved", async ({ page }) => {
  await openDemo(page);
  await page.getByRole("button", { name: "Lisa puudumine" }).first().click();
  await page.getByRole("switch", { name: "Mitu päeva" }).click();
  await page.getByRole("button", { name: /^E 23\. nov 2026/ }).click();
  await page.getByRole("button", { name: /^R 27\. nov 2026/ }).click();
  await page.getByRole("button", { name: "Planeeri" }).click();
  // Mon to Fri, without Tuesday (self-study for 9.b).
  expect((await absences(page)).map((a) => a.date)).toEqual(["2026-11-23", "2026-11-25", "2026-11-26", "2026-11-27"]);
});

test("several days: dragging across the calendar selects the range", async ({ page }) => {
  await openDemo(page);
  await page.getByRole("button", { name: "Lisa puudumine" }).first().click();
  await page.getByRole("switch", { name: "Mitu päeva" }).click();
  // Let the sheet and the calendar finish sliding open before reading positions.
  await page.waitForTimeout(900);
  const from = (await page.getByRole("button", { name: /^K 25\. nov 2026/ }).boundingBox())!;
  const to = (await page.getByRole("button", { name: /^E 30\. nov 2026/ }).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width * 2, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "K 25. nov – E 30. nov" })).toBeVisible();
});
