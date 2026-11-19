import { useEffect, useMemo, useState } from "react";
import { eduDivisions, eduPeriodTimes, eduTimetable, edupageSchool, pickedGroupNames, ttRange, type EduData, type EduPeriod, type EduResult, type EduTimetableInfo } from "../core/edupage";
import { Button, Check, Row, Section } from "./kit";

export interface EduImportResult extends EduResult {
  schoolName: string;
  className: string;
  /** Group names the student picked, to find the same groups in other periods. */
  groupNames: string[];
  /** Every timetable the school published this school year (the chosen one included). */
  periods: EduPeriod[];
  /** Bell times by lesson number, when published. */
  periodTimes?: Record<string, { start: string; end: string }>;
}

type Phase =
  | { k: "idle" }
  | { k: "loading" }
  | { k: "error"; msg: string }
  | { k: "ready"; data: EduData; list: EduTimetableInfo[]; all: EduTimetableInfo[]; tt: string; snapshot?: string };

const ERRORS: Record<string, string> = {
  "bad-request": "See ei näe välja nagu EduPage aadress. Proovi nt pae.edupage.org.",
  "no-public-timetable": "Sellel koolil pole avalikku tunniplaani EduPage'is.",
  "no-timetable": "Tunniplaani ei õnnestunud lugeda.",
  "edupage-unreachable": "EduPage ei vastanud. Kontrolli aadressi või proovi hiljem.",
  offline: "Internetiühendus puudub. Import vajab internetti.",
};

/** A static snapshot shipped with the app (public/edupage/<school>/), or null when there is none. */
async function snapshotJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    if (!r.ok || !(r.headers.get("content-type") ?? "").includes("json")) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Timetable data: the shipped snapshot first (instant, and EduPage often refuses cloud servers),
 * then the live proxy.
 */
async function eduList(school: string) {
  const snap = await snapshotJson<{ defaultTt: string; timetables: EduTimetableInfo[]; snapshot?: string }>(`/edupage/${school}/index.json`);
  if (snap?.timetables?.length) return snap;
  return getJson<{ defaultTt: string; timetables: EduTimetableInfo[]; snapshot?: string }>(`/api/edupage?school=${school}`);
}
async function eduData(school: string, tt: string, snapshot?: string) {
  if (snapshot) {
    const d = await snapshotJson<EduData>(`/edupage/${school}/${tt}.json`);
    if (d) return d;
  }
  return getJson<EduData>(`/api/edupage?school=${school}&tt=${tt}`);
}

async function getJson<T>(url: string): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url);
  } catch {
    throw new Error("offline");
  }
  const body = await r.json().catch(() => ({ error: "edupage-unreachable" }));
  if (!r.ok) throw new Error(body?.error ?? "edupage-unreachable");
  return body as T;
}

/** Import a class timetable from a school's public aSc EduPage page. */
export function EduImport({
  onResult,
  actionLabel = "Kasuta seda tunniplaani",
  initial = "",
}: {
  onResult: (r: EduImportResult) => void;
  actionLabel?: string;
  initial?: string;
}) {
  // Shown as a full address so it reads as an editable field, not a label.
  const [input, setInput] = useState(initial && !initial.includes(".") ? `${initial}.edupage.org` : initial);
  const [finishing, setFinishing] = useState(false);
  const [phase, setPhase] = useState<Phase>({ k: "idle" });
  const [classId, setClassId] = useState("");
  const [picks, setPicks] = useState<Record<string, string>>({});
  const school = edupageSchool(input);

  const load = async (tt?: string) => {
    if (!school) return;
    setPhase({ k: "loading" });
    try {
      let list: EduTimetableInfo[];
      let all: EduTimetableInfo[];
      let chosen: string;
      let snapshot: string | undefined;
      if (phase.k === "ready" && tt) {
        ({ list, all, snapshot } = phase);
        chosen = tt;
      } else {
        const r = await eduList(school);
        all = r.timetables;
        snapshot = r.snapshot;
        list = all.filter((t) => !t.hidden);
        if (!list.length) list = all.slice(-1);
        chosen = list.some((t) => t.tt_num === r.defaultTt) ? r.defaultTt : list[list.length - 1].tt_num;
      }
      const data = await eduData(school, chosen, snapshot);
      setPhase({ k: "ready", data, list, all, tt: chosen, snapshot });
      setClassId("");
      setPicks({});
    } catch (e) {
      setPhase({ k: "error", msg: ERRORS[(e as Error).message] ?? ERRORS["edupage-unreachable"] });
    }
  };

  const ready = phase.k === "ready" ? phase : null;
  const divisions = useMemo(() => (ready && classId ? eduDivisions(ready.data, classId) : []), [ready, classId]);
  useEffect(() => {
    // Default every split to its first group so the preview is never empty.
    setPicks(Object.fromEntries(divisions.map((v) => [v.id, v.groups[0].id])));
  }, [divisions]);
  const result = useMemo(() => (ready && classId ? eduTimetable(ready.data, classId, picks) : null), [ready, classId, picks]);
  const perWeek = result ? Object.values(result.timetable).flat().reduce((s, l) => s + l.count, 0) : 0;
  const className = ready?.data.classes.find((c) => c.id === classId)?.name ?? "";

  // Auto-search when opened with a school already filled in (e.g. the RAM shortcut).
  useEffect(() => {
    if (initial && edupageSchool(initial)) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Fetch the other timetables of this school year too, so the whole grading window is exact. */
  const finish = async () => {
    if (!ready || !result) return;
    setFinishing(true);
    const chosenInfo = ready.all.find((t) => t.tt_num === ready.tt) ?? { tt_num: ready.tt, text: "" };
    const start = ttRange(chosenInfo)?.start ?? new Date().toISOString().slice(0, 10);
    const y = Number(start.slice(0, 4)) - (Number(start.slice(5, 7)) >= 8 ? 0 : 1);
    const yearStart = `${y}-08-01`;
    const others = ready.all.filter((t) => t.tt_num !== ready.tt && (ttRange(t)?.start ?? "") >= yearStart && (ttRange(t)?.start ?? "") < `${y + 1}-08-01`);
    const periods: EduPeriod[] = [{ info: chosenInfo, data: ready.data }];
    for (const t of others) {
      try {
        periods.push({ info: t, data: await eduData(school!, t.tt_num, ready.snapshot) });
      } catch {
        /* an older period that will not load: the setup still works with the rest */
      }
    }
    setFinishing(false);
    onResult({ ...result, schoolName: ready.data.schoolName, className, groupNames: pickedGroupNames(ready.data, picks), periods, periodTimes: eduPeriodTimes(ready.data) });
  };

  return (
    <div className="flex flex-col gap-7">
      <Section
        title="Kooli tunniplaan"
        footer={phase.k === "error" ? <span className="text-bad">{phase.msg}</span> : undefined}
        info="Kooli EduPage'i aadress, nt ramkool.edupage.org, või link tunniplaanile. Muuda, kui su kool on teine."
      >
        <form
          noValidate
          className="cell flex items-center gap-3 pl-5 pr-2.5 min-h-[52px]"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <label htmlFor="edu-address" className="shrink-0">
            EduPage
          </label>
          <input
            id="edu-address"
            type="text"
            className="cell-input flex-1 min-w-0 text-right text-accent text-[16px] placeholder:text-faint"
            placeholder="kool.edupage.org"
            aria-label="Kooli EduPage aadress"
            inputMode="url"
            enterKeyHint="go"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button type="submit" variant="ghost" size="sm" className="shrink-0" disabled={!school || phase.k === "loading"}>
            {phase.k === "loading" ? "Otsin…" : "Otsi"}
          </Button>
        </form>
      </Section>

      {ready && (
        <>
          {ready.list.length > 1 && (
            <Section title="Tunniplaan">
              {ready.list.map((t) => (
                <button
                  key={t.tt_num}
                  type="button"
                  role="radio"
                  aria-checked={ready.tt === t.tt_num}
                  onClick={() => load(t.tt_num)}
                  className="cell press flex items-center gap-3 px-5 min-h-[52px] w-full text-left cursor-pointer"
                >
                  <span className="flex-1 text-[15px]">{t.text}</span>
                  <Check on={ready.tt === t.tt_num} />
                </button>
              ))}
            </Section>
          )}

          <Section title={ready.data.schoolName || "Klass"}>
            <label className="cell flex items-center justify-between gap-3 px-5 min-h-[52px]">
              <span>Klass</span>
              <select className="bg-transparent border-0 text-right text-muted text-[17px] max-w-[60%]" value={classId} onChange={(e) => setClassId(e.target.value)} aria-label="Klass">
                <option value="">Vali</option>
                {ready.data.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </Section>

          {divisions.map((v, k) => (
            <Section
              key={v.id}
              title={v.title}
              info={k === divisions.length - 1 ? "Küsin ainult rühmade kohta, mille tunnid on eri päevadel või eri ainetes. Muud valikud ei muuda midagi." : undefined}
            >
              {v.groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  role="radio"
                  aria-checked={picks[v.id] === g.id}
                  onClick={() => setPicks({ ...picks, [v.id]: g.id })}
                  className="cell press flex items-center gap-3 px-5 min-h-[56px] w-full text-left cursor-pointer"
                >
                  <span className="flex-1 min-w-0 py-2">
                    <span className="block truncate">
                      {g.lessons.length ? g.lessons.map((l) => `${l.subject} · ${l.days}`).join("; ") : g.name}
                    </span>
                    {g.lessons.length > 0 && <span className="block text-[13px] text-muted">{g.name}</span>}
                  </span>
                  <Check on={picks[v.id] === g.id} />
                </button>
              ))}
            </Section>
          ))}

          {result && (
            <Section
              footer={
                result.skippedAlternating
                  ? `${result.skippedAlternating} tundi toimub üle nädala ja jäi välja, et piir ei tuleks liiga lõdvalt. Lisa need hiljem käsitsi, kui vaja.`
                  : ready.snapshot
                    ? `Kooli tunniplaan seisuga ${ready.snapshot.split("-").reverse().join(".")}.`
                    : undefined
              }
            >
              <Row detail={<span className="num">{result.subjects.length}</span>}>Ained</Row>
              <Row detail={<span className="num">{perWeek}</span>}>Tunde nädalas</Row>
            </Section>
          )}

          {result && (
            <Button size="lg" className="w-full" disabled={!result.subjects.length || finishing} onClick={finish}>
              {finishing ? "Loen ka varasemaid perioode…" : actionLabel}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
