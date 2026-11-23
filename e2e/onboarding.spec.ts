import { expect, test } from "@playwright/test";
import { THURSDAY_9AM } from "./helpers";

test("first run: start screen, demo opens Täna with no tab bar", async ({ page }) => {
  await page.clock.setFixedTime(new Date(THURSDAY_9AM));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Kui palju võid veel puududa?" })).toBeVisible();
  await page.getByRole("button", { name: "RAM 9.b näidis" }).click();
  await expect(page.getByRole("heading", { name: "Täna", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await page.getByRole("button", { name: "Seaded" }).click();
  await page.getByRole("button", { name: "Täna" }).click();
  await expect(page.getByRole("heading", { name: "Täna", exact: true })).toBeVisible();
});

test("manual setup stays possible for schools without EduPage", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Alusta" }).click();
  await page.getByRole("button", { name: /Sisesta käsitsi/ }).click();
  await expect(page.getByRole("button", { name: "Vali ained" })).toBeVisible();
});

test("EduPage import finds the school's classes from a pasted link", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Alusta" }).click();
  for (const address of ["ramkool.edupage.org/timetable/", "ramkool"]) {
    await page.fill("#edu-address", address);
    await page.getByRole("button", { name: "Otsi" }).click();
    await expect(page.locator('select[aria-label="Klass"]')).toBeVisible();
  }
});
