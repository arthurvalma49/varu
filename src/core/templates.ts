import { SCHOOLS } from "./schools";
import type { Lesson, Setup, Subject, Timetable } from "./types";

export function slug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const S = (name: string, note?: string, tracked = true): Subject => ({ id: slug(name), name, tracked, note });
const L = (name: string, count: number, slot: string, selfStudy = false): Lesson => ({
  subjectId: slug(name),
  count,
  slot,
  ...(selfStudy ? { selfStudy } : {}),
});

/** RAM 9.b, 2. perioodi tunniplaan (02.11–18.12.2026). Tuesday is self-study. */
const RAM9B_P2: Timetable = {
  1: [L("Klassijuhataja tund", 1, "1"), L("Ajalugu", 1, "2"), L("Kirjandus", 2, "3–4"), L("Inglise keel", 1, "5"), L("Matemaatika", 2, "6–7")],
  2: [
    L("Matemaatika", 1, "1", true),
    L("Bioloogia", 1, "2", true),
    L("Hispaania keel", 1, "3", true),
    L("Ajalugu", 1, "4", true),
    L("Ühiskonnaõpetus", 1, "5", true),
  ],
  3: [L("Geograafia", 2, "1–2"), L("Füüsika", 2, "3–4"), L("Keemia", 2, "5–6"), L("Muusika", 1, "7")],
  4: [L("Hispaania keel", 2, "1–2"), L("Matemaatika", 2, "3–4"), L("Ühiskonnaõpetus", 1, "7"), L("Inglise keel", 1, "8")],
  5: [L("Eesti keel", 2, "1–2"), L("Kehaline kasvatus", 2, "3–4"), L("Bioloogia", 1, "5"), L("Inglise keel", 1, "6")],
};

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export function ram9bTemplate(): Setup {
  const ram = SCHOOLS.find((s) => s.id === "ram")!;
  return {
    version: 1,
    schoolId: "ram",
    schoolName: ram.name,
    className: "9.b",
    windowName: "I poolaasta 2026/27",
    windowStart: "2026-09-01",
    windowEnd: "2027-01-25",
    rule: clone(ram.rule),
    subjects: [
      S("Matemaatika"),
      S("Eesti keel"),
      S("Kirjandus"),
      S("Inglise keel"),
      S("Hispaania keel"),
      S("Füüsika"),
      S("Keemia"),
      S("Bioloogia"),
      S("Geograafia"),
      S("Ajalugu"),
      S("Ühiskonnaõpetus"),
      S("Kehaline kasvatus"),
      S("Muusika", "Hinne alles aasta lõpus, tegelik varu on suurem."),
      S("Klassijuhataja tund", "Hinnet ei saa, seega MH reegel ei pruugi kehtida."),
      S("Kunst", "Hinne pandi juba 1. perioodi lõpus.", false),
      S("Tööõpetus", "Ei lähe poolaasta arvestusse.", false),
    ],
    baselineLabel: "1. periood (01.09–20.10), tunnid käsitsi loetud",
    baseline: {
      matemaatika: 35,
      "eesti-keel": 14,
      kirjandus: 14,
      "inglise-keel": 21,
      "hispaania-keel": 21,
      fuusika: 14,
      keemia: 14,
      bioloogia: 14,
      geograafia: 14,
      ajalugu: 14,
      uhiskonnaopetus: 14,
      "kehaline-kasvatus": 14,
      muusika: 7,
      "klassijuhataja-tund": 8,
    },
    segments: [
      { id: "p2", name: "2. periood", start: "2026-11-02", end: "2026-12-18", timetable: clone(RAM9B_P2) },
      { id: "p3", name: "3. periood", start: "2027-01-05", end: "2027-02-19", timetable: clone(RAM9B_P2), assumed: true },
    ],
    holidays: [],
  };
}

export const emptyTimetable = (): Timetable => ({ 1: [], 2: [], 3: [], 4: [], 5: [] });

export function blankSetup(schoolId: string): Setup {
  const school = SCHOOLS.find((s) => s.id === schoolId);
  const y = new Date().getFullYear();
  return {
    version: 1,
    schoolId: school?.id ?? "custom",
    schoolName: school?.name ?? "Minu kool",
    className: "",
    windowName: "Poolaasta",
    windowStart: `${y}-09-01`,
    windowEnd: `${y + 1}-01-25`,
    rule: clone(school?.rule ?? SCHOOLS[0].rule),
    subjects: [],
    baseline: {},
    segments: [{ id: "s1", name: "Tunniplaan", start: `${y}-09-01`, end: `${y + 1}-01-25`, timetable: emptyTimetable() }],
    holidays: [],
  };
}
