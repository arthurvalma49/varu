/** Guided setup helpers. Pure TypeScript, no DOM. */
import { eachDay, isSchoolWeekday, weekdayOf } from "./dates";
import { SCHOOLS } from "./schools";
import { slug } from "./templates";
import type { Absence, ISODate, Lesson, Segment, Setup, Subject, Timetable, Weekday } from "./types";

/** Subjects most Estonian põhikool/gümnaasium timetables use, in a natural order. */
export const COMMON_SUBJECTS = [
  "Matemaatika",
  "Eesti keel",
  "Kirjandus",
  "Inglise keel",
  "Vene keel",
  "Saksa keel",
  "Hispaania keel",
  "Prantsuse keel",
  "Füüsika",
  "Keemia",
  "Bioloogia",
  "Geograafia",
  "Loodusõpetus",
  "Ajalugu",
  "Ühiskonnaõpetus",
  "Inimeseõpetus",
  "Informaatika",
  "Kehaline kasvatus",
  "Muusika",
  "Kunst",
  "Tehnoloogia",
  "Klassijuhataja tund",
];

/**
 * National school breaks (koolivaheajad) plus public holidays on school weekdays.
 * Source: Riigi Teataja 119032025005 (2026/27). Private schools may differ, so the UI says "kontrolli".
 */
export const BREAKS: { name: string; start: ISODate; end: ISODate }[] = [
  { name: "Sügisvaheaeg", start: "2026-10-26", end: "2026-11-01" },
  { name: "Jõuluvaheaeg", start: "2026-12-21", end: "2027-01-03" },
  { name: "Talvevaheaeg", start: "2027-02-22", end: "2027-02-28" },
  { name: "Suur reede", start: "2027-03-26", end: "2027-03-26" },
  { name: "Kevadvaheaeg", start: "2027-04-12", end: "2027-04-18" },
  { name: "Suvevaheaeg", start: "2027-06-09", end: "2027-08-31" },
];

/** School weekdays between start and end that fall in a national break. */
export function breakDays(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (const b of BREAKS) {
    const a = b.start > start ? b.start : start;
    const z = b.end < end ? b.end : end;
    if (a > z) continue;
    for (const d of eachDay(a, z)) if (isSchoolWeekday(weekdayOf(d))) out.push(d);
  }
  return out;
}

export interface Window {
  name: string;
  start: ISODate;
  end: ISODate;
}

/** A sensible grading window for today. RAM uses its known 2026/27 half-year; others get the national calendar. */
export function defaultWindow(today: ISODate, schoolId: string): Window {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const startYear = m >= 8 ? y : y - 1; // school year starting in September
  const sy = `${startYear}/${String((startYear + 1) % 100).padStart(2, "0")}`;
  const secondHalf = m >= 2 && m <= 7;
  if (schoolId === "ram" && startYear === 2026)
    return secondHalf
      ? { name: `II poolaasta ${sy}`, start: "2027-01-26", end: "2027-06-08" }
      : { name: `I poolaasta ${sy}`, start: "2026-09-01", end: "2027-01-25" };
  return secondHalf
    ? { name: `II poolaasta ${sy}`, start: `${startYear + 1}-01-26`, end: `${startYear + 1}-06-08` }
    : { name: `I poolaasta ${sy}`, start: `${startYear}-09-01`, end: `${startYear + 1}-01-25` };
}

/** Slot labels from position: "1", "2–3" (paaristund), ... */
export function renumber(day: Lesson[]): Lesson[] {
  let n = 1;
  return day.map((l) => {
    const slot = l.count > 1 ? `${n}–${n + l.count - 1}` : String(n);
    n += l.count;
    return { ...l, slot };
  });
}

/** Tap-to-build: appending the same subject right after itself makes a double (max 3) lesson. */
export function appendLesson(day: Lesson[], subjectId: string): Lesson[] {
  const last = day[day.length - 1];
  if (last && last.subjectId === subjectId && !last.selfStudy && last.count < 3)
    return renumber([...day.slice(0, -1), { ...last, count: last.count + 1 }]);
  return renumber([...day, { subjectId, count: 1, slot: "" }]);
}

/** Cycle a block: ×1 -> ×2 -> iseõpe -> ×1. */
export function cycleLesson(day: Lesson[], i: number): Lesson[] {
  const l = day[i];
  const next: Lesson = l.selfStudy ? { subjectId: l.subjectId, count: 1, slot: "" } : l.count === 1 ? { ...l, count: 2 } : { subjectId: l.subjectId, count: 1, slot: "", selfStudy: true };
  return renumber(day.map((x, k) => (k === i ? next : x)));
}

export function removeLesson(day: Lesson[], i: number): Lesson[] {
  return renumber(day.filter((_, k) => k !== i));
}

export interface SetupDraft {
  schoolId: string;
  schoolName: string;
  className: string;
  window: Window;
  subjectNames: string[];
  /** Lessons reference subjectId(name). */
  timetable: Timetable;
  /** Date the timetable started. Lessons before it are counted from `baseline`. */
  timetableFrom: ISODate;
  baseline: Record<string, number>;
  /** Periods imported from EduPage. `timetable` above is the editable copy of `currentSegId`. */
  segments?: Segment[];
  currentSegId?: string;
}

export function subjectId(name: string) {
  return slug(name) || "aine";
}

export function buildSetup(d: SetupDraft): Setup {
  const school = SCHOOLS.find((s) => s.id === d.schoolId);
  const subjects: Subject[] = [];
  for (const name of d.subjectNames) {
    const id = subjectId(name);
    if (subjects.some((s) => s.id === id)) continue;
    subjects.push({
      id,
      name,
      tracked: true,
      ...(name === "Klassijuhataja tund" ? { advisory: true, note: "Hinnet ei saa, seega puudumise piir ei pruugi kehtida." } : {}),
    });
  }
  const from = !d.segments?.length && d.timetableFrom > d.window.start ? d.timetableFrom : d.window.start;
  const used = new Set([d.timetable, ...(d.segments ?? []).map((sg) => sg.timetable)].flatMap((t) => Object.values(t).flat().map((l) => l.subjectId)));
  const baseline: Record<string, number> = {};
  if (from > d.window.start) for (const s of subjects) if (d.baseline[s.id]) baseline[s.id] = d.baseline[s.id];
  return {
    version: 1,
    schoolId: school?.id ?? "custom",
    schoolName: school?.name ?? (d.schoolName.trim() || "Minu kool"),
    className: d.className.trim(),
    windowName: d.window.name,
    windowStart: d.window.start,
    windowEnd: d.window.end,
    rule: structuredClone(school?.rule ?? SCHOOLS[0].rule),
    subjects: subjects.filter((s) => used.has(s.id) || baseline[s.id]),
    baseline,
    ...(from > d.window.start ? { baselineLabel: `Enne ${from} toimunud tunnid, käsitsi loetud` } : {}),
    segments: d.segments?.length
      ? d.segments.map((sg) => (sg.id === d.currentSegId ? { ...sg, timetable: structuredClone(d.timetable) } : structuredClone(sg)))
      : [{ id: "s1", name: "Tunniplaan", start: from, end: d.window.end, timetable: structuredClone(d.timetable) }],
    holidays: breakDays(d.window.start, d.window.end),
  };
}

/** Absences a new user already had before installing, as one entry at the window start. */
export function startingAbsence(setup: Setup, counts: Record<string, number>, createdAt: string): Absence | null {
  const lessons = Object.fromEntries(Object.entries(counts).filter(([, n]) => n > 0));
  if (!Object.keys(lessons).length) return null;
  return { id: `start-${setup.windowStart}`, date: setup.windowStart, lessons, note: "Algseis: puudumised enne Varu kasutamist", createdAt };
}

export const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5];
