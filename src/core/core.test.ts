import { describe, expect, it } from "vitest";
import { dayCapacity, maxAllowed, planningSegment, preview, summary, totals } from "./calc";
import { parsePaste, toAbsences } from "./importer";
import { decodeSetup, encodeSetup } from "./share";
import { ram9bTemplate } from "./templates";
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
