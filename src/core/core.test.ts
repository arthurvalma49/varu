import { describe, expect, it } from "vitest";
import { dayCapacity, dayClock, lessonTimes, lessonsOn, timetableOn, withCancelled, dayVerdict, maxAllowed, nextLesson, nextSchoolDay, planningSegment, preview, statusOf, summary, totals } from "./calc";
import { parsePaste, toAbsences } from "./importer";
import { decodeSetup, encodeSetup } from "./share";
import { appendLesson, breakDays, buildSetup, cycleLesson, defaultWindow, removeLesson, startingAbsence } from "./setup";
import { eduDivisions, eduSegments, eduTimetable, edupageSchool, picksByName, ttRange, type EduData, type EduPeriod } from "./edupage";
import ramFixture from "./fixtures/edupage-ram-9b.json";
import paeFixture from "./fixtures/edupage-pae-9a.json";
import { demoData } from "./demo";
import { migrateSetup, ram9bTemplate } from "./templates";
import type { Rule } from "./types";

const rule = (num: number, den: number, mode: "gte" | "gt"): Rule => ({
  limit: { num, den },
  mode,
  automatic: true,
  consequence: "",
});

describe("maxAllowed", () => {
  it("matches the original ceil(T/4)-1 for RAM's 25% (gte)", () => {
    for (let T = 1; T <= 200; T++) expect(maxAllowed(T, rule(1, 4, "gte"))).toBe(Math.max(0, Math.ceil(T / 4) - 1));
  });
  it("is exact for 1/3", () => {
    expect(maxAllowed(30, rule(1, 3, "gte"))).toBe(9); // 10/30 = 33.3% fails
    expect(maxAllowed(30, rule(1, 3, "gt"))).toBe(10); // 10/30 allowed when only > fails
  });
  it("handles zero lessons", () => expect(maxAllowed(0, rule(1, 4, "gte"))).toBe(0));
});

describe("RAM 9.b template", () => {
  const setup = ram9bTemplate();
  it("date-based totals equal the original p1 + 7*weekly + 3*weekly", () => {
    const weekly: Record<string, number> = {};
    for (const day of Object.values(setup.segments[0].timetable))
      for (const l of day) weekly[l.subjectId] = (weekly[l.subjectId] ?? 0) + l.count;
    const T = totals(setup);
    for (const [id, p1] of Object.entries(setup.baseline)) {
      expect(T[id], id).toBe(p1 + 10 * (weekly[id] ?? 0));
    }
    expect(T["matemaatika"]).toBe(85);
  });

  it("summary sorts tightest subject first and preview flags overflow", () => {
    const absences = [{ id: "a", date: "2026-11-05", lessons: { "hispaania-keel": 14 }, createdAt: "" }];
    const rows = summary(setup, absences, "2026-11-18");
    expect(rows[0].subject.id).toBe("hispaania-keel");
    // Hispaania: 21 + 10*3 = 51 -> max 12 -> 14 is over
    expect(rows[0].left).toBe(-2);
    const p = preview(setup, rows, "2026-11-19", { fuusika: 2 });
    expect(p.over).toEqual([]);
    expect(p.lines[0].absentAfter).toBe(2);
  });

  it("ignores absences outside the grading window", () => {
    const rows = summary(setup, [{ id: "x", date: "2027-02-10", lessons: { keemia: 2 }, createdAt: "" }], "2026-11-18");
    expect(rows.find((r) => r.subject.id === "keemia")!.absent).toBe(0);
  });

  it("day capacity: Tuesday is self-study (null), others are numbers", () => {
    const rows = summary(setup, [], "2026-11-18");
    const cap = dayCapacity(setup, rows, planningSegment(setup, "2026-11-18"));
    expect(cap[2]).toBeNull();
    expect(typeof cap[1]).toBe("number");
  });

  it("share code round-trips", () => {
    const back = decodeSetup(encodeSetup(setup));
    expect(back).toEqual(setup);
    expect(decodeSetup("garbage")).toBeNull();
  });
});

describe("status, plans and day verdicts", () => {
  const setup = ram9bTemplate();
  const ab = (date: string, lessons: Record<string, number>) => ({ id: date + Object.keys(lessons).join(), date, lessons, createdAt: "" });

  it("statusOf has a separate edge state at exactly 0 left", () => {
    expect([statusOf(-1), statusOf(0), statusOf(1), statusOf(2), statusOf(3)]).toEqual(["over", "edge", "warn", "warn", "ok"]);
  });

  it("future entries are plans: they reduce what is left but are not missed yet", () => {
    const a = [ab("2026-11-25", { fuusika: 2 })];
    const before = summary(setup, a, "2026-11-18").find((r) => r.subject.id === "fuusika")!;
    expect([before.absent, before.planned, before.left]).toEqual([0, 2, before.max - 2]);
    const after = summary(setup, a, "2026-11-25").find((r) => r.subject.id === "fuusika")!;
    expect([after.absent, after.planned]).toEqual([2, 0]);
  });

  it("preview counts plans already made", () => {
    const rows = summary(setup, [ab("2026-11-25", { fuusika: 2 })], "2026-11-18");
    const p = preview(setup, rows, "2026-12-02", { fuusika: 2 });
    expect(p.lines[0].absentAfter).toBe(4);
  });

  it("day verdict: a subject at 0 blocks its day, advisory subjects never block", () => {
    const rows = summary(setup, [ab("2026-11-11", { fuusika: 8, muusika: 9 })], "2026-11-18");
    expect(rows.find((r) => r.subject.id === "fuusika")!.status).toBe("edge");
    const v = dayVerdict(setup, rows, "2026-11-25");
    expect(v.blockers).toEqual(["fuusika"]);
    expect(v.lessons).toBe(7);
    expect(dayVerdict(setup, rows, "2026-11-26").blockers).toEqual([]);
  });

  it("a subject already over the limit neither blocks a day nor counts as least left", () => {
    const rows = summary(setup, [ab("2026-11-12", { "hispaania-keel": 14 })], "2026-11-18");
    const v = dayVerdict(setup, rows, "2026-11-19");
    expect(v.blockers).toEqual([]);
    expect(v.tightest?.subjectId).not.toBe("hispaania-keel");
    expect(v.tightest!.leftAfter).toBeGreaterThanOrEqual(0);
  });

  it("next school day skips self-study Tuesdays and weekends; next lesson finds the subject", () => {
    expect(nextSchoolDay(setup, "2026-11-23")).toBe("2026-11-25");
    expect(nextSchoolDay(setup, "2026-11-20")).toBe("2026-11-23");
    expect(nextLesson(setup, "fuusika", "2026-11-18")).toBe("2026-11-25");
    expect(nextSchoolDay(setup, "2027-01-25")).toBeNull();
    expect(nextSchoolDay(setup, "2026-11-18", new Set(["2026-11-19"]))).toBe("2026-11-20");
  });

  it("migrates old RAM setups to mark Muusika and Klassijuhataja tund as advisory", () => {
    const old = ram9bTemplate();
    for (const s of old.subjects) delete s.advisory;
    const m = migrateSetup(old);
    expect(m.subjects.filter((s) => s.advisory).map((s) => s.id)).toEqual(["muusika", "klassijuhataja-tund"]);
  });
});

describe("paste import", () => {
  const setup = ram9bTemplate();
  it("parses common formats", () => {
    const lines = parsePaste(
      setup,
      ["12.11 Matemaatika 2 tundi", "2026-11-13 füüsika", "17.11.2026 3. tund Keemia", "05.01 Hisp", "foo bar", "20.11", "Eesti keel"].join("\n"),
    );
    const ok = lines.filter((l) => l.ok);
    expect(ok.map((l) => [l.date, l.subjectId, l.count])).toEqual([
      ["2026-11-12", "matemaatika", 2],
      ["2026-11-13", "fuusika", 1],
      ["2026-11-17", "keemia", 1],
      ["2027-01-05", "hispaania-keel", 1],
      ["2026-11-20", "eesti-keel", 1],
    ]);
    expect(lines.find((l) => l.raw === "foo bar")!.ok).toBe(false);
    expect(toAbsences(ok)).toHaveLength(5);
  });
});

describe("guided setup", () => {
  it("tapping the same subject twice makes a paaristund and slots renumber", () => {
    let day = appendLesson([], "matemaatika");
    day = appendLesson(day, "matemaatika");
    day = appendLesson(day, "fuusika");
    expect(day.map((l) => [l.subjectId, l.count, l.slot])).toEqual([
      ["matemaatika", 2, "1–2"],
      ["fuusika", 1, "3"],
    ]);
    day = cycleLesson(day, 1); // x1 -> x2
    expect(day[1]).toMatchObject({ count: 2, slot: "3–4" });
    day = cycleLesson(day, 1); // x2 -> iseõpe
    expect(day[1]).toMatchObject({ count: 1, selfStudy: true });
    expect(removeLesson(day, 0)[0].slot).toBe("1");
  });

  it("national breaks become holidays, weekdays only", () => {
    const d = breakDays("2026-09-01", "2027-01-25");
    expect(d).toContain("2026-10-26");
    expect(d).not.toContain("2026-10-31"); // Saturday
    expect(d).toContain("2027-01-01");
    expect(d.length).toBe(5 + 10);
  });

  it("default window follows the school year", () => {
    expect(defaultWindow("2026-11-18", "x")).toEqual({ name: "I poolaasta 2026/27", start: "2026-09-01", end: "2027-01-25" });
    expect(defaultWindow("2027-03-01", "x").name).toBe("II poolaasta 2026/27");
  });

  it("builds a working setup: only used subjects, breaks excluded, starting absences", () => {
    const tt = { 1: appendLesson(appendLesson([], "matemaatika"), "matemaatika"), 2: [], 3: appendLesson([], "keemia"), 4: [], 5: [] };
    const setup = buildSetup({
      schoolId: "oru",
      schoolName: "",
      className: "8.a",
      window: { name: "I poolaasta", start: "2026-09-01", end: "2027-01-25" },
      subjectNames: ["Matemaatika", "Keemia", "Kunst"],
      timetable: tt,
      timetableFrom: "2026-09-01",
      baseline: {},
    });
    expect(setup.subjects.map((s) => s.id)).toEqual(["matemaatika", "keemia"]);
    expect(setup.rule.limit).toEqual({ num: 18, den: 100 });
    const T = totals(setup);
    // 21 Mondays in the window, minus 3 in breaks (26.10, 21.12, 28.12) = 18, x2 lessons
    expect(T["matemaatika"]).toBe(36);
    const a = startingAbsence(setup, { matemaatika: 4, keemia: 0 }, "")!;
    expect(a.lessons).toEqual({ matemaatika: 4 });
    expect(summary(setup, [a], "2026-11-18").find((r) => r.subject.id === "matemaatika")!.absent).toBe(4);
    expect(startingAbsence(setup, { keemia: 0 }, "")).toBeNull();
  });
});

describe("EduPage import (real public data: Tallinna Pae Gümnaasium 9.a, Nov 2026)", () => {
  const d = paeFixture as EduData;
  const cls = d.classes[0].id;

  it("reads a school id from a link, a domain or a bare name", () => {
    expect(edupageSchool("https://pae.edupage.org/timetable/view.php?class=-188")).toBe("pae");
    expect(edupageSchool("pae.edupage.org")).toBe("pae");
    expect(edupageSchool(" Pae ")).toBe("pae");
    expect(edupageSchool("../evil")).toBeNull();
  });

  it("asks only about group splits that change the schedule, and says what each group has", () => {
    const divs = eduDivisions(d, cls);
    const names = divs.map((v) => v.groups.map((g) => g.name).sort().join("/"));
    // Boys/Girls PE and Eesti 1/2 meet at the same times: not asked. English groups differ: asked.
    expect(names).not.toContain("Boys/Girls");
    expect(names).not.toContain("Eesti 1/Eesti 2");
    expect(names).toContain("Inglise 1/Inglise 2");
    const eng = divs.find((v) => v.groups.some((g) => g.name === "Inglise 1"))!;
    expect(eng.groups[0].lessons.map((l) => l.subject)).toContain("Inglise keel");
  });

  it("builds one student's week: group lessons only once, double lessons merged", () => {
    const divs = eduDivisions(d, cls);
    const picks = Object.fromEntries(divs.map((v) => [v.id, v.groups[0].id]));
    const r = eduTimetable(d, cls, picks);
    const all = Object.values(r.timetable).flat();
    // Biology is one 2-period card on Wednesday (periods 5-6).
    expect(r.timetable[3].find((l) => l.subjectId === "bioloogia")).toMatchObject({ count: 2, slot: "5–6" });
    // Maths: 4 single lessons a week, whole class.
    expect(all.filter((l) => l.subjectId === "matemaatika").reduce((s, l) => s + l.count, 0)).toBe(4);
    // Only one English group is attended, so English is 3 lessons, not 6.
    expect(all.filter((l) => l.subjectId === "inglise-keel").reduce((s, l) => s + l.count, 0)).toBe(3);
    // PE: picking one of Boys/Girls gives one double lesson, not two.
    expect(all.filter((l) => l.subjectId === "kehaline-kasvatus").reduce((s, l) => s + l.count, 0)).toBe(2);
    expect(r.subjects.find((s) => s.id === "matemaatika")?.name).toBe("Matemaatika");
    expect(r.skippedAlternating).toBe(0);
  });
});

describe("EduPage import (real public data: Rocca al Mare Kool 9.b, I and II periood 2026/27)", () => {
  const periods = ramFixture as unknown as EduPeriod[];

  it("reads period dates from timetable titles", () => {
    expect(ttRange(periods[1].info)).toEqual({ start: "2026-11-02", end: "2026-12-20" });
    expect(ttRange({ tt_num: "1", text: "III periood 2020 (18. 12. 2019 - 22. 02. 2020)" })).toEqual({ start: "2019-12-18", end: "2020-02-22" });
  });

  it("matches the hand-made 9.b template's II periood, with (i) lessons as self-study", () => {
    const d = periods[1].data as EduData;
    const r = eduTimetable(d, d.classes[0].id, picksByName(d, d.classes[0].id, []));
    const tpl = ram9bTemplate().segments[0].timetable;
    const show = (t: typeof tpl, wd: 1 | 2 | 3 | 4 | 5) => t[wd].map((l) => `${l.slot} ${l.subjectId}${l.selfStudy ? " (i)" : ""}`);
    for (const wd of [1, 2, 3] as const) expect(show(r.timetable, wd)).toEqual(show(tpl, wd));
    expect(r.subjects.some((s) => /\(i\)/.test(s.name))).toBe(false);
  });

  it("rebuilds the whole half-year from every published period", () => {
    const r = eduSegments(periods, "9.b", [], "2026-09-01", "2027-01-25");
    expect(r.segments.map((s) => [s.start, s.end, !!s.assumed])).toEqual([
      ["2026-09-01", "2026-10-20", false],
      ["2026-11-02", "2026-12-20", false],
      ["2026-12-21", "2027-01-25", true],
    ]);
    const setup = { ...ram9bTemplate(), baseline: {}, segments: r.segments, holidays: breakDays("2026-09-01", "2027-01-25") };
    const T = totals(setup);
    // Within a few lessons of the original tool's hand count (school events are not in timetables).
    expect(T["fuusika"]).toBe(34);
    expect(Math.abs(T["matemaatika"] - 85)).toBeLessThanOrEqual(4);
  });
});

describe("lesson times", () => {
  const setup = ram9bTemplate();
  it("maps slots to RAM bell times, double lessons span both", () => {
    const wed = setup.segments[0].timetable[3];
    expect(lessonTimes(setup, wed[0])).toEqual({ start: "09:00", end: "10:30" }); // Geograafia 1–2
    expect(lessonTimes(setup, wed[3])).toEqual({ start: "14:30", end: "15:10" }); // Muusika 7
  });
  it("knows the current and next lesson and when the day is over", () => {
    const at = (h: number, m: number) => dayClock(setup, "2026-11-18", h * 60 + m);
    expect(at(8, 30)).toEqual({ current: null, next: 0, over: false });
    expect(at(9, 15)).toEqual({ current: 0, next: 1, over: false });
    expect(at(10, 35)).toEqual({ current: null, next: 1, over: false }); // break before Füüsika
    expect(at(15, 30)).toMatchObject({ current: null, next: null, over: true });
    expect(dayClock({ ...setup, periodTimes: undefined }, "2026-11-18", 600)).toBeNull();
  });
});

describe("cancelled lessons", () => {
  const base = ram9bTemplate();
  it("lower the total and can lower what is allowed, without counting as absences", () => {
    const before = summary(base, [], "2026-11-18").find((r) => r.subject.id === "fuusika")!;
    // Two double Füüsika lessons cancelled: 34 -> 30 lessons, max 8 -> 7.
    const cancelled = withCancelled(withCancelled(undefined, "2026-11-25", { fuusika: 2 }), "2026-12-02", { fuusika: 2 });
    const after = summary({ ...base, cancelled }, [], "2026-11-18").find((r) => r.subject.id === "fuusika")!;
    expect([before.total, before.max]).toEqual([34, 8]);
    expect([after.total, after.max, after.absent]).toEqual([30, 7, 0]);
  });
  it("never travel in a share code (they can be personal)", () => {
    const s = { ...base, cancelled: withCancelled(undefined, "2026-11-25", { fuusika: 2 }) };
    const back = decodeSetup(encodeSetup(s))!;
    expect(back.cancelled).toBeUndefined();
    expect(back.segments).toEqual(s.segments);
  });
  it("removes just the cancelled part of a day, and can be undone", () => {
    const s = { ...base, cancelled: withCancelled(undefined, "2026-11-25", { fuusika: 2 }) };
    expect(timetableOn(s, "2026-11-25").map((l) => l.subjectId)).toContain("fuusika");
    expect(lessonsOn(s, "2026-11-25").map((l) => l.subjectId)).not.toContain("fuusika");
    expect(withCancelled(s.cancelled, "2026-11-25", { fuusika: -2 })).toEqual({});
  });
});

describe("EduPage groups at RAM", () => {
  it("9.b is asked one question (which B-keel), not five", () => {
    const d = (ramFixture as unknown as EduPeriod[])[1].data as EduData;
    const divs = eduDivisions(d, d.classes[0].id);
    expect(divs).toHaveLength(1);
    expect(new Set(divs[0].groups.flatMap((g) => g.lessons.map((l) => l.subject)))).toEqual(new Set(["Hispaania keel", "Prantsuse keel", "Vene keel"]));
  });
});

describe("tester mode demo data", () => {
  it("shows every state: at the limit, over, close and calm, plus a plan and a cancellation", () => {
    const d = demoData("2026-11-18");
    const rows = summary(d.setup!, d.absences, "2026-11-18");
    const st = (id: string) => rows.find((r) => r.subject.id === id)!.status;
    expect([st("fuusika"), st("hispaania-keel"), st("geograafia"), st("matemaatika")]).toEqual(["edge", "over", "warn", "ok"]);
    expect(d.absences.some((a) => a.date > "2026-11-18")).toBe(true);
    expect(Object.keys(d.setup!.cancelled ?? {})).toHaveLength(1);
    expect(d.demo).toBe(true);
  });
});
