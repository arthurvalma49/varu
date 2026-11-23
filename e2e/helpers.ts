import type { Page } from "@playwright/test";

/** A Thursday in RAM 9.b's term, mid-morning (Tallinn time). */
export const THURSDAY_9AM = "2026-11-19T09:00:00+02:00";

/** Opens the app at a fixed time and loads the RAM 9.b example timetable. */
export async function openDemo(page: Page, at = THURSDAY_9AM) {
  await page.clock.setFixedTime(new Date(at));
  await page.goto("/");
  await page.getByRole("button", { name: "RAM 9.b näidis" }).click();
}

export interface StoredAbsence {
  id: string;
  date: string;
  lessons: Record<string, number>;
}

export const absences = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("varu:v1")!).absences as StoredAbsence[]);
export const cancelled = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("varu:v1")!).setup.cancelled ?? {});
