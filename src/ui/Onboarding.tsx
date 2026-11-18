import { useEffect, useState, type ReactNode } from "react";
import { isValidISO } from "../core/dates";
import { SCHOOLS } from "../core/schools";
import { COMMON_SUBJECTS, buildSetup, defaultWindow, startingAbsence, subjectId, type SetupDraft } from "../core/setup";
import { decodeSetup } from "../core/share";
import { emptyTimetable, ram9bTemplate } from "../core/templates";
import type { Absence, Setup } from "../core/types";
import { Button, Card, Chip, Icon, Label, Stepper, fmtDate, fmtLimit, limitPhrase, tunde } from "./kit";
import { WeekEditor } from "./WeekEditor";

const DRAFT_KEY = "varu:draft";
type Step = "start" | "school" | "subjects" | "timetable" | "start-counts";
const STEPS: Step[] = ["school", "subjects", "timetable", "start-counts"];

function freshDraft(today: string): SetupDraft {
  return {
    schoolId: "ram",
    schoolName: "",
    className: "",
    window: defaultWindow(today, "ram"),
    subjectNames: [],
    timetable: emptyTimetable(),
    timetableFrom: defaultWindow(today, "ram").start,
    baseline: {},
  };
}
function loadDraft(today: string): { step: Step; draft: SetupDraft } {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      const v = JSON.parse(raw);
      if (v?.draft?.timetable && STEPS.includes(v.step)) return v;
    }
  } catch {
    /* storage blocked: start fresh */
  }
  return { step: "start", draft: freshDraft(today) };
}

export function Onboarding({
  onDone,
  incoming,
  today,
}: {
  /** `fresh`: set up by hand here, so the overview offers to share it. */
  onDone: (s: Setup, absences?: Absence[], fresh?: boolean) => void;
  incoming: Setup | null;
  today: string;
}) {
  const [{ step, draft }, setState] = useState(() => loadDraft(today));
  const [counts, setCounts] = useState<Record<string, number>>({});
  const setStep = (s: Step) => {
    setState((v) => ({ ...v, step: s }));
    window.scrollTo({ top: 0 });
  };
  const patch = (p: Partial<SetupDraft>) => setState((v) => ({ ...v, draft: { ...v.draft, ...p } }));

  useEffect(() => {
    try {
      if (STEPS.includes(step)) localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, draft }));
      else if (step === "start") localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  }, [step, draft]);

  const finish = (s: Setup, a?: Absence[], fresh?: boolean) => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    onDone(s, a, fresh);
  };

  if (incoming)
    return (
      <Card className="gap-4">
        <h2 className="text-2xl font-bold m-0">Said klassikaaslaselt seadistuse</h2>
        <p className="m-0 text-muted">
          {incoming.schoolName} {incoming.className} · {incoming.windowName} · {incoming.subjects.length} ainet · {limitPhrase(incoming.rule)}.
        </p>
        <div>
          <Button onClick={() => finish(incoming)}>Kasuta seda</Button>
        </div>
      </Card>
    );

  if (step === "start") return <Start onRam={() => finish(ram9bTemplate())} onCode={(s) => finish(s)} onCustom={() => setStep("school")} />;

  const idx = STEPS.indexOf(step);
  const back = () => setStep(idx > 0 ? STEPS[idx - 1] : "start");
  const subjects = draft.subjectNames.map((n) => ({ id: subjectId(n), name: n }));
  const used = new Set(Object.values(draft.timetable).flat().map((l) => l.subjectId));
  const usedSubjects = subjects.filter((s) => used.has(s.id));
  const lateStart = draft.timetableFrom > draft.window.start;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" aria-label="Tagasi" className="px-3 shrink-0" onClick={back}>
          <Icon name="left" />
        </Button>
        <div className="flex-1 grid grid-cols-4 gap-1" aria-label={`Samm ${idx + 1} / ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <span key={s} className={`h-1.5 rounded-full ${i <= idx ? "bg-accent" : "bg-surface-2"}`} />
          ))}
        </div>
      </div>

      {step === "school" && (
        <SchoolStep
          draft={draft}
          today={today}
          patch={patch}
          onNext={() => setStep("subjects")}
        />
      )}

      {step === "subjects" && (
        <Card className="gap-4">
          <div>
            <h2 className="text-2xl font-bold m-0">Mis aineid sul on?</h2>
            <p className="m-0 mt-1 text-muted text-[15px]">Vali kõik, mis on sinu tunniplaanis.</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[...COMMON_SUBJECTS, ...draft.subjectNames.filter((n) => !COMMON_SUBJECTS.includes(n))].map((n) => {
              const on = draft.subjectNames.includes(n);
              return (
                <Chip
                  key={n}
                  on={on}
                  onClick={() =>
                    patch({
                      subjectNames: on
                        ? draft.subjectNames.filter((x) => x !== n)
                        : [...COMMON_SUBJECTS, ...draft.subjectNames].filter((x, i, a) => a.indexOf(x) === i && (x === n || draft.subjectNames.includes(x))),
                    })
                  }
                >
                  {n}
                </Chip>
              );
            })}
          </div>
          <AddName onAdd={(n) => !draft.subjectNames.includes(n) && patch({ subjectNames: [...draft.subjectNames, n] })} />
          <Next disabled={!draft.subjectNames.length} onClick={() => setStep("timetable")}>
            Edasi{draft.subjectNames.length ? ` (${draft.subjectNames.length} ainet)` : ""}
          </Next>
        </Card>
      )}

      {step === "timetable" && (
        <Card className="gap-4">
          <div>
            <h2 className="text-2xl font-bold m-0">Sinu tunniplaan</h2>
            <p className="m-0 mt-1 text-muted text-[15px]">Iga päeva kohta puuduta aineid tundide järjekorras. Vaheajad on juba arvestatud.</p>
          </div>
          <WeekEditor subjects={subjects} timetable={draft.timetable} onChange={(timetable) => patch({ timetable })} />
          <details className="rounded-xl border border-line px-3 group" open={lateStart}>
            <summary className="min-h-11 flex items-center cursor-pointer text-[15px] list-none [&::-webkit-details-marker]:hidden">
              Tunniplaan muutus poolaasta sees?
            </summary>
            <div className="pb-3 flex flex-col gap-1.5">
              <Label htmlFor="tfrom">See tunniplaan kehtib alates</Label>
              <input
                id="tfrom"
                type="date"
                className="field num"
                min={draft.window.start}
                max={draft.window.end}
                value={draft.timetableFrom}
                onChange={(e) => isValidISO(e.target.value) && patch({ timetableFrom: e.target.value })}
              />
              <div className="text-[13px] text-muted">Siis küsin järgmisena, mitu tundi igas aines enne seda toimus (vaata e-koolist).</div>
            </div>
          </details>
          <Next disabled={!usedSubjects.length} onClick={() => setStep("start-counts")}>
            Edasi
          </Next>
        </Card>
      )}

      {step === "start-counts" && (
        <StartCounts
          draft={draft}
          subjects={usedSubjects}
          lateStart={lateStart}
          counts={counts}
          setCounts={setCounts}
          patch={patch}
          today={today}
          onFinish={() => {
            const s = buildSetup(draft);
            const a = startingAbsence(s, counts, new Date().toISOString());
            finish(s, a ? [a] : undefined, true);
          }}
        />
      )}
    </div>
  );
}

function Start({ onRam, onCode, onCustom }: { onRam: () => void; onCode: (s: Setup) => void; onCustom: () => void }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  return (
    <div className="flex flex-col gap-4">
      <div className="px-1 pt-2">
        <h1 className="text-[clamp(32px,9vw,44px)] font-bold leading-[1.02] tracking-[-0.03em] m-0">Kui palju tunde võid veel puududa?</h1>
        <p className="text-muted mt-3 mb-0 max-w-[48ch] text-[17px]">
          Varu näitab iga aine kohta, palju sul enne kooli puudumiste piiri varu on, ja ütleb enne, kas homme võid puududa.
        </p>
      </div>

      <Card className="gap-3">
        <h2 className="text-lg font-bold m-0">Klassikaaslane juba seadistas?</h2>
        <p className="m-0 text-sm text-muted">Ava tema jagatud link või kleebi kood. Tunniplaan tuleb kaasa, sinu puudumised jäävad sinu teada.</p>
        <div className="flex gap-2">
          <input
            className="field font-mono text-sm min-w-0"
            aria-label="Jagamiskood või link"
            placeholder="Kood või link"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setErr("");
            }}
          />
          <Button
            variant="ghost"
            disabled={!code.trim()}
            onClick={() => {
              const s = decodeSetup(code.trim().replace(/^.*#setup=/, ""));
              s ? onCode(s) : setErr("See kood ei tööta. Kopeeri see uuesti tervikuna.");
            }}
          >
            Lae
          </Button>
        </div>
        {err && <div className="text-sm text-bad">{err}</div>}
      </Card>

      <Card className="gap-3">
        <h2 className="text-lg font-bold m-0">Seadista ise</h2>
        <p className="m-0 text-sm text-muted">Kool, ained ja tunniplaan. Umbes kaks minutit, siis saad selle klassikaaslastega jagada.</p>
        <div>
          <Button onClick={onCustom}>Alusta</Button>
        </div>
        <button type="button" onClick={onRam} className="text-left rounded-xl border border-line px-3 py-2.5 cursor-pointer hover:bg-surface-2 mt-1">
          <div className="font-bold">Rocca al Mare Kool · 9.b</div>
          <div className="text-sm text-muted">Valmis seadistus: I poolaasta 2026/27 tunniplaan ja 1. perioodi tunnid.</div>
        </button>
      </Card>
    </div>
  );
}

function SchoolStep({ draft, today, patch, onNext }: { draft: SetupDraft; today: string; patch: (p: Partial<SetupDraft>) => void; onNext: () => void }) {
  const [editDates, setEditDates] = useState(false);
  const school = SCHOOLS.find((s) => s.id === draft.schoolId);
  return (
    <Card className="gap-4">
      <h2 className="text-2xl font-bold m-0">Kool ja klass</h2>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ob-school">Kool</Label>
        <select
          id="ob-school"
          className="field"
          value={draft.schoolId}
          onChange={(e) => {
            const w = defaultWindow(today, e.target.value);
            patch({ schoolId: e.target.value, window: w, timetableFrom: w.start });
          }}
        >
          {SCHOOLS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
          <option value="custom">Muu kool</option>
        </select>
        {draft.schoolId === "custom" && (
          <input className="field" aria-label="Kooli nimi" placeholder="Kooli nimi" value={draft.schoolName} onChange={(e) => patch({ schoolName: e.target.value })} />
        )}
        <div className="text-[13px] text-muted">
          {school ? (
            <>
              Piir: {limitPhrase(school.rule)}. {school.verified ? "" : "Kontrolli oma kooli hindamisjuhendist."}
            </>
          ) : (
            `Piiriks on alguses ${fmtLimit(SCHOOLS[0].rule.limit)}. Muuda seda hiljem seadetes oma kooli reegli järgi.`
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ob-class">Klass</Label>
        <input id="ob-class" className="field" placeholder="nt 9.b" value={draft.className} onChange={(e) => patch({ className: e.target.value })} />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Arvestusperiood</span>
        {editDates ? (
          <div className="flex flex-col gap-2">
            <input className="field" aria-label="Perioodi nimi" value={draft.window.name} onChange={(e) => patch({ window: { ...draft.window, name: e.target.value } })} />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                aria-label="Algus"
                className="field num min-w-0"
                value={draft.window.start}
                onChange={(e) => isValidISO(e.target.value) && patch({ window: { ...draft.window, start: e.target.value }, timetableFrom: e.target.value })}
              />
              <input
                type="date"
                aria-label="Viimane arvesse minev päev"
                className="field num min-w-0"
                value={draft.window.end}
                onChange={(e) => isValidISO(e.target.value) && patch({ window: { ...draft.window, end: e.target.value } })}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 pl-3 pr-1 min-h-12">
            <span className="num text-[15px]">
              {draft.window.name}: {fmtDate(draft.window.start)} – {fmtDate(draft.window.end)}
            </span>
            <Button variant="quiet" className="text-sm" onClick={() => setEditDates(true)}>
              Muuda
            </Button>
          </div>
        )}
      </div>
      <Next disabled={draft.schoolId === "custom" && !draft.schoolName.trim()} onClick={onNext}>
        Edasi
      </Next>
    </Card>
  );
}

function StartCounts({
  draft,
  subjects,
  lateStart,
  counts,
  setCounts,
  patch,
  today,
  onFinish,
}: {
  draft: SetupDraft;
  subjects: { id: string; name: string }[];
  lateStart: boolean;
  counts: Record<string, number>;
  setCounts: (c: Record<string, number>) => void;
  patch: (p: Partial<SetupDraft>) => void;
  today: string;
  onFinish: () => void;
}) {
  const started = today >= draft.window.start;
  const missed = Object.values(counts).reduce((s, n) => s + n, 0);
  return (
    <Card className="gap-4">
      {lateStart && (
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold m-0">Tunnid enne {fmtDate(draft.timetableFrom)}</h2>
          <p className="m-0 text-muted text-[15px]">Mitu tundi igas aines toimus enne uut tunniplaani? Vaata e-koolist (tunnid kokku, mitte puudumised).</p>
          {subjects.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 min-h-12">
              <span className="min-w-0 truncate">{s.name}</span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                aria-label={`${s.name}: tunde enne`}
                className="field num w-24 text-center"
                value={draft.baseline[s.id] ?? ""}
                placeholder="0"
                onChange={(e) => patch({ baseline: { ...draft.baseline, [s.id]: Math.max(0, Math.round(Number(e.target.value) || 0)) } })}
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <h2 className={`font-bold m-0 ${lateStart ? "text-xl mt-2" : "text-2xl"}`}>Oled juba puudunud?</h2>
        <p className="m-0 text-muted text-[15px]">
          {started
            ? `Märgi, mitu tundi igas aines oled sel perioodil juba puudunud. Kui ei tea, jäta 0 ja lisa hiljem.`
            : "Periood pole veel alanud, seega ilmselt mitte. Jäta kõik 0."}
        </p>
      </div>
      <div className="flex flex-col">
        {subjects.map((s, i) => (
          <div key={s.id} className={`flex items-center justify-between gap-3 py-1.5 ${i ? "border-t border-line" : ""}`}>
            <span className="min-w-0 truncate">{s.name}</span>
            <Stepper label={s.name} value={counts[s.id] ?? 0} onChange={(n) => setCounts({ ...counts, [s.id]: n })} />
          </div>
        ))}
      </div>
      <Next onClick={onFinish}>{missed ? `Valmis (${tunde(missed)} puudutud)` : "Valmis"}</Next>
    </Card>
  );
}

function AddName({ onAdd }: { onAdd: (n: string) => void }) {
  const [v, setV] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const n = v.trim();
        if (n) onAdd(n.charAt(0).toUpperCase() + n.slice(1));
        setV("");
      }}
    >
      <input className="field min-w-0" placeholder="Muu aine" aria-label="Muu aine nimi" value={v} onChange={(e) => setV(e.target.value)} />
      <Button type="submit" variant="ghost" disabled={!v.trim()}>
        Lisa
      </Button>
    </form>
  );
}

function Next({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <Button onClick={onClick} disabled={disabled} className="w-full min-h-12 text-base">
      {children}
    </Button>
  );
}
