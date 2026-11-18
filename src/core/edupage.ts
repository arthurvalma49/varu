/**
 * aSc EduPage public timetable -> Varu timetable. Pure TypeScript, no DOM.
 *
 * EduPage serves a school's published timetable as JSON tables. The app fetches it through
 * /api/edupage (EduPage sends no CORS headers), which trims it to the shape below.
 */
import { slug } from "./templates";
import type { ISODate, Lesson, Segment, Timetable, Weekday } from "./types";

export interface EduData {
  schoolName: string;
  periods: { id: string; period: string; short?: string }[];
  classes: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
  groups: { id: string; name: string; classid: string; entireclass: boolean }[];
  divisions: { id: string; classid: string; groupids: string[] }[];
  lessons: { id: string; subjectid: string; classids: string[]; groupids: string[]; durationperiods: number }[];
  cards: { lessonid: string; period: string; days: string; weeks: string }[];
}

export interface EduTimetableInfo {
  tt_num: string;
  text: string;
  datefrom?: string;
  hidden?: boolean;
}

/** Self-study marked as its own subject, e.g. RAM's "Matemaatika (i)". */
const SELF_STUDY = /\s*\((?:i|iseõpe)\)\s*$/i;

/**
 * Date range of a published timetable. EduPage titles carry it, e.g.
 * "II periood 2627 (02. 11. - 20. 12. 2026)" or "(18. 12. 2019 - 22. 02. 2020)".
 */
export function ttRange(t: EduTimetableInfo): { start: ISODate; end: ISODate | null } | null {
  const m = t.text.match(/\((\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})?\s*-\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s*\)/);
  const p2 = (n: string) => n.padStart(2, "0");
  if (m) {
    const endY = Number(m[6]);
    const startY = m[3] ? Number(m[3]) : Number(m[2]) > Number(m[5]) ? endY - 1 : endY;
    return { start: `${startY}-${p2(m[2])}-${p2(m[1])}`, end: `${endY}-${p2(m[5])}-${p2(m[4])}` };
  }
  return t.datefrom ? { start: t.datefrom, end: null } : null;
}

/** "pae", "pae.edupage.org" or any https://pae.edupage.org/... link -> "pae". */
export function edupageSchool(input: string): string | null {
  const s = input.trim().toLowerCase();
  const m = s.match(/([a-z0-9-]+)\.edupage\.org/);
  const id = m ? m[1] : s;
  return /^[a-z0-9-]{2,40}$/.test(id) ? id : null;
}

const lessonsOfClass = (d: EduData, classId: string) => d.lessons.filter((l) => l.classids.includes(classId));

/** Group splits the student must choose from (e.g. Inglise 1 / Inglise 2, Boys / Girls). */
export function eduDivisions(d: EduData, classId: string): { id: string; groups: { id: string; name: string }[] }[] {
  const used = new Set(lessonsOfClass(d, classId).flatMap((l) => l.groupids));
  const groups = new Map(d.groups.map((g) => [g.id, g]));
  return d.divisions
    .filter((v) => v.classid === classId)
    .map((v) => ({
      id: v.id,
      groups: v.groupids
        .map((id) => groups.get(id))
        .filter((g): g is EduData["groups"][number] => !!g && !g.entireclass && used.has(g.id))
        .map((g) => ({ id: g.id, name: g.name })),
    }))
    .filter((v) => v.groups.length >= 2);
}

export interface EduResult {
  subjects: { id: string; name: string }[];
  timetable: Timetable;
  /** Lessons left out because they do not happen every week (A/B weeks): counting them weekly would inflate totals. */
  skippedAlternating: number;
}

/**
 * Build one student's week. `picks` maps division id -> chosen group id; a division without a
 * pick includes none of its group lessons (the UI always picks one).
 */
export function eduTimetable(d: EduData, classId: string, picks: Record<string, string>): EduResult {
  const groupById = new Map(d.groups.map((g) => [g.id, g]));
  const divisionOf = new Map<string, string>();
  for (const v of d.divisions) for (const g of v.groupids) divisionOf.set(g, v.id);
  const periodNo = new Map(d.periods.map((p, i) => [p.id, Number.parseInt(p.period, 10) || i + 1]));
  const subjectName = new Map(d.subjects.map((s) => [s.id, s.name.trim()]));

  const attends = (l: EduData["lessons"][number]) => {
    const mine = l.groupids.map((id) => groupById.get(id)).filter((g) => g && g.classid === classId);
    if (!mine.length) return true; // joined lesson listed under another class's groups
    return mine.some((g) => g!.entireclass || picks[divisionOf.get(g!.id) ?? ""] === g!.id);
  };

  const lessons = new Map(lessonsOfClass(d, classId).filter(attends).map((l) => [l.id, l]));
  type Block = { subjectId: string; start: number; dur: number; selfStudy?: boolean };
  const blocks: Record<Weekday, Block[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  const names = new Map<string, string>();
  let skippedAlternating = 0;

  for (const c of d.cards) {
    const l = lessons.get(c.lessonid);
    if (!l) continue;
    if (!c.weeks || c.weeks.includes("0")) {
      skippedAlternating++;
      continue;
    }
    const raw = subjectName.get(l.subjectid);
    if (!raw) continue;
    const selfStudy = SELF_STUDY.test(raw);
    const name = raw.replace(SELF_STUDY, "").trim();
    const id = slug(name) || `aine-${l.subjectid}`;
    if (!selfStudy || !names.has(id)) names.set(id, name);
    const start = periodNo.get(c.period) ?? 0;
    const dur = Math.max(1, l.durationperiods || 1);
    [...c.days].forEach((bit, i) => {
      if (bit !== "1" || i >= 5) return;
      // Self-study counts toward totals as attendance, one block per period, never merged.
      if (selfStudy) for (let k = 0; k < dur; k++) blocks[(i + 1) as Weekday].push({ subjectId: id, start: start + k, dur: 1, selfStudy: true });
      else blocks[(i + 1) as Weekday].push({ subjectId: id, start, dur });
    });
  }

  const timetable = { 1: [], 2: [], 3: [], 4: [], 5: [] } as Timetable;
  for (const wd of [1, 2, 3, 4, 5] as Weekday[]) {
    const day = blocks[wd].sort((a, b) => a.start - b.start);
    const merged: Block[] = [];
    for (const b of day) {
      const prev = merged[merged.length - 1];
      const same = prev && prev.subjectId === b.subjectId && !!prev.selfStudy === !!b.selfStudy;
      if (same && prev.start === b.start) continue; // duplicate card
      if (same && !b.selfStudy && prev.start + prev.dur === b.start) prev.dur += b.dur;
      else merged.push({ ...b });
    }
    timetable[wd] = merged.map(
      (b): Lesson => ({
        subjectId: b.subjectId,
        count: b.dur,
        slot: b.dur > 1 ? `${b.start}–${b.start + b.dur - 1}` : String(b.start),
        ...(b.selfStudy ? { selfStudy: true } : {}),
      }),
    );
  }

  // Subjects in the order they first appear in the week.
  const order: string[] = [];
  for (const wd of [1, 2, 3, 4, 5] as Weekday[]) for (const l of timetable[wd]) if (!order.includes(l.subjectId)) order.push(l.subjectId);
  return { subjects: order.map((id) => ({ id, name: names.get(id)! })), timetable, skippedAlternating };
}

/** Names of the groups a student picked, so the same choice can be found in another period's timetable. */
export function pickedGroupNames(d: EduData, picks: Record<string, string>): string[] {
  const byId = new Map(d.groups.map((g) => [g.id, g.name]));
  return Object.values(picks).map((id) => byId.get(id)).filter((n): n is string => !!n);
}

/** Same group choice in another timetable: match by group name, else its first group. */
export function picksByName(d: EduData, classId: string, names: string[]): Record<string, string> {
  return Object.fromEntries(eduDivisions(d, classId).map((v) => [v.id, (v.groups.find((g) => names.includes(g.name)) ?? v.groups[0]).id]));
}

export interface EduPeriod {
  info: EduTimetableInfo;
  data: EduData;
}

/**
 * The whole grading window from every timetable the school published inside it. Each becomes a
 * segment with its own dates; the window after the last published one reuses its timetable,
 * marked assumed. Class and groups are matched by name, because ids change between timetables.
 */
export function eduSegments(periods: EduPeriod[], className: string, groupNames: string[], windowStart: ISODate, windowEnd: ISODate) {
  const dated = periods
    .map((p) => ({ ...p, range: ttRange(p.info) }))
    .filter((p): p is EduPeriod & { range: { start: ISODate; end: ISODate | null } } => !!p.range && p.range.start <= windowEnd && (p.range.end ?? windowEnd) >= windowStart)
    .sort((a, b) => a.range.start.localeCompare(b.range.start));
  const segments: Segment[] = [];
  const names = new Map<string, string>();
  let skippedAlternating = 0;
  dated.forEach((p, i) => {
    const cls = p.data.classes.find((c) => c.name.trim().toLowerCase() === className.trim().toLowerCase());
    if (!cls) return;
    const r = eduTimetable(p.data, cls.id, picksByName(p.data, cls.id, groupNames));
    for (const s of r.subjects) names.set(s.id, s.name);
    skippedAlternating += r.skippedAlternating;
    const next = dated[i + 1];
    const start = p.range.start < windowStart ? windowStart : p.range.start;
    let end = p.range.end ?? (next ? dayBefore(next.range.start) : windowEnd);
    if (end > windowEnd) end = windowEnd;
    segments.push({ id: `edu-${p.info.tt_num}`, name: p.info.text.replace(/\s*\(.*$/, "").trim() || "Tunniplaan", start, end, timetable: r.timetable });
  });
  const last = segments[segments.length - 1];
  if (last && last.end < windowEnd)
    segments.push({ id: `${last.id}-next`, name: "Järgmine periood", start: dayAfter(last.end), end: windowEnd, timetable: structuredClone(last.timetable), assumed: true });
  return { segments, subjects: [...names].map(([id, name]) => ({ id, name })), skippedAlternating };
}

const shift = (ds: ISODate, k: number) => {
  const [y, m, d] = ds.split("-").map(Number);
  const t = new Date(y, m - 1, d + k, 12);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};
const dayBefore = (ds: ISODate) => shift(ds, -1);
const dayAfter = (ds: ISODate) => shift(ds, 1);
