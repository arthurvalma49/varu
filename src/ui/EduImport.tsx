import { useEffect, useMemo, useState } from "react";
import { eduDivisions, eduTimetable, edupageSchool, pickedGroupNames, ttRange, type EduData, type EduPeriod, type EduResult, type EduTimetableInfo } from "../core/edupage";
import { Button, Check, Row, Section } from "./kit";

export interface EduImportResult extends EduResult {
  schoolName: string;
  className: string;
  /** Group names the student picked, to find the same groups in other periods. */
  groupNames: string[];
  /** Every timetable the school published this school year (the chosen one included). */
  periods: EduPeriod[];
}

type Phase =
  | { k: "idle" }
  | { k: "loading" }
  | { k: "error"; msg: string }
  | { k: "ready"; data: EduData; list: EduTimetableInfo[]; all: EduTimetableInfo[]; tt: string };

const ERRORS: Record<string, string> = {
  "bad-request": "See ei näe välja nagu EduPage aadress. Proovi nt pae.edupage.org.",
  "no-public-timetable": "Sellel koolil pole avalikku tunniplaani EduPage'is.",
  "no-timetable": "Tunniplaani ei õnnestunud lugeda.",
  "edupage-unreachable": "EduPage ei vastanud. Kontrolli aadressi või proovi hiljem.",
  offline: "Internetiühendus puudub. Import vajab internetti.",
};

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
  const [input, setInput] = useState(initial);
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
      if (phase.k === "ready" && tt) {
        ({ list, all } = phase);
        chosen = tt;
      } else {
        const r = await getJson<{ defaultTt: string; timetables: EduTimetableInfo[] }>(`/api/edupage?school=${school}`);
        all = r.timetables;
        list = all.filter((t) => !t.hidden);
        if (!list.length) list = all.slice(-1);
        chosen = list.some((t) => t.tt_num === r.defaultTt) ? r.defaultTt : list[list.length - 1].tt_num;
      }
      const data = await getJson<EduData>(`/api/edupage?school=${school}&tt=${chosen}`);
      setPhase({ k: "ready", data, list, all, tt: chosen });
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
        periods.push({ info: t, data: await getJson<EduData>(`/api/edupage?school=${school}&tt=${t.tt_num}`) });
      } catch {
        /* an older period that will not load: the setup still works with the rest */
      }
    }
    setFinishing(false);
    onResult({ ...result, schoolName: ready.data.schoolName, className, groupNames: pickedGroupNames(ready.data, picks), periods });
  };

  return (
    <div className="flex flex-col gap-7">
      <Section footer={phase.k === "error" ? <span className="text-bad">{phase.msg}</span> : "Kooli EduPage'i aadress või link tunniplaanile. Töötab, kui kool avaldab tunniplaani avalikult."}>
        <form
          className="cell flex items-center gap-3 px-5 min-h-[52px]"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <input
            className="cell-input flex-1 placeholder:text-faint"
            placeholder="nt pae.edupage.org"
            aria-label="Kooli EduPage aadress"
            inputMode="url"
            enterKeyHint="go"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button type="submit" variant="ghost" className="min-h-8 px-3" disabled={!school || phase.k === "loading"}>
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

          {divisions.map((v) => (
            <Section key={v.id} title="Sinu rühm">
              {v.groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  role="radio"
                  aria-checked={picks[v.id] === g.id}
                  onClick={() => setPicks({ ...picks, [v.id]: g.id })}
                  className="cell press flex items-center gap-3 px-5 min-h-[50px] w-full text-left cursor-pointer"
                >
                  <span className="flex-1">{g.name}</span>
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
                  : "Loen ka selle õppeaasta varasemad tunniplaanid, et tundide arv oleks kogu perioodi kohta õige. Ühekordseid üritusi tunniplaan ei tea."
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
