import { isValidISO } from "./dates";
import type { Absence, ISODate, Setup } from "./types";

export interface ParsedLine {
  raw: string;
  date?: ISODate;
  subjectId?: string;
  count: number;
  ok: boolean;
  reason?: string;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Common short forms people and e-schools use. */
const ALIASES: Record<string, string[]> = {
  matemaatika: ["mat", "matem"],
  "eesti-keel": ["eesti k", "e.k", "eesti"],
  "inglise-keel": ["inglise", "ingl", "english", "a-voorkeel"],
  "hispaania-keel": ["hispaania", "hisp"],
  "kehaline-kasvatus": ["kehaline", "keh", "kk", "liikumine"],
  "klassijuhataja-tund": ["klassijuhataja", "kl.juh", "klassitund"],
  uhiskonnaopetus: ["uhiskond", "uhisk"],
};

function findSubject(setup: Setup, line: string): string | undefined {
  const l = norm(line);
  // Longest name first so "eesti keel" beats "eesti".
  const cands: [string, string][] = [];
  for (const s of setup.subjects) {
    cands.push([norm(s.name), s.id]);
    for (const a of ALIASES[s.id] ?? []) cands.push([a, s.id]);
  }
  cands.sort((a, b) => b[0].length - a[0].length);
  for (const [needle, id] of cands) {
    const re = new RegExp(`(^|[^a-z])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z])`);
    if (re.test(l)) return id;
  }
  return undefined;
}

function findDate(setup: Setup, line: string): ISODate | undefined {
  const iso = line.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso && isValidISO(iso[0])) return iso[0];
  const m = line.match(/\b(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?\b/);
  if (!m) return undefined;
  const d = m[1].padStart(2, "0");
  const mo = m[2].padStart(2, "0");
  let y: string;
  if (m[3]) y = m[3].length === 2 ? `20${m[3]}` : m[3];
  else {
    // No year: pick the year that puts the date inside the grading window.
    const y0 = Number(setup.windowStart.slice(0, 4));
    const a = `${y0}-${mo}-${d}`;
    y = a >= setup.windowStart ? String(y0) : String(y0 + 1);
  }
  const out = `${y}-${mo}-${d}`;
  return isValidISO(out) ? out : undefined;
}

function findCount(line: string): number {
  const m = norm(line).match(/(\d+)\s*(tundi|tund|h\b|x\b)/) ?? line.match(/[×x]\s*(\d+)/);
  if (!m) return 1;
  const n = Number(m[1]);
  return n >= 1 && n <= 10 ? n : 1;
}

/**
 * Tolerant paste import: one absence per line, e.g. copied from Stuudium/eKool.
 * "12.11 Matemaatika 2 tundi", "2026-11-12 füüsika", "12.11.2026 3. tund Keemia".
 * A line with only a date applies the date to following lines.
 */
export function parsePaste(setup: Setup, text: string): ParsedLine[] {
  const out: ParsedLine[] = [];
  let carryDate: ISODate | undefined;
  for (const raw0 of text.split(/\r?\n/)) {
    const raw = raw0.trim();
    if (!raw) continue;
    const date = findDate(setup, raw) ?? carryDate;
    // Strip the date so "12.11" isn't read as a lesson count.
    const rest = raw.replace(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\.\d{1,2}\.?(\d{2,4})?\b/, " ");
    const subjectId = findSubject(setup, rest);
    if (findDate(setup, raw) && !subjectId) {
      carryDate = date;
      continue;
    }
    // "3. tund" is a lesson number, not a count.
    const count = /\d+\.\s*tund/i.test(rest) ? 1 : findCount(rest);
    if (!date) out.push({ raw, subjectId, count, ok: false, reason: "kuupäev puudub" });
    else if (!subjectId) out.push({ raw, date, count, ok: false, reason: "ainet ei tuvastatud" });
    else out.push({ raw, date, subjectId, count, ok: true });
  }
  return out;
}

export function toAbsences(lines: ParsedLine[], note = "Imporditud"): Absence[] {
  const byDate = new Map<ISODate, Record<string, number>>();
  for (const l of lines) {
    if (!l.ok || !l.date || !l.subjectId) continue;
    const rec = byDate.get(l.date) ?? {};
    rec[l.subjectId] = (rec[l.subjectId] ?? 0) + l.count;
    byDate.set(l.date, rec);
  }
  const now = new Date().toISOString();
  return [...byDate.entries()].map(([date, lessons]) => ({
    id: `imp-${date}-${Math.random().toString(36).slice(2, 8)}`,
    date,
    lessons,
    note,
    createdAt: now,
  }));
}
