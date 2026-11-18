/** Demo data for tester mode: a believable RAM 9.b half-year, relative to today. Pure TypeScript. */
import { maxAllowed, missableOn, nextSchoolDay, totals, withCancelled } from "./calc";
import { addDays } from "./dates";
import { ram9bTemplate } from "./templates";
import type { Absence, AppData, ISODate } from "./types";

export function demoData(today: ISODate): AppData {
  const setup = ram9bTemplate();
  const T = totals(setup);
  const max = (id: string) => maxAllowed(T[id] ?? 0, setup.rule);
  // One of each state: at the limit, over it, close, and calm.
  const want: Record<string, number> = {
    fuusika: max("fuusika"),
    "hispaania-keel": max("hispaania-keel") + 1,
    geograafia: max("geograafia") - 2,
    keemia: 4,
    matemaatika: 6,
    "inglise-keel": 3,
    muusika: 2,
  };
  const end = today > setup.windowEnd ? setup.windowEnd : addDays(today, -1);
  const byDay = new Map<ISODate, Record<string, number>>();
  for (let d = end; d >= setup.windowStart; d = addDays(d, -1)) {
    for (const b of missableOn(setup, d)) {
      const need = want[b.subjectId] ?? 0;
      if (need <= 0) continue;
      const take = Math.min(need, b.count);
      want[b.subjectId] -= take;
      const day = byDay.get(d) ?? {};
      day[b.subjectId] = (day[b.subjectId] ?? 0) + take;
      byDay.set(d, day);
    }
  }
  // Whatever the timetabled weeks could not hold goes into the earlier, hand-counted period
  // (absences count by date, a timetable is not needed): two lessons a week from late September.
  let d = addDays(setup.windowStart, 21);
  for (const [id, left] of Object.entries(want)) {
    for (let n = left; n > 0; n -= 2) {
      while (byDay.has(d) && byDay.get(d)![id]) d = addDays(d, 7);
      const day = byDay.get(d) ?? {};
      day[id] = (day[id] ?? 0) + Math.min(2, n);
      byDay.set(d, day);
      d = addDays(d, 7);
      if (d >= end) d = addDays(setup.windowStart, 22);
    }
  }
  const absences: Absence[] = [...byDay].map(([date, lessons], i) => ({
    id: `demo-${date}`,
    date,
    lessons,
    note: i === 2 ? "Haige, arsti juures" : undefined,
    createdAt: `${date}T08:00:00.000Z`,
  }));
  // A planned day next week and a cancelled lesson tomorrow-ish.
  const plan = nextSchoolDay(setup, addDays(today, 5));
  if (plan) {
    const lessons: Record<string, number> = {};
    for (const b of missableOn(setup, plan)) if (!/^(fuusika|hispaania-keel|geograafia)$/.test(b.subjectId)) lessons[b.subjectId] = (lessons[b.subjectId] ?? 0) + b.count;
    if (Object.keys(lessons).length) absences.push({ id: `demo-plan-${plan}`, date: plan, lessons, note: "Võistlus", createdAt: `${today}T08:00:00.000Z` });
  }
  const next = nextSchoolDay(setup, today);
  const first = next ? missableOn(setup, next)[0] : undefined;
  if (next && first) setup.cancelled = withCancelled(undefined, next, { [first.subjectId]: first.count });
  return { setup, absences, demo: true };
}
