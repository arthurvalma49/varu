import { useEffect, useState, type ReactNode } from "react";
import { isValidISO } from "../core/dates";
import { SCHOOLS } from "../core/schools";
import { COMMON_SUBJECTS, buildSetup, defaultWindow, startingAbsence, subjectId, type SetupDraft } from "../core/setup";
import { eduSegments } from "../core/edupage";
import { decodeSetup } from "../core/share";
import { emptyTimetable, ram9bTemplate } from "../core/templates";
import type { Absence, Setup } from "../core/types";
import { InstallHint } from "./InstallHint";
import { Button, Check, DateField, Icon, NavBar, Row, Section, Stepper, Switch, fmtLimit, limitPhrase, tunde, type IconName } from "./kit";
import { EduImport } from "./EduImport";
import { WeekEditor } from "./WeekEditor";

const DRAFT_KEY = "varu:draft";
/**
 * Kept as short as possible: start, school + EduPage import on one screen, then "already missed?".
 * Schools without EduPage take the longer manual path (subjects, then the weekly timetable).
 */
type Step = "start" | "school" | "subjects" | "timetable" | "start-counts";
const SETUP_STEPS: Step[] = ["school", "subjects", "timetable", "start-counts"];
const flowFor = (source: SetupDraft["source"]): Step[] => (source === "manual" ? SETUP_STEPS : ["school", "start-counts"]);
const STEP_TITLE: Partial<Record<Step, string>> = { school: "Sinu kool", subjects: "Ained", timetable: "Tunniplaan", "start-counts": "Juba puudunud?" };

const store = {
  get(k: string) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string | null) {
    try {
      v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v);
    } catch {
      /* storage blocked: fine, the flow still works */
    }
  },
};

function freshDraft(today: string): SetupDraft {
  const w = defaultWindow(today, "ram");
  return { schoolId: "ram", schoolName: "", className: "", window: w, subjectNames: [], timetable: emptyTimetable(), timetableFrom: w.start, baseline: {} };
}
function initial(today: string): { step: Step; draft: SetupDraft } {
  try {
    const raw = store.get(DRAFT_KEY);
    if (raw) {
      const v = JSON.parse(raw);
      if (v?.draft?.timetable && SETUP_STEPS.includes(v.step)) return v;
    }
  } catch {
    /* corrupted draft: start over */
  }
  return { step: "start", draft: freshDraft(today) };
}

export function Onboarding({
  onDone,
  incoming,
  today,
}: {
  onDone: (s: Setup, absences?: Absence[], fresh?: boolean) => void;
  incoming: Setup | null;
  today: string;
}) {
  const [{ step, draft }, setState] = useState(() => initial(today));
  const [counts, setCounts] = useState<Record<string, number>>({});
  const setStep = (s: Step) => {
    setState((v) => ({ ...v, step: s }));
    window.scrollTo({ top: 0 });
  };
  const patch = (p: Partial<SetupDraft>) => setState((v) => ({ ...v, draft: { ...v.draft, ...p } }));

  useEffect(() => {
    if (SETUP_STEPS.includes(step)) store.set(DRAFT_KEY, JSON.stringify({ step, draft }));
    else store.set(DRAFT_KEY, null);
  }, [step, draft]);

  const finish = (s: Setup, a?: Absence[], fresh?: boolean) => {
    store.set(DRAFT_KEY, null);
    onDone(s, a, fresh);
  };

  if (incoming)
    return (
      <Welcome
        title="Said klassikaaslaselt tunniplaani"
        body={`${incoming.schoolName} ${incoming.className} · ${incoming.windowName} · ${incoming.subjects.length} ainet · ${limitPhrase(incoming.rule)}.`}
        primary={{ label: "Kasuta seda", onClick: () => finish(incoming) }}
      />
    );

  if (step === "start") return <Start onRam9b={() => finish(ram9bTemplate())} onCode={(s) => finish(s)} onSetup={() => setStep("school")} />;

  const flow = flowFor(draft.source);
  const idx = Math.max(0, flow.indexOf(step));
  const back = () => setStep(idx > 0 ? flow[idx - 1] : "start");
  const subjects = draft.subjectNames.map((n) => ({ id: subjectId(n), name: n }));
  const used = new Set(Object.values(draft.timetable).flat().map((l) => l.subjectId));
  const usedSubjects = subjects.filter((s) => used.has(s.id));
  const lateStart = draft.timetableFrom > draft.window.start;

  const next: { label: string; disabled?: boolean; onClick: () => void } =
    step === "subjects"
        ? { label: draft.subjectNames.length ? `Edasi (${draft.subjectNames.length} ainet)` : "Vali ained", disabled: !draft.subjectNames.length, onClick: () => setStep("timetable") }
        : step === "timetable"
          ? { label: usedSubjects.length ? "Edasi" : "Lisa tunnid", disabled: !usedSubjects.length, onClick: () => setStep("start-counts") }
          : {
              label: (() => {
                const n = Object.values(counts).reduce((s, x) => s + x, 0);
                return n ? `Valmis (${tunde(n)} puudutud)` : "Valmis";
              })(),
              onClick: () => {
                const s = buildSetup(draft);
                const a = startingAbsence(s, counts, new Date().toISOString());
                finish(s, a ? [a] : undefined, true);
              },
            };

  return (
    <div key={step} className="flex flex-col gap-7 pb-28 push-in">
      <NavBar
        title={step === "timetable" && draft.source !== "manual" ? "Kontrolli üle" : STEP_TITLE[step]!}
        onBack={back}
        trailing={<span className="num text-[13px] text-muted pr-1">{idx + 1}/{flow.length}</span>}
      />

      {step === "school" && (
        <>
          <SchoolStep draft={draft} today={today} patch={patch} />
          <EduImport
            key={draft.schoolId}
            actionLabel="Edasi"
            initial={draft.schoolId === "ram" ? "ramkool" : ""}
            onResult={(r) => {
              const { segments, subjects } = eduSegments(r.periods, r.className, r.groupNames, draft.window.start, draft.window.end);
              const real = segments.filter((sg) => !sg.assumed);
              const current = real.find((sg) => today >= sg.start && today <= sg.end) ?? real[real.length - 1] ?? null;
              setState({
                step: "start-counts",
                draft: {
                  ...draft,
                  source: "edupage",
                  schoolName: draft.schoolId === "custom" && !draft.schoolName.trim() ? r.schoolName : draft.schoolName,
                  className: r.className || draft.className,
                  timetableFrom: draft.window.start,
                  subjectNames: (subjects.length ? subjects : r.subjects).map((x) => x.name),
                  timetable: current?.timetable ?? r.timetable,
                  segments: segments.length ? segments : undefined,
                  currentSegId: current?.id,
                  baseline: {},
                  periodTimes: r.periodTimes,
                },
              });
              window.scrollTo({ top: 0 });
            }}
          />
          <Section>
            <Row
              onClick={() => {
                setState((v) => ({ step: "subjects", draft: { ...v.draft, source: "manual", segments: undefined, currentSegId: undefined, periodTimes: undefined } }));
                window.scrollTo({ top: 0 });
              }}
              chevron
            >
              <span className="text-accent">Kool ei kasuta EduPage'i? Sisesta käsitsi</span>
            </Row>
          </Section>
        </>
      )}

      {step === "subjects" && (
        <>
          <Lead title="Mis aineid sul on?" text="Vali kõik, mis on sinu tunniplaanis." />
          <Section>
            {[...COMMON_SUBJECTS, ...draft.subjectNames.filter((n) => !COMMON_SUBJECTS.includes(n))].map((n) => {
              const on = draft.subjectNames.includes(n);
              return (
                <button
                  key={n}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() =>
                    patch({
                      subjectNames: on
                        ? draft.subjectNames.filter((x) => x !== n)
                        : [...COMMON_SUBJECTS, ...draft.subjectNames].filter((x, i, a) => a.indexOf(x) === i && (x === n || draft.subjectNames.includes(x))),
                    })
                  }
                  className="cell press flex items-center gap-3 px-5 min-h-[50px] w-full text-left cursor-pointer"
                >
                  <span className="flex-1">{n}</span>
                  <Check on={on} />
                </button>
              );
            })}
            <AddName onAdd={(n) => !draft.subjectNames.includes(n) && patch({ subjectNames: [...draft.subjectNames, n] })} />
          </Section>
        </>
      )}

      {step === "timetable" && (
        <>
          <Lead title="Sinu tunniplaan" text="Iga päeva kohta puuduta aineid tundide järjekorras. Vaheajad on juba arvestatud." />
          <div className="bg-surface rounded-[26px] p-4">
            <WeekEditor subjects={subjects} timetable={draft.timetable} onChange={(timetable) => patch({ timetable })} />
          </div>
          {draft.segments?.length ? (
            <Section title="Perioodid EduPage'ist" info="Ülal muudad praegust perioodi. Teiste perioodide tunnid tulevad kooli tunniplaanist. Ühekordseid üritusi (nt ekskursioon) tunniplaan ei tea, need lisa vabade päevade alla.">
              {draft.segments.map((sg) => (
                <Row key={sg.id} detail={<span className="num text-[15px]">{fmtShort(sg.start)} – {fmtShort(sg.end)}</span>}>
                  <span className={sg.id === draft.currentSegId ? "font-semibold" : sg.assumed ? "text-muted" : ""}>
                    {sg.name}
                    {sg.assumed ? " (eeldatud)" : ""}
                  </span>
                </Row>
              ))}
            </Section>
          ) : (
          <Section footer={lateStart ? "Järgmisena küsin, mitu tundi igas aines enne seda toimus." : "Näiteks kui periood vahetus ja tunniplaan muutus."}>
            <div className="cell flex items-center justify-between gap-3 px-5 min-h-[52px]">
              <span>Tunniplaan muutus perioodi sees</span>
              <Switch
                label="Tunniplaan muutus perioodi sees"
                checked={lateStart}
                onChange={(v) => patch({ timetableFrom: v ? (today > draft.window.start && today < draft.window.end ? today : draft.window.start) : draft.window.start })}
              />
            </div>
            {lateStart && (
              <DateField
                label="Kehtib alates"
                min={draft.window.start}
                max={draft.window.end}
                value={draft.timetableFrom}
                onChange={(v) => isValidISO(v) && patch({ timetableFrom: v })}
              />
            )}
          </Section>
          )}
        </>
      )}

      {step === "start-counts" && (
        <>
          {lateStart && (
            <Section title="Tunnid enne uut tunniplaani" footer="Tunnid kokku, mitte puudumised. Vaata e-koolist.">
              {usedSubjects.map((s) => (
                <label key={s.id} className="cell flex items-center justify-between gap-3 px-5 min-h-[52px]">
                  <span className="min-w-0 truncate">{s.name}</span>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    aria-label={`${s.name}: tunde enne`}
                    className="num bg-transparent border-0 text-right w-16 text-[17px] placeholder:text-faint"
                    value={draft.baseline[s.id] ?? ""}
                    placeholder="0"
                    onChange={(e) => patch({ baseline: { ...draft.baseline, [s.id]: Math.max(0, Math.round(Number(e.target.value) || 0)) } })}
                  />
                </label>
              ))}
            </Section>
          )}
          <Lead
            title="Oled juba puudunud?"
            text={today >= draft.window.start ? "Mitu tundi sel perioodil? Vaata Stuudiumist. Kui ei tea, jäta 0." : "Periood pole veel alanud, jäta kõik 0."}
          />
          <Section>
            {usedSubjects.map((s) => (
              <div key={s.id} className="cell flex items-center justify-between gap-3 px-5 min-h-[56px]">
                <span className="min-w-0 truncate">{s.name}</span>
                <Stepper label={s.name} value={counts[s.id] ?? 0} onChange={(n) => setCounts({ ...counts, [s.id]: n })} />
              </div>
            ))}
          </Section>
        </>
      )}

      {step !== "school" && (
      <div className="fixed inset-x-0 bottom-0 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-6 bg-gradient-to-t from-bg via-bg to-bg/0">
        <div className="max-w-[640px] mx-auto">
          <Button size="lg" className="w-full" disabled={next.disabled} onClick={next.onClick}>
            {next.label}
          </Button>
        </div>
      </div>
      )}
    </div>
  );
}

/* ---------- Intro ---------- */

function Welcome({
  title,
  body,
  features,
  primary,
  secondary,
  extra,
}: {
  extra?: ReactNode;
  title: string;
  body?: string;
  features?: { icon: IconName; title: string; text: string }[];
  primary: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
}) {
  return (
    <div className="min-h-dvh flex flex-col pt-[calc(env(safe-area-inset-top)+56px)] pb-[calc(env(safe-area-inset-bottom)+16px)] fade-in">
      <div className="px-2 flex-1">
        <div className="pop size-16 rounded-[18px] bg-accent text-accent-ink grid place-items-center mb-6 shadow-[0_8px_24px_-8px_var(--accent)]">
          <Icon name="check" size={34} stroke={2.6} />
        </div>
        <h1 className="rise m-0 text-[34px] leading-[40px] font-bold" style={{ animationDelay: "120ms" }}>
          {title}
        </h1>
        {body && (
          <p className="rise mt-3 mb-0 text-[17px] text-muted" style={{ animationDelay: "200ms" }}>
            {body}
          </p>
        )}
        {features && (
          <ul className="list-none p-0 mt-9 mb-0 flex flex-col gap-6">
            {features.map((f, i) => (
              <li key={f.title} className="rise flex gap-4 items-start" style={{ animationDelay: `${300 + i * 110}ms` }}>
                <span className="shrink-0 size-11 rounded-full bg-accent-soft text-accent grid place-items-center">
                  <Icon name={f.icon} size={22} />
                </span>
                <div>
                  <div className="font-semibold text-[17px]">{f.title}</div>
                  <div className="text-[15px] text-muted leading-[20px] mt-0.5">{f.text}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {extra && (
        <div className="mt-8 rise" style={{ animationDelay: "700ms" }}>
          {extra}
        </div>
      )}
      <div className="rise flex flex-col gap-1 mt-10" style={{ animationDelay: "760ms" }}>
        <Button size="lg" className="w-full" onClick={primary.onClick}>
          {primary.label}
        </Button>
        {secondary && (
          <Button variant="quiet" size="lg" className="w-full" onClick={secondary.onClick}>
            {secondary.label}
          </Button>
        )}
      </div>
    </div>
  );
}

function Start({ onRam9b, onCode, onSetup }: { onRam9b: () => void; onCode: (s: Setup) => void; onSetup: () => void }) {
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  return (
    <div className="min-h-dvh flex flex-col pt-[calc(env(safe-area-inset-top)+56px)] pb-[calc(env(safe-area-inset-bottom)+16px)] fade-in">
      <div className="px-2 flex-1">
        <div className="pop size-16 rounded-[18px] bg-accent text-accent-ink grid place-items-center mb-6 shadow-[0_8px_24px_-8px_var(--accent)]">
          <Icon name="check" size={34} stroke={2.6} />
        </div>
        <h1 className="rise m-0 text-[34px] leading-[40px] font-bold" style={{ animationDelay: "120ms" }}>
          Kui palju võid veel puududa?
        </h1>
        <p className="rise mt-3 mb-0 text-[17px] text-muted" style={{ animationDelay: "200ms" }}>
          Näed iga tunni kohta kohe: võid või ei.
        </p>
      </div>
      <div className="mt-8 rise" style={{ animationDelay: "300ms" }}>
        <InstallHint early />
      </div>
      {codeOpen && (
        <div className="mt-6">
          <Section title="Klassikaaslase kood" footer={err ? <span className="text-bad">{err}</span> : undefined}>
            <div className="cell flex items-center gap-3 pl-5 pr-2.5 min-h-[52px]">
              <input
                className="cell-input font-mono text-[16px] flex-1 placeholder:text-faint placeholder:font-sans placeholder:text-[17px]"
                enterKeyHint="go"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
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
                size="sm"
                className="shrink-0"
                disabled={!code.trim()}
                onClick={() => {
                  const s = decodeSetup(code.trim().replace(/^.*#setup=/, ""));
                  s ? onCode(s) : setErr("See kood ei tööta. Kopeeri see uuesti tervikuna.");
                }}
              >
                Lae
              </Button>
            </div>
          </Section>
        </div>
      )}
      <div className="rise flex flex-col gap-1 mt-8" style={{ animationDelay: "380ms" }}>
        <Button size="lg" className="w-full" onClick={onSetup}>
          Alusta
        </Button>
        <div className="flex justify-center flex-wrap gap-x-2">
          {!codeOpen && (
            <Button variant="quiet" onClick={() => setCodeOpen(true)}>
              Mul on kood
            </Button>
          )}
          <Button variant="quiet" className="text-muted" onClick={onRam9b}>
            RAM 9.b näidis
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Just the school: the class comes from EduPage, the period dates from the school (both editable in Seaded). */
function SchoolStep({ draft, today, patch }: { draft: SetupDraft; today: string; patch: (p: Partial<SetupDraft>) => void }) {
  const school = SCHOOLS.find((s) => s.id === draft.schoolId);
  return (
    <Section footer={school ? `Piir: ${limitPhrase(school.rule)}.` : `Piir alguses ${fmtLimit(SCHOOLS[0].rule.limit)}, muuda seadetes.`}>
      <label className="cell flex items-center justify-between gap-3 px-5 min-h-[52px]">
        <span>Kool</span>
        <select
          id="ob-school"
          className="bg-transparent border-0 text-right text-muted text-[17px] max-w-[62%]"
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
      </label>
      {draft.schoolId === "custom" && (
        <label className="cell flex items-center px-5">
          <input className="cell-input placeholder:text-faint" aria-label="Kooli nimi" placeholder="Kooli nimi" value={draft.schoolName} onChange={(e) => patch({ schoolName: e.target.value })} />
        </label>
      )}
    </Section>
  );
}

const fmtShort = (ds: string) => `${Number(ds.slice(8, 10))}.${Number(ds.slice(5, 7))}.`;

function Lead({ title, text }: { title: string; text: string }) {
  return (
    <div className="px-2 -mb-2">
      <h1 className="m-0 text-[28px] leading-[34px] font-bold">{title}</h1>
      <p className="mt-1.5 mb-0 text-[15px] text-muted">{text}</p>
    </div>
  );
}

function AddName({ onAdd }: { onAdd: (n: string) => void }) {
  const [v, setV] = useState("");
  return (
    <form
      className="cell flex items-center gap-3 pl-5 pr-2.5 min-h-[52px]"
      onSubmit={(e) => {
        e.preventDefault();
        const n = v.trim();
        if (n) onAdd(n.charAt(0).toUpperCase() + n.slice(1));
        setV("");
      }}
    >
      <input className="cell-input flex-1 placeholder:text-faint" enterKeyHint="done" autoCapitalize="sentences" placeholder="Muu aine" aria-label="Muu aine nimi" value={v} onChange={(e) => setV(e.target.value)} />
      <Button type="submit" variant="ghost" size="sm" className="shrink-0" disabled={!v.trim()}>
        Lisa
      </Button>
    </form>
  );
}
