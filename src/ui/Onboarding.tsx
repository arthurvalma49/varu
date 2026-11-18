import { useEffect, useState, type ReactNode } from "react";
import { maxAllowed } from "../core/calc";
import { isValidISO } from "../core/dates";
import { SCHOOLS } from "../core/schools";
import { COMMON_SUBJECTS, buildSetup, defaultWindow, startingAbsence, subjectId, type SetupDraft } from "../core/setup";
import { eduSegments } from "../core/edupage";
import { decodeSetup } from "../core/share";
import { emptyTimetable, ram9bTemplate } from "../core/templates";
import type { Absence, Setup } from "../core/types";
import { Button, Check, Icon, NavBar, Row, Section, Stepper, Switch, fmtLimit, limitPhrase, tunde, type IconName } from "./kit";
import { EduImport } from "./EduImport";
import { WeekEditor } from "./WeekEditor";

const DRAFT_KEY = "varu:draft";
const INTRO_KEY = "varu:intro-seen";
type Step = "intro" | "rule" | "start" | "edupage" | "school" | "subjects" | "timetable" | "start-counts";
const SETUP_STEPS: Step[] = ["school", "subjects", "timetable", "start-counts"];
const STEP_TITLE: Partial<Record<Step, string>> = { school: "Kool ja klass", subjects: "Ained", timetable: "Tunniplaan", "start-counts": "Algseis" };

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
  return { step: store.get(INTRO_KEY) ? "start" : "intro", draft: freshDraft(today) };
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
  const [eduInitial, setEduInitial] = useState("");
  const setStep = (s: Step) => {
    if (s === "start") store.set(INTRO_KEY, "1");
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
    store.set(INTRO_KEY, "1");
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

  if (step === "intro")
    return (
      <Welcome
        title="Kui palju tunde võid veel puududa?"
        features={[
          { icon: "check", title: "Kas võid selle tunni vahele jätta?", text: "Näed iga tänase tunni kohta kohe: võid või ei." },
          { icon: "gauge", title: "Varu igas aines", text: "Mitu tundi on igas aines alles enne kooli piiri." },
          { icon: "calendar", title: "Plaani ette", text: "Reis või võistlus? Kontrolli enne, kas see viiks üle piiri." },
          { icon: "lock", title: "Ainult sinu telefonis", text: "Puudumised ei lahku su seadmest. Klassiga jagad ainult tunniplaani." },
        ]}
        primary={{ label: "Jätka", onClick: () => setStep("rule") }}
        secondary={{ label: "Jäta vahele", onClick: () => setStep("start") }}
      />
    );

  if (step === "rule") return <RuleIntro onNext={() => setStep("start")} onBack={() => setStep("intro")} />;

  if (step === "start")
    return (
      <Start
        onRam={() => {
          setEduInitial("ramkool");
          setStep("edupage");
        }}
        onRam9b={() => finish(ram9bTemplate())}
        onCode={(s) => finish(s)}
        onCustom={() => setStep("school")}
        onEdupage={() => {
          setEduInitial("");
          setStep("edupage");
        }}
        onIntro={() => setStep("intro")}
      />
    );

  if (step === "edupage")
    return (
      <div className="flex flex-col gap-7 pb-10">
        <NavBar title="EduPage" onBack={() => setStep("start")} />
        <Lead title="Impordi EduPage'ist" text="Kui sinu kool avaldab tunniplaani edupage.org-is, tõmban selle sealt. Siis vali klass ja oma rühmad." />
        <EduImport
          actionLabel="Edasi"
          initial={eduInitial}
          onResult={(r) => {
            const preset = SCHOOLS.find((x) => x.name === r.schoolName);
            const w = defaultWindow(today, preset?.id ?? "custom");
            const { segments, subjects } = eduSegments(r.periods, r.className, r.groupNames, w.start, w.end);
            const real = segments.filter((sg) => !sg.assumed);
            const current = real.find((sg) => today >= sg.start && today <= sg.end) ?? real[real.length - 1] ?? null;
            setState({
              step: "school",
              draft: {
                ...draft,
                schoolId: preset?.id ?? "custom",
                schoolName: preset ? "" : r.schoolName,
                className: r.className,
                window: w,
                timetableFrom: w.start,
                subjectNames: (subjects.length ? subjects : r.subjects).map((x) => x.name),
                timetable: current?.timetable ?? r.timetable,
                segments: segments.length ? segments : undefined,
                currentSegId: current?.id,
                baseline: {},
              },
            });
            window.scrollTo({ top: 0 });
          }}
        />
      </div>
    );

  const idx = SETUP_STEPS.indexOf(step);
  const back = () => setStep(idx > 0 ? SETUP_STEPS[idx - 1] : "start");
  const subjects = draft.subjectNames.map((n) => ({ id: subjectId(n), name: n }));
  const used = new Set(Object.values(draft.timetable).flat().map((l) => l.subjectId));
  const usedSubjects = subjects.filter((s) => used.has(s.id));
  const lateStart = draft.timetableFrom > draft.window.start;

  const next: { label: string; disabled?: boolean; onClick: () => void } =
    step === "school"
      ? { label: "Edasi", disabled: draft.schoolId === "custom" && !draft.schoolName.trim(), onClick: () => setStep("subjects") }
      : step === "subjects"
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
    <div className="flex flex-col gap-7 pb-28">
      <NavBar title={STEP_TITLE[step]!} onBack={back} trailing={<span className="num text-[13px] text-muted pr-1">{idx + 1}/4</span>} />

      {step === "school" && <SchoolStep draft={draft} today={today} patch={patch} />}

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
            <Section title="Perioodid EduPage'ist" footer="Ülal muudad praegust perioodi. Teiste perioodide tunnid tulevad kooli tunniplaanist. Ühekordseid üritusi (nt ekskursioon) tunniplaan ei tea, need lisa vabade päevade alla.">
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
              <label className="cell flex items-center justify-between gap-3 px-5 min-h-[52px]">
                <span>Kehtib alates</span>
                <input
                  type="date"
                  className="num bg-surface-2 rounded-full px-3 py-1.5 border-0 text-[17px]"
                  min={draft.window.start}
                  max={draft.window.end}
                  value={draft.timetableFrom}
                  onChange={(e) => isValidISO(e.target.value) && patch({ timetableFrom: e.target.value })}
                />
              </label>
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
            text={today >= draft.window.start ? "Mitu tundi igas aines oled sel perioodil juba puudunud. Kui ei tea, jäta 0 ja lisa hiljem." : "Periood pole veel alanud, jäta kõik 0."}
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

      <div className="fixed inset-x-0 bottom-0 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-6 bg-gradient-to-t from-bg via-bg to-bg/0">
        <div className="max-w-[640px] mx-auto">
          <Button size="lg" className="w-full" disabled={next.disabled} onClick={next.onClick}>
            {next.label}
          </Button>
        </div>
      </div>
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
}: {
  title: string;
  body?: string;
  features?: { icon: IconName; title: string; text: string }[];
  primary: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
}) {
  return (
    <div className="min-h-dvh flex flex-col pt-[calc(env(safe-area-inset-top)+56px)] pb-[calc(env(safe-area-inset-bottom)+16px)] fade-in">
      <div className="px-2 flex-1">
        <div className="size-16 rounded-[18px] bg-accent text-accent-ink grid place-items-center mb-6 shadow-[0_8px_24px_-8px_var(--accent)]">
          <Icon name="check" size={34} stroke={2.6} />
        </div>
        <h1 className="m-0 text-[34px] leading-[40px] font-bold">{title}</h1>
        {body && <p className="mt-3 mb-0 text-[17px] text-muted">{body}</p>}
        {features && (
          <ul className="list-none p-0 mt-9 mb-0 flex flex-col gap-6">
            {features.map((f) => (
              <li key={f.title} className="flex gap-4 items-start">
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
      <div className="flex flex-col gap-1 mt-10">
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

/** The rule, shown with a real example rather than explained in prose. */
function RuleIntro({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const ram = SCHOOLS.find((s) => s.id === "ram")!.rule;
  const total = 34;
  const max = maxAllowed(total, ram);
  return (
    <div className="min-h-dvh flex flex-col pb-[calc(env(safe-area-inset-bottom)+16px)] fade-in">
      <NavBar title="" onBack={onBack} />
      <div className="px-2 flex-1">
        <h1 className="m-0 text-[34px] leading-[40px] font-bold">Kuidas see arvutab</h1>
        <p className="mt-3 mb-0 text-[17px] text-muted">
          RAMis on piir {fmtLimit(ram.limit)}: kui puudud aines {fmtLimit(ram.limit)} või rohkem tundidest, on hinne automaatselt MH.
        </p>

        <div className="mt-7 bg-surface rounded-[26px] p-5">
          <div className="flex items-baseline justify-between">
            <span className="font-semibold">Füüsika</span>
            <span className="text-[15px] text-muted num">{total} tundi poolaastas</span>
          </div>
          <div className="grid grid-cols-[repeat(17,1fr)] gap-[3px] mt-4" role="img" aria-label={`${total} tundi: ${max} võid puududa, ${max + 1}. tähendab MH`}>
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={`aspect-[3/4] rounded-[3px] ${i < max ? "bg-ok-fill" : i === max ? "bg-bad-fill" : "bg-surface-2"}`} />
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-1.5 text-[15px]">
            <span className="flex items-center gap-2">
              <i className="size-3 rounded-[3px] bg-ok-fill" /> {max} tundi võid puududa ({fmtLimit(ram.limit)} {total}-st on {(total / 4).toString().replace(".", ",")})
            </span>
            <span className="flex items-center gap-2">
              <i className="size-3 rounded-[3px] bg-bad-fill" /> {max + 1}. puudumine = MH
            </span>
          </div>
        </div>

        <ul className="list-none p-0 mt-7 mb-0 flex flex-col gap-4 text-[15px]">
          <Fact>
            <b>Varu</b> on see, mitu tundi sul igas aines veel alles on.
          </Fact>
          <Fact>Paaristund võtab varu 2 tundi.</Fact>
          <Fact>Vaheajad ja iseõpe on arvestatud, need ei loe puudumisena.</Fact>
        </ul>
      </div>
      <Button size="lg" className="w-full mt-10" onClick={onNext}>
        Selge
      </Button>
    </div>
  );
}

function Fact({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3 items-start">
      <span className="text-accent mt-0.5 shrink-0">
        <Icon name="check" size={18} stroke={2.6} />
      </span>
      <span>{children}</span>
    </li>
  );
}

function Start({
  onRam,
  onRam9b,
  onCode,
  onCustom,
  onEdupage,
  onIntro,
}: {
  onRam: () => void;
  onRam9b: () => void;
  onCode: (s: Setup) => void;
  onCustom: () => void;
  onEdupage: () => void;
  onIntro: () => void;
}) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  return (
    <div className="flex flex-col gap-7 pt-[calc(env(safe-area-inset-top)+40px)] fade-in">
      <div className="px-2">
        <h1 className="m-0 text-[34px] leading-[40px] font-bold">Alustame</h1>
        <p className="mt-2 mb-0 text-[17px] text-muted">Vali, kuidas oma tunniplaani saad.</p>
      </div>

      <Section title="Klassikaaslane juba seadistas?" footer={err ? <span className="text-bad">{err}</span> : "Ava tema jagatud link või kleebi kood. Sinu puudumised jäävad sinu teada."}>
        <div className="cell flex items-center gap-3 px-5 min-h-[52px]">
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
            className="min-h-8 px-3"
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

      <Section title="Rocca al Mare Kool">
        <Row onClick={onRam} chevron>
          <div>RAM, iga klass</div>
          <div className="text-[13px] text-muted">Tunniplaan otse kooli EduPage'ist. Vali klass ja rühmad.</div>
        </Row>
      </Section>

      <Section title="Muu kool">
        <Row onClick={onEdupage} chevron>
          <div>Impordi EduPage'ist</div>
          <div className="text-[13px] text-muted">Kui kool avaldab tunniplaani edupage.org-is. Umbes 30 sekundit.</div>
        </Row>
        <Row onClick={onCustom} chevron>
          <div>Seadista käsitsi</div>
          <div className="text-[13px] text-muted">Kool, ained ja tunniplaan. Umbes kaks minutit.</div>
        </Row>

      </Section>

      <div className="flex flex-wrap gap-x-2">
        <Button variant="quiet" onClick={onIntro}>
          Kuidas see töötab?
        </Button>
        <Button variant="quiet" className="text-muted" onClick={onRam9b}>
          RAM 9.b näidis
        </Button>
      </div>
    </div>
  );
}

function SchoolStep({ draft, today, patch }: { draft: SetupDraft; today: string; patch: (p: Partial<SetupDraft>) => void }) {
  const school = SCHOOLS.find((s) => s.id === draft.schoolId);
  return (
    <>
      <Section
        footer={
          school
            ? `Piir: ${limitPhrase(school.rule)}.${school.verified ? "" : " Kontrolli oma kooli hindamisjuhendist."}`
            : `Alguses on piir ${fmtLimit(SCHOOLS[0].rule.limit)}. Muuda seda hiljem seadetes oma kooli reegli järgi.`
        }
      >
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
        <label className="cell flex items-center justify-between gap-3 px-5 min-h-[52px]">
          <span>Klass</span>
          <input id="ob-class" className="bg-transparent border-0 text-right text-[17px] w-1/2 placeholder:text-faint" placeholder="nt 9.b" value={draft.className} onChange={(e) => patch({ className: e.target.value })} />
        </label>
      </Section>
      <Section title="Arvestusperiood" footer="Täidetud selle õppeaasta järgi. Muuda, kui sinu koolil on teised kuupäevad.">
        <label className="cell flex items-center justify-between gap-3 px-5 min-h-[52px]">
          <span>Nimi</span>
          <input className="bg-transparent border-0 text-right text-muted text-[17px] w-1/2" aria-label="Perioodi nimi" value={draft.window.name} onChange={(e) => patch({ window: { ...draft.window, name: e.target.value } })} />
        </label>
        <label className="cell flex items-center justify-between gap-3 px-5 min-h-[52px]">
          <span>Algus</span>
          <input
            type="date"
            className="num bg-surface-2 rounded-full px-3 py-1.5 border-0 text-[17px]"
            value={draft.window.start}
            onChange={(e) => isValidISO(e.target.value) && patch({ window: { ...draft.window, start: e.target.value }, timetableFrom: e.target.value })}
          />
        </label>
        <label className="cell flex items-center justify-between gap-3 px-5 min-h-[52px]">
          <span>Viimane päev</span>
          <input
            type="date"
            className="num bg-surface-2 rounded-full px-3 py-1.5 border-0 text-[17px]"
            value={draft.window.end}
            onChange={(e) => isValidISO(e.target.value) && patch({ window: { ...draft.window, end: e.target.value } })}
          />
        </label>
      </Section>
    </>
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
      className="cell flex items-center gap-3 px-5 min-h-[52px]"
      onSubmit={(e) => {
        e.preventDefault();
        const n = v.trim();
        if (n) onAdd(n.charAt(0).toUpperCase() + n.slice(1));
        setV("");
      }}
    >
      <input className="cell-input flex-1 placeholder:text-faint" enterKeyHint="done" autoCapitalize="sentences" placeholder="Muu aine" aria-label="Muu aine nimi" value={v} onChange={(e) => setV(e.target.value)} />
      <Button type="submit" variant="ghost" className="min-h-8 px-3" disabled={!v.trim()}>
        Lisa
      </Button>
    </form>
  );
}
