import { expect, test } from "@playwright/test";
import { THURSDAY_9AM } from "./helpers";

test("intro, rule and tab tour lead to the start screen", async ({ page }) => {
  await page.clock.setFixedTime(new Date(THURSDAY_9AM));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Kui palju tunde/ })).toBeVisible();
  await page.getByRole("button", { name: "Jätka" }).click();
  await expect(page.getByRole("heading", { name: "Kuidas see arvutab" })).toBeVisible();
  await page.getByRole("button", { name: "Selge" }).click();
  await expect(page.getByRole("heading", { name: "Kus mis on" })).toBeVisible();
  await page.getByRole("button", { name: "Alusta" }).click();
  await page.getByRole("button", { name: "RAM 9.b näidis" }).click();
  await expect(page.getByRole("heading", { name: "Täna", exact: true })).toBeVisible();
});

test("EduPage import finds the school's classes from a pasted link", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Jäta vahele" }).click();
  await page.getByRole("button", { name: /Seadista oma klass/ }).click();
  await page.getByRole("button", { name: "Edasi" }).click();
  for (const address of ["ramkool.edupage.org/timetable/", "ramkool"]) {
    await page.fill("#edu-address", address);
    await page.getByRole("button", { name: "Otsi" }).click();
    await expect(page.locator('select[aria-label="Klass"]')).toBeVisible();
  }
});
