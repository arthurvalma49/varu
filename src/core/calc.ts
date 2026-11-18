import { eachDay, isSchoolWeekday, weekdayOf } from "./dates";
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

export function statusOf(left: number): Status {
  return left <= 0 ? "bad" : left <= 2 ? "warn" : "ok";
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

export function absenceCounts(setup: Setup, absences: Absence[]): Record<string, number> {
  const a: Record<string, number> = {};
  for (const e of absences) {
    if (!inWindow(setup, e.date)) continue;
    for (const [id, n] of Object.entries(e.lessons)) a[id] = (a[id] ?? 0) + (Number(n) || 0);
  }
  return a;
}

export function summary(setup: Setup, absences: Absence[], now: ISODate): SubjectRow[] {
  const T = totals(setup);
  const H = heldSoFar(setup, now);
  const A = absenceCounts(setup, absences);
  const rows = setup.subjects
    .filter((s) => s.tracked)
    .map((subject) => {
      const total = T[subject.id] ?? 0;
      const absent = A[subject.id] ?? 0;
      const max = maxAllowed(total, setup.rule);
      const left = max - absent;
      return {
        subject,
        total,
        held: H[subject.id] ?? 0,
        absent,
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
      const absentAfter = r.absent + (counts ? add : 0);
      return { subjectId, add, absentAfter, total: r.total, leftAfter: r.max - absentAfter, counted: counts };
    });
  const over = lines.filter((l) => l.counted && l.leftAfter < 0).map((l) => l.subjectId);
  const total = lines.reduce((s, l) => s + l.add, 0);
  return { lines, over, total, counts };
}
