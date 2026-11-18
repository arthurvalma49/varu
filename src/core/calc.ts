import { addDays, eachDay, isSchoolWeekday, weekdayOf } from "./dates";
import type {
  Absence,
  Fraction,
  ISODate,
  Lesson,
  Rule,
  Segment,
  Setup,
  Status,
  SubjectRow,
  Weekday,
} from "./types";

/**
 * Most absences allowed while staying within the rule.
 * gte (fail at limit): largest a with a/T < num/den  -> floor((T*num - 1) / den)
 * gt  (fail above):    largest a with a/T <= num/den -> floor(T*num / den)
 * Integer math only, so 1/3 and 25% are exact.
 */
export function maxAllowed(total: number, rule: Rule): number {
  if (total <= 0) return 0;
  const { num, den } = rule.limit;
  const v = rule.mode === "gte" ? Math.floor((total * num - 1) / den) : Math.floor((total * num) / den);
  return Math.max(0, v);
}

export function fractionToPct(f: Fraction): number {
  return (f.num / f.den) * 100;
}

/** One threshold table for every screen: 0 left is its own state because the next miss fails. */
export function statusOf(left: number): Status {
  return left < 0 ? "over" : left === 0 ? "edge" : left <= 2 ? "warn" : "ok";
}

export function segmentFor(setup: Setup, ds: ISODate): Segment | null {
  return setup.segments.find((s) => ds >= s.start && ds <= s.end) ?? null;
}

/** Lesson blocks on a date (empty on weekends, holidays, outside segments). */
export function lessonsOn(setup: Setup, ds: ISODate): Lesson[] {
  const wd = weekdayOf(ds);
  if (!isSchoolWeekday(wd)) return [];
  if (setup.holidays.includes(ds)) return [];
  if (ds < setup.windowStart || ds > setup.windowEnd) return [];
  const seg = segmentFor(setup, ds);
  return seg ? seg.timetable[wd] ?? [] : [];
}

function lessonCounts(setup: Setup, from: ISODate, to: ISODate): Record<string, number> {
  const out: Record<string, number> = {};
  if (from > to) return out;
  for (const seg of setup.segments) {
    const a = seg.start > from ? seg.start : from;
    const b = seg.end < to ? seg.end : to;
    if (a > b) continue;
    for (const ds of eachDay(a, b)) {
      for (const l of lessonsOn(setup, ds)) out[l.subjectId] = (out[l.subjectId] ?? 0) + l.count;
    }
  }
  return out;
}

export function totals(setup: Setup): Record<string, number> {
  const t = lessonCounts(setup, setup.windowStart, setup.windowEnd);
  for (const [id, n] of Object.entries(setup.baseline)) t[id] = (t[id] ?? 0) + (Number(n) || 0);
  return t;
}

/** Lessons held up to and including `upTo` (baseline counts as held). */
export function heldSoFar(setup: Setup, upTo: ISODate): Record<string, number> {
  const end = upTo < setup.windowEnd ? upTo : setup.windowEnd;
  const h = lessonCounts(setup, setup.windowStart, end);
  for (const [id, n] of Object.entries(setup.baseline)) h[id] = (h[id] ?? 0) + (Number(n) || 0);
  return h;
}

export function inWindow(setup: Setup, ds: ISODate): boolean {
  return ds >= setup.windowStart && ds <= setup.windowEnd;
}

/** Lesson counts per subject. With `now`, `when` picks past+today ("done") or future ("planned") entries. */
export function absenceCounts(setup: Setup, absences: Absence[], now?: ISODate, when: "done" | "planned" = "done"): Record<string, number> {
  const a: Record<string, number> = {};
  for (const e of absences) {
    if (!inWindow(setup, e.date)) continue;
    if (now && (when === "done" ? e.date > now : e.date <= now)) continue;
    for (const [id, n] of Object.entries(e.lessons)) a[id] = (a[id] ?? 0) + (Number(n) || 0);
  }
  return a;
}

export function summary(setup: Setup, absences: Absence[], now: ISODate): SubjectRow[] {
  const T = totals(setup);
  const H = heldSoFar(setup, now);
  const A = absenceCounts(setup, absences, now, "done");
  const P = absenceCounts(setup, absences, now, "planned");
  const rows = setup.subjects
    .filter((s) => s.tracked)
    .map((subject) => {
      const total = T[subject.id] ?? 0;
      const absent = A[subject.id] ?? 0;
      const planned = P[subject.id] ?? 0;
      const max = maxAllowed(total, setup.rule);
      const left = max - absent - planned;
      return {
        subject,
        total,
        held: H[subject.id] ?? 0,
        absent,
        planned,
        max,
        left,
        pct: total ? absent / total : 0,
        status: statusOf(left),
      };
    })
    .filter((r) => r.total > 0);
  rows.sort((x, y) => x.left - y.left || y.pct - x.pct);
  return rows;
}

/**
 * For each weekday: how many more whole days you could skip before some subject
 * crosses the limit. null = nothing missable that day (self-study or no lessons).
 */
export function dayCapacity(_setup: Setup, rows: SubjectRow[], seg: Segment | null): Record<Weekday, number | null> {
  const left: Record<string, number> = {};
  for (const r of rows) left[r.subject.id] = r.left;
  const out = {} as Record<Weekday, number | null>;
  for (const d of [1, 2, 3, 4, 5] as Weekday[]) {
    const blocks = (seg?.timetable[d] ?? []).filter((b) => !b.selfStudy && b.subjectId in left);
    if (!blocks.length) {
      out[d] = null;
      continue;
    }
    const per: Record<string, number> = {};
    for (const b of blocks) per[b.subjectId] = (per[b.subjectId] ?? 0) + b.count;
    let n = Infinity;
    for (const [id, k] of Object.entries(per)) n = Math.min(n, Math.floor(Math.max(0, left[id]) / k));
    out[d] = n === Infinity ? null : n;
  }
  return out;
}

/** The segment to plan with: today's, else the next upcoming one, else the last. */
export function planningSegment(setup: Setup, now: ISODate): Segment | null {
  const cur = segmentFor(setup, now);
  if (cur) return cur;
  const next = [...setup.segments].sort((a, b) => a.start.localeCompare(b.start)).find((s) => s.start > now);
  return next ?? setup.segments[setup.segments.length - 1] ?? null;
}

export interface PreviewLine {
  subjectId: string;
  add: number;
  absentAfter: number;
  total: number;
  leftAfter: number;
  counted: boolean;
}

/** "What if I skip these lessons?" before saving. */
export function preview(setup: Setup, rows: SubjectRow[], date: ISODate, sel: Record<string, number>) {
  const byId = new Map(rows.map((r) => [r.subject.id, r]));
  const counts = inWindow(setup, date);
  const lines: PreviewLine[] = Object.entries(sel)
    .filter(([, n]) => n > 0)
    .map(([subjectId, add]) => {
      const r = byId.get(subjectId);
      if (!r) return { subjectId, add, absentAfter: 0, total: 0, leftAfter: 0, counted: false };
      const absentAfter = r.absent + r.planned + (counts ? add : 0);
      return { subjectId, add, absentAfter, total: r.total, leftAfter: r.max - absentAfter, counted: counts };
    });
  const over = lines.filter((l) => l.counted && l.leftAfter < 0).map((l) => l.subjectId);
  const total = lines.reduce((s, l) => s + l.add, 0);
  return { lines, over, total, counts };
}

/** Lessons on a date that a student can actually miss (not self-study). */
export function missableOn(setup: Setup, ds: ISODate): Lesson[] {
  return lessonsOn(setup, ds).filter((b) => !b.selfStudy);
}

/** First date after `from` (exclusive) with missable lessons, within the window, skipping `skip` dates. */
export function nextSchoolDay(setup: Setup, from: ISODate, skip: ReadonlySet<ISODate> = new Set()): ISODate | null {
  for (let d = addDays(from, 1); d <= setup.windowEnd; d = addDays(d, 1)) if (!skip.has(d) && missableOn(setup, d).length) return d;
  return null;
}

/** Next date after `from` (exclusive) that has a missable lesson of this subject. */
export function nextLesson(setup: Setup, subjectId: string, from: ISODate): ISODate | null {
  for (let d = addDays(from, 1); d <= setup.windowEnd; d = addDays(d, 1))
    if (missableOn(setup, d).some((b) => b.subjectId === subjectId)) return d;
  return null;
}

export interface DayVerdict {
  date: ISODate;
  /** Missable lessons that day, all subjects. */
  lessons: number;
  /** Graded subjects that would newly go over the limit if the whole day is missed. */
  blockers: string[];
  /** Graded subject with the least left after missing the day (null if none counted). */
  tightest: { subjectId: string; leftAfter: number } | null;
}

/** "Can I skip this whole day?" Advisory subjects never block. */
export function dayVerdict(setup: Setup, rows: SubjectRow[], date: ISODate): DayVerdict {
  const blocks = missableOn(setup, date);
  const per: Record<string, number> = {};
  for (const b of blocks) per[b.subjectId] = (per[b.subjectId] ?? 0) + b.count;
  const blockers: string[] = [];
  let tightest: DayVerdict["tightest"] = null;
  for (const r of rows) {
    const k = per[r.subject.id];
    if (!k || r.subject.advisory) continue;
    const leftAfter = r.left - k;
    // Only subjects that would newly cross the limit block the day; one already over is lost either way.
    if (r.left >= 0 && leftAfter < 0) blockers.push(r.subject.id);
    if (!tightest || leftAfter < tightest.leftAfter) tightest = { subjectId: r.subject.id, leftAfter };
  }
  return { date, lessons: blocks.reduce((s, b) => s + b.count, 0), blockers, tightest };
}
