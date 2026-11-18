import type { ISODate, Weekday } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISO(ds: ISODate): Date {
  const [y, m, d] = ds.split("-").map(Number);
  return new Date(y, m - 1, d, 12); // noon avoids DST edge cases
}

export function addDays(ds: ISODate, k: number): ISODate {
  const d = parseISO(ds);
  d.setDate(d.getDate() + k);
  return toISO(d);
}

export function weekdayOf(ds: ISODate): number {
  return parseISO(ds).getDay(); // 0 = Sunday
}

export function isSchoolWeekday(n: number): n is Weekday {
  return n >= 1 && n <= 5;
}

/** Inclusive list of dates from a to b. */
export function eachDay(a: ISODate, b: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = a; d <= b; d = addDays(d, 1)) out.push(d);
  return out;
}

export function today(): ISODate {
  return toISO(new Date());
}

export function isValidISO(ds: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) return false;
  return toISO(parseISO(ds)) === ds;
}
