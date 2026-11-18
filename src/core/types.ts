/** Pure data model. No DOM, no React: reusable in a future native app. */

export type ISODate = string; // "YYYY-MM-DD"
export type Weekday = 1 | 2 | 3 | 4 | 5; // Mon..Fri

/** Absence limit as an exact fraction (1/4, 1/3, 18/100) to avoid float bugs. */
export interface Fraction {
  num: number;
  den: number;
}

export interface Rule {
  limit: Fraction;
  /** "gte": reaching the limit fails (RAM: 25% or more = MH). "gt": only exceeding it fails. */
  mode: "gte" | "gt";
  /** What happens at the limit, shown to the user. */
  consequence: string;
  /** true when the consequence is automatic (MH), false when the teacher only may act. */
  automatic: boolean;
}

export interface Subject {
  id: string;
  name: string;
  /** Counted toward the rule. Untracked subjects can still be logged. */
  tracked: boolean;
  note?: string;
}

export interface Lesson {
  subjectId: string;
  /** Lessons in this block (2 = paaristund). */
  count: number;
  /** Display label, e.g. "3–4". */
  slot: string;
  /** Self-study: counts toward totals, cannot be missed. */
  selfStudy?: boolean;
}

export type Timetable = Record<Weekday, Lesson[]>;

/** A date range that uses one timetable (e.g. "2. periood"). */
export interface Segment {
  id: string;
  name: string;
  start: ISODate;
  end: ISODate;
  timetable: Timetable;
  /** Timetable copied from another segment because the real one isn't out yet. */
  assumed?: boolean;
}

export interface Setup {
  version: 1;
  schoolId: string;
  schoolName: string;
  className: string;
  /** The grading window the rule applies to (e.g. "I poolaasta"). */
  windowName: string;
  windowStart: ISODate;
  windowEnd: ISODate;
  rule: Rule;
  subjects: Subject[];
  /** Lessons held in the window before the timetable segments (counted by hand). */
  baseline: Record<string, number>;
  baselineLabel?: string;
  segments: Segment[];
  /** No-lesson days inside segments (holidays, school events). */
  holidays: ISODate[];
}

export interface Absence {
  id: string;
  date: ISODate;
  lessons: Record<string, number>;
  note?: string;
  createdAt: string;
}

export interface AppData {
  setup: Setup | null;
  absences: Absence[];
}

export type Status = "ok" | "warn" | "bad";

export interface SubjectRow {
  subject: Subject;
  total: number;
  held: number; // lessons held up to today
  absent: number;
  max: number; // max absences while staying within the rule
  left: number; // max - absent (negative = over)
  pct: number;
  status: Status;
}
