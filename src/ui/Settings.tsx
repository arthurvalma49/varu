import { useRef, useState } from "react";
import { segmentFor, totals, withCancelled } from "../core/calc";
import { today } from "../core/dates";
import { isValidISO } from "../core/dates";
import { SCHOOLS } from "../core/schools";
import { breakDays } from "../core/setup";
import { decodeSetup, encodeSetup, validateData } from "../core/share";
import { demoData } from "../core/demo";
import { emptyTimetable, slug } from "../core/templates";
import type { AppData, Setup } from "../core/types";
import type { Store } from "../store";
import { haptic } from "./haptics";
import { ActionSheet, Button, Check, DateField, Icon, LargeTitle, Sheet, NavBar, Row, Section, Segmented, SettingsIcon, Switch, dateRuns, fmtDate, fmtLimit, limitPhrase } from "./kit";
import { eduSegments } from "../core/edupage";
import { EduImport } from "./EduImport";
import { WeekEditor } from "./WeekEditor";

type Page = "root" | "rule" | "window" | "subjects" | "timetable" | "edupage" | "holidays" | "share" | "backup" | "devtest";
const TITLES: Record<Exclude<Page, "root">, string> = {
  rule: "Kool ja reegel",
  window: "Periood ja klass",
  subjects: "Ained",
  timetable: "Tunniplaan",
  edupage: "Impordi EduPage'ist",
  holidays: "Vabad päevad",
  share: "Jaga klassiga",
  backup: "Varukoopia",
  devtest: "Seadme test",
};

const LIMITS = [
  { label: "18%", num: 18, den: 100 },
  { label: "25%", num: 1, den: 4 },
  { label: "1/3", num: 1, den: 3 },
  { label: "40%", num: 2, den: 5 },
  { label: "50%", num: 1, den: 2 },
];

export function Settings({ store }: { store: Store }) {
  const { data, updateSetup, replaceAll } = store;
  const setup = data.setup!;
  const [page, setPage] = useState<Page>("root");
  const [dir, setDir] = useState<"push" | "pop">("push");
  const [msg, setMsg] = useState("");
  const open = (p: Page) => {
    setDir(p === "root" ? "pop" : "push");
    setPage(p);
    setMsg("");
    window.scrollTo({ top: 0 });
  };

  if (page === "root")
    return (
      <div className={`flex flex-col gap-7 ${dir === "pop" ? "pop-in" : ""}`}>
        <div className="-mx-4 -mb-3">
          <LargeTitle title="Seaded" subtitle={`${setup.schoolName}${setup.className ? ` · ${setup.className}` : ""}`} />
        </div>
        <Section className="[--sep-inset:62px]" title="Kool">
          <Row onClick={() => open("rule")} chevron detail={<span className="num">{fmtLimit(setup.rule.limit)}</span>}>
            <IconLabel icon="building">Kool ja reegel</IconLabel>
          </Row>
          <Row onClick={() => open("window")} chevron detail={<span className="truncate max-w-[40vw] inline-block align-bottom">{setup.windowName}</span>}>
            <IconLabel icon="calendar">Periood</IconLabel>
          </Row>
        </Section>
        <Section className="[--sep-inset:62px]" title="Tunniplaan" info="Import loeb kooli tunniplaani edupage.org-ist (nt RAM: ramkool). Pärast saad seda muuta.">
          <Row onClick={() => open("edupage")} chevron>
            <IconLabel icon="download">Impordi EduPage'ist</IconLabel>
          </Row>
          <Row onClick={() => open("subjects")} chevron detail={<span className="num">{setup.subjects.filter((s) => s.tracked).length}</span>}>
            <IconLabel icon="book">Ained</IconLabel>
          </Row>
          <Row onClick={() => open("timetable")} chevron detail={<span className="num">{setup.segments.length}</span>}>
            <IconLabel icon="grid">Tunniplaan</IconLabel>
          </Row>
          <Row onClick={() => open("holidays")} chevron detail={<span className="num">{setup.holidays.length + Object.keys(setup.cancelled ?? {}).length}</span>}>
            <IconLabel icon="calendarX">Vabad päevad</IconLabel>
          </Row>
        </Section>
        <Section className="[--sep-inset:62px]" title="Andmed" info="Kõik on ainult selles seadmes. Klassikaaslastega jagad ainult tunniplaani ja reeglit, mitte puudumisi.">
          <Row onClick={() => open("share")} chevron>
            <IconLabel icon="share">Jaga klassiga</IconLabel>
          </Row>
          <Row onClick={() => open("backup")} chevron>
            <IconLabel icon="archive">Varukoopia</IconLabel>
          </Row>
        </Section>
        <Section className="[--sep-inset:62px]" title="Testimine" info="Näidisandmed (RAM 9.b, iga olek korraga), et äppi proovida ilma ise andmeid sisestamata. Sinu päris andmed pannakse kõrvale ja tulevad tagasi, kui testrežiimi välja lülitad.">
          <div className="cell flex items-center justify-between gap-3 px-5 min-h-[52px]">
            <IconLabel icon="flask">Testrežiim</IconLabel>
            <Switch label="Testrežiim" checked={!!data.demo} onChange={(on) => (on ? enterDemo(data, replaceAll) : leaveDemo(data, replaceAll))} />
          </div>
          <Row onClick={() => open("devtest")} chevron>
            <IconLabel icon="gauge">Haptika ja ekraani test</IconLabel>
          </Row>
        </Section>
        {!data.demo && <ResetAll onReset={() => replaceAll({ setup: null, absences: [] })} />}
      </div>
    );

  return (
    <div key={page} className="flex flex-col gap-7 -mt-3 push-in">
      <NavBar title={TITLES[page]} onBack={() => open("root")} backLabel="Seaded" />
      {page === "rule" && <RulePage setup={setup} updateSetup={updateSetup} />}
      {page === "window" && <WindowPage setup={setup} updateSetup={updateSetup} />}
      {page === "subjects" && <SubjectsPage setup={setup} updateSetup={updateSetup} />}
      {page === "timetable" && <TimetablePage setup={setup} updateSetup={updateSetup} onEdupage={() => open("edupage")} />}
      {page === "edupage" && (
        <EduImport
          actionLabel="Asenda tunniplaanid"
          initial={setup.schoolId === "ram" ? "ramkool" : ""}
          onResult={(r) => {
            updateSetup((d) => {
              const { segments, subjects } = eduSegments(r.periods, r.className, r.groupNames, d.windowStart, d.windowEnd);
              if (r.periodTimes) d.periodTimes = r.periodTimes;
              for (const sub of subjects.length ? subjects : r.subjects) if (!d.subjects.some((x) => x.id === sub.id)) d.subjects.push({ id: sub.id, name: sub.name, tracked: true });
              if (segments.length) {
                d.segments = segments;
                d.baseline = {};
              } else {
                const seg = segmentFor(d, today()) ?? d.segments[d.segments.length - 1];
                if (seg) {
                  seg.timetable = r.timetable;
                  seg.assumed = false;
                }
              }
            });
            open("timetable");
            setMsg("Tunniplaan imporditud. Vaata see üle.");
          }}
        />
      )}
      {page === "holidays" && <HolidaysPage setup={setup} updateSetup={updateSetup} />}
      {page === "share" && <SharePage data={data} replaceAll={replaceAll} setMsg={setMsg} />}
      {page === "backup" && <BackupPage data={data} replaceAll={replaceAll} setMsg={setMsg} />}
      {page === "devtest" && <DevTestPage />}
      {msg && (
        <div className="px-5 text-[15px] text-muted" role="status">
          {msg}
        </div>
      )}
    </div>
  );
}

type Upd = Store["updateSetup"];

const REAL_KEY = "varu:real";

/** Tester mode: park the real data, show demo data. */
export function enterDemo(data: AppData, replaceAll: Store["replaceAll"]) {
  if (data.demo) return;
  try {
    localStorage.setItem(REAL_KEY, JSON.stringify(data));
  } catch {
    return; // nowhere to park the real data: do not risk it
  }
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  replaceAll(demoData(today));
}

/** Leave tester mode: the parked real data comes back exactly as it was. */
export function leaveDemo(data: AppData, replaceAll: Store["replaceAll"]) {
  if (!data.demo) return;
  try {
    const raw = localStorage.getItem(REAL_KEY);
    const real = raw ? JSON.parse(raw) : null;
    if (real && validateData(real)) {
      replaceAll({ ...real, demo: undefined });
      localStorage.removeItem(REAL_KEY);
      return;
    }
  } catch {
    /* fall through */
  }
  replaceAll({ setup: null, absences: [] });
}

function RulePage({ setup, updateSetup }: { setup: Setup; updateSetup: Upd }) {
  const school = SCHOOLS.find((s) => s.id === setup.schoolId);
  const presetLimit = LIMITS.find((l) => l.num * setup.rule.limit.den === setup.rule.limit.num * l.den);
  return (
    <>
      <Section
        footer={
          school ? (
            <>
              {school.scope}.{" "}
              {school.source ? (
                <a className="text-accent" href={school.source} target="_blank" rel="noreferrer">
                  Vaata allikat
                </a>
              ) : (
                "Allikas pole avalik, kontrolli oma kooli hindamisjuhendist."
              )}
            </>
          ) : undefined
        }
      >
        <label className="cell flex items-center justify-between gap-3 px-5 min-h-[52px]">
          <span>Kool</span>
          <select
            className="bg-transparent border-0 text-right text-muted text-[17px] max-w-[60%]"
            value={setup.schoolId}
            onChange={(e) => {
              const s = SCHOOLS.find((x) => x.id === e.target.value);
              updateSetup((d) => {
                d.schoolId = e.target.value;
                if (s) {
                  d.schoolName = s.name;
                  d.rule = structuredClone(s.rule);
                }
              });
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
        {setup.schoolId === "custom" && (
          <label className="cell flex items-center px-5">
            <input className="cell-input" aria-label="Kooli nimi" placeholder="Kooli nimi" value={setup.schoolName} onChange={(e) => updateSetup((d) => void (d.schoolName = e.target.value))} />
          </label>
        )}
      </Section>

      <Section title="Piir" footer={limitPhrase(setup.rule)}>
        <div className="p-3 flex flex-col gap-3">
          <Segmented<string>
            label="Puudumise piir"
            value={presetLimit?.label ?? "muu"}
            onChange={(v) => {
              const l = LIMITS.find((x) => x.label === v);
              if (l) updateSetup((d) => void (d.rule.limit = { num: l.num, den: l.den }));
            }}
            options={LIMITS.map((l) => ({ value: l.label, label: l.label }))}
          />
        </div>
        <label className="cell flex items-center justify-between gap-3 px-5 min-h-[52px]">
          <span>Oma piir</span>
          <span className="flex items-center gap-1 text-muted">
            <input
              type="number"
              min={1}
              max={99}
              inputMode="numeric"
              aria-label="Oma piir protsentides"
              placeholder={presetLimit ? "" : String(Math.round((setup.rule.limit.num / setup.rule.limit.den) * 100))}
              className="num bg-transparent border-0 text-right w-16 text-[17px]"
              onChange={(e) => {
                const v = Math.round(Number(e.target.value));
                if (v >= 1 && v <= 99) updateSetup((d) => void (d.rule.limit = { num: v, den: 100 }));
              }}
            />
            %
          </span>
        </label>
      </Section>

      <Section title="Kui jõuad täpselt piirini">
        {(
          [
            ["gte", "Juba piiril läbi", "nt „25% või rohkem”"],
            ["gt", "Alles üle piiri läbi", "nt „rohkem kui 1/3”"],
          ] as const
        ).map(([m, t, s]) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={setup.rule.mode === m}
            onClick={() => updateSetup((d) => void (d.rule.mode = m))}
            className="cell press flex items-center gap-3 px-5 min-h-[56px] w-full text-left cursor-pointer"
          >
            <div className="flex-1 py-2">
              <div>{t}</div>
              <div className="text-[13px] text-muted">{s}</div>
            </div>
            <Check on={setup.rule.mode === m} />
          </button>
        ))}
      </Section>

      <Section title="Tagajärg" info="Mis juhtub, kui jõuad piirini. Näidatakse esilehel, kui aine on üle piiri.">
        <div className="cell flex items-center justify-between gap-3 px-5 min-h-[52px]">
          <span>Automaatne (mitte õpetaja otsus)</span>
          <Switch label="Tagajärg on automaatne" checked={setup.rule.automatic} onChange={(v) => updateSetup((d) => void (d.rule.automatic = v))} />
        </div>
        <label className="cell flex px-5 py-3">
          <textarea
            rows={2}
            className="w-full bg-transparent border-0 outline-none resize-none leading-snug"
            aria-label="Mis juhtub piiri ületamisel"
            value={setup.rule.consequence}
            onChange={(e) => updateSetup((d) => void (d.rule.consequence = e.target.value))}
          />
        </label>
      </Section>
    </>
  );
}

function DateRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <DateField label={label} value={value} onChange={(v) => isValidISO(v) && onChange(v)} />
  );
}

function WindowPage({ setup, updateSetup }: { setup: Setup; updateSetup: Upd }) {
  return (
    <>
      <Section title="Arvestusperiood" info="Periood, mille kohta kooli piir kehtib, nt poolaasta. Viimane päev on viimane arvesse minev koolipäev.">
        <label className="cell flex items-center justify-between gap-3 px-5 min-h-[52px]">
          <span>Nimi</span>
          <input className="bg-transparent border-0 text-right text-muted text-[17px] w-1/2" value={setup.windowName} onChange={(e) => updateSetup((d) => void (d.windowName = e.target.value))} aria-label="Perioodi nimi" />
        </label>
        <DateRow label="Algus" value={setup.windowStart} onChange={(v) => updateSetup((d) => void (d.windowStart = v))} />
        <DateRow label="Viimane päev" value={setup.windowEnd} onChange={(v) => updateSetup((d) => void (d.windowEnd = v))} />
      </Section>
      <Section>
        <label className="cell flex items-center justify-between gap-3 px-5 min-h-[52px]">
          <span>Klass</span>
          <input className="bg-transparent border-0 text-right text-muted text-[17px] w-1/2" placeholder="nt 9.b" value={setup.className} onChange={(e) => updateSetup((d) => void (d.className = e.target.value))} aria-label="Klass" />
        </label>
      </Section>
    </>
  );
}

function SubjectsPage({ setup, updateSetup }: { setup: Setup; updateSetup: Upd }) {
  const T = totals(setup);
  const [v, setV] = useState("");
  const usesBaseline = Object.values(setup.baseline).some((n) => n > 0) || setup.segments.some((s) => s.start > setup.windowStart);
  return (
    <>
      <Section title="Ained" info="Lüliti: kas aine läheb piiri arvestusse. Number paremal on perioodi tunnid kokku.">
        {setup.subjects.map((s, i) => (
          <div key={s.id} className="cell flex items-center gap-3 px-5 min-h-[52px]">
            <input aria-label="Aine nimi" className="cell-input flex-1 min-w-0" value={s.name} onChange={(e) => updateSetup((d) => void (d.subjects[i].name = e.target.value))} />
            <span className="num text-muted text-[15px]">{T[s.id] ?? 0}</span>
            <Switch label={`${s.name}: arvesta`} checked={s.tracked} onChange={(x) => updateSetup((d) => void (d.subjects[i].tracked = x))} />
          </div>
        ))}
        <form
          className="cell flex items-center gap-3 px-5 min-h-[52px]"
          onSubmit={(e) => {
            e.preventDefault();
            const name = v.trim();
            if (name)
              updateSetup((d) => {
                let id = slug(name) || "aine";
                while (d.subjects.some((x) => x.id === id)) id += "-2";
                d.subjects.push({ id, name, tracked: true });
              });
            setV("");
          }}
        >
          <input className="cell-input flex-1 placeholder:text-faint" enterKeyHint="done" autoCapitalize="sentences" placeholder="Uus aine" aria-label="Uue aine nimi" value={v} onChange={(e) => setV(e.target.value)} />
          <Button type="submit" variant="ghost" className="min-h-8 px-3" disabled={!v.trim()}>
            Lisa
          </Button>
        </form>
      </Section>

      <Section title="Vähem tähtis" info="Nt hinne alles aasta lõpus või hinnet ei saa. Loeb edasi, aga ei tõuse esilehel esile.">
        {setup.subjects
          .filter((s) => s.tracked)
          .map((s) => {
            const i = setup.subjects.indexOf(s);
            return (
              <button
                key={s.id}
                type="button"
                role="checkbox"
                aria-checked={!!s.advisory}
                onClick={() => updateSetup((d) => void (d.subjects[i].advisory = !s.advisory || undefined))}
                className="cell press flex items-center gap-3 px-5 min-h-[52px] w-full text-left cursor-pointer"
              >
                <span className="flex-1">{s.name}</span>
                <Check on={!!s.advisory} />
              </button>
            );
          })}
      </Section>

      {usesBaseline && (
        <Section title="Tunnid enne tunniplaani" footer={setup.baselineLabel ?? "Tunnid, mis toimusid enne esimest tunniplaani. Loe need e-koolist."}>
          {setup.subjects.map((s) => (
            <label key={s.id} className="cell flex items-center justify-between gap-3 px-5 min-h-[52px]">
              <span>{s.name}</span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                aria-label={`${s.name}: tunnid varem`}
                className="num bg-transparent border-0 text-right w-16 text-muted text-[17px]"
                value={setup.baseline[s.id] ?? 0}
                onChange={(e) => updateSetup((d) => void (d.baseline[s.id] = Math.max(0, Math.round(Number(e.target.value) || 0))))}
              />
            </label>
          ))}
        </Section>
      )}
    </>
  );
}

function TimetablePage({ setup, updateSetup, onEdupage }: { setup: Setup; updateSetup: Upd; onEdupage: () => void }) {
  return (
    <>
      <Section footer="Kui kool avaldab tunniplaani edupage.org-is, loeb sealt kõik selle perioodi tunniplaanid ja asendab praegused.">
        <Row onClick={onEdupage} chevron>
          <span className="text-accent">Impordi EduPage'ist</span>
        </Row>
      </Section>
      {setup.segments.map((seg, si) => {
        const others = setup.segments.filter((_, i) => i !== si);
        const upd = (fn: (s: Setup["segments"][number]) => void) => updateSetup((d) => fn(d.segments[si]));
        return (
          <div key={seg.id} className="flex flex-col gap-3">
            <Section title={seg.name}>
              <label className="cell flex items-center px-5">
                <input aria-label="Perioodi nimi" className="cell-input" value={seg.name} onChange={(e) => upd((s) => void (s.name = e.target.value))} />
              </label>
              <DateRow label="Algus" value={seg.start} onChange={(v) => upd((s) => void (s.start = v))} />
              <DateRow label="Lõpp" value={seg.end} onChange={(v) => upd((s) => void (s.end = v))} />
              <div className="cell flex items-center justify-between gap-3 px-5 min-h-[52px]">
                <span>Tunniplaan eeldatud</span>
                <Switch label="Tunniplaan eeldatud" checked={!!seg.assumed} onChange={(v) => upd((s) => void (s.assumed = v))} />
              </div>
              {others.length > 0 && (
                <label className="cell flex items-center justify-between gap-3 px-5 min-h-[52px]">
                  <span className="text-accent">Kopeeri tunniplaan</span>
                  <select
                    aria-label="Kopeeri tunniplaan"
                    className="bg-transparent border-0 text-right text-muted text-[17px]"
                    value=""
                    onChange={(e) => {
                      const src = setup.segments.find((s) => s.id === e.target.value);
                      if (src) upd((s) => void (s.timetable = structuredClone(src.timetable)));
                    }}
                  >
                    <option value="">Vali</option>
                    {others.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </Section>
            <div className="bg-surface rounded-[26px] p-4">
              <WeekEditor subjects={setup.subjects} timetable={seg.timetable} onChange={(t) => upd((s) => void (s.timetable = t))} />
            </div>
            {setup.segments.length > 1 && (
              <Button variant="quiet" className="text-bad self-start" onClick={() => updateSetup((d) => void d.segments.splice(si, 1))}>
                Eemalda {seg.name}
              </Button>
            )}
          </div>
        );
      })}
      <Section footer="Iga periood saab oma tunniplaani. Kui uut veel pole, kopeeri eelmine ja märgi eeldatuks.">
        <Row
          onClick={() =>
            updateSetup((d) => {
              const last = d.segments[d.segments.length - 1];
              d.segments.push({
                id: Math.random().toString(36).slice(2, 8),
                name: `${d.segments.length + 1}. tunniplaan`,
                start: last?.end ?? d.windowStart,
                end: d.windowEnd,
                timetable: last ? structuredClone(last.timetable) : emptyTimetable(),
                assumed: !!last,
              });
            })
          }
        >
          <span className="text-accent">Lisa periood</span>
        </Row>
      </Section>
    </>
  );
}

function HolidaysPage({ setup, updateSetup }: { setup: Setup; updateSetup: Upd }) {
  const [v, setV] = useState("");
  const missing = breakDays(setup.windowStart, setup.windowEnd).filter((d) => !setup.holidays.includes(d));
  const runs = dateRuns(setup.holidays);
  return (
    <>
      {missing.length > 0 && (
        <Section footer="Riiklikud koolivaheajad ja pühad. Erakoolidel võivad olla teised, kontrolli oma kooli kalendrit.">
          <Row onClick={() => updateSetup((s) => void (s.holidays = [...new Set([...s.holidays, ...missing])].sort()))}>
            <span className="text-accent">Lisa riiklikud vaheajad ({missing.length} päeva)</span>
          </Row>
        </Section>
      )}
      <Section title="Päevad ilma tundideta" info="Need vähendavad tundide koguarvu, seega ka lubatud puudumisi.">
        {runs.length === 0 && (
          <Row>
            <span className="text-muted">Vabu päevi pole lisatud</span>
          </Row>
        )}
        {runs.map((r) => (
          <Row
            key={r.start}
            detail={
              <button
                type="button"
                aria-label={`Eemalda ${fmtDate(r.start)}${r.start === r.end ? "" : ` kuni ${fmtDate(r.end)}`}`}
                className="size-9 -mr-2 grid place-items-center rounded-full text-muted cursor-pointer active:bg-surface-2"
                onClick={() => updateSetup((s) => void (s.holidays = s.holidays.filter((x) => !r.days.includes(x))))}
              >
                <Icon name="x" size={18} />
              </button>
            }
          >
            <span className="num">{r.start === r.end ? fmtDate(r.start, true) : `${fmtDate(r.start)} – ${fmtDate(r.end, true)}`}</span>
            <span className="text-muted text-[15px] num"> · {r.days.length} p</span>
          </Row>
        ))}
        <DateField
          label="Lisa päev"
          value={v}
          onChange={(d) => {
            if (!isValidISO(d)) return;
            updateSetup((s) => void (!s.holidays.includes(d) && (s.holidays.push(d), s.holidays.sort())));
            setV("");
          }}
        />
      </Section>
      {Object.keys(setup.cancelled ?? {}).length > 0 && (
        <Section title="Ärajäänud tunnid" info="Need tunnid ei toimunud või ei toimu. Need vähendavad aine tundide koguarvu, aga ei ole puudumised.">
          {Object.entries(setup.cancelled!)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, subs]) => (
              <Row
                key={date}
                detail={
                  <button
                    type="button"
                    aria-label={`Taasta ${fmtDate(date)}`}
                    className="size-9 -mr-2 grid place-items-center rounded-full text-muted cursor-pointer active:bg-surface-2"
                    onClick={() => updateSetup((s) => void (s.cancelled = withCancelled(s.cancelled, date, Object.fromEntries(Object.entries(subs).map(([id, n]) => [id, -n])))))}
                  >
                    <Icon name="x" size={18} />
                  </button>
                }
              >
                <span className="num">{fmtDate(date, true)}</span>
                <div className="text-[13px] text-muted truncate">
                  {Object.entries(subs)
                    .map(([id, n]) => `${setup.subjects.find((x) => x.id === id)?.name ?? id}${n > 1 ? ` ×${n}` : ""}`)
                    .join(", ")}
                </div>
              </Row>
            ))}
        </Section>
      )}
    </>
  );
}

function SharePage({ data, replaceAll, setMsg }: { data: AppData; replaceAll: Store["replaceAll"]; setMsg: (m: string) => void }) {
  const setup = data.setup!;
  const [code, setCode] = useState("");
  const url = `${location.origin}${location.pathname}#setup=${encodeSetup(setup)}`;
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMsg(`${what} kopeeritud.`);
    } catch {
      setCode(text);
      setMsg("Kopeerimine ei õnnestunud, vali tekst käsitsi.");
    }
  };
  return (
    <>
      <Section footer="Klassikaaslane avab lingi ja saab sama tunniplaani ja reegli. Tema puudumised jäävad tema seadmesse.">
        <Row
          onClick={async () => {
            try {
              if (navigator.share) await navigator.share({ title: "Tunniplaan", text: `${setup.schoolName} ${setup.className}`, url });
              else await copy(url, "Link");
            } catch {
              /* share sheet closed */
            }
          }}
          detail={
            <span className="text-accent">
              <Icon name="share" size={20} />
            </span>
          }
        >
          <span className="text-accent">Jaga linki</span>
        </Row>
        <Row onClick={() => copy(encodeSetup(setup), "Kood")}>
          <span className="text-accent">Kopeeri kood</span>
        </Row>
      </Section>
      <Section title="Said koodi?" footer="Asendab sinu tunniplaani ja reegli. Sinu puudumised jäävad alles.">
        <div className="cell flex items-center gap-3 px-5 min-h-[52px]">
          <input className="cell-input font-mono text-[16px] flex-1 placeholder:text-faint placeholder:font-sans placeholder:text-[17px]" enterKeyHint="go" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="Kood või link" aria-label="Jagamiskood" value={code} onChange={(e) => setCode(e.target.value)} />
          <Button
            variant="ghost"
            className="min-h-8 px-3"
            disabled={!code.trim()}
            onClick={() => {
              const s = decodeSetup(code.trim().replace(/^.*#setup=/, ""));
              if (!s) return setMsg("See kood ei tööta.");
              replaceAll({ ...data, setup: { ...s, cancelled: s.cancelled ?? data.setup?.cancelled } });
              setCode("");
              setMsg("Seadistus laaditud. Sinu puudumised jäid alles.");
            }}
          >
            Lae
          </Button>
        </div>
      </Section>
    </>
  );
}

function BackupPage({ data, replaceAll, setMsg }: { data: AppData; replaceAll: Store["replaceAll"]; setMsg: (m: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `puudumised-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importJson = async (f: File) => {
    try {
      const d = JSON.parse(await f.text()) as AppData;
      if (!validateData(d)) throw new Error();
      replaceAll(d);
      setMsg("Varukoopia taastatud.");
    } catch {
      setMsg("See fail ei ole selle äpi varukoopia.");
    }
  };
  return (
    <Section footer="Kõik andmed on ainult selles brauseris. Tee aeg-ajalt varukoopia, eriti enne telefoni vahetust.">
      <Row onClick={exportJson}>
        <span className="text-accent">Laadi alla (.json)</span>
      </Row>
      <Row onClick={() => fileRef.current?.click()}>
        <span className="text-accent">Taasta failist</span>
      </Row>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
    </Section>
  );
}

function ResetAll({ onReset }: { onReset: () => void }) {
  const [ask, setAsk] = useState(false);
  return (
    <>
      <Section>
        <Row onClick={() => setAsk(true)}>
          <span className="text-bad">Alusta otsast</span>
        </Row>
      </Section>
      <ActionSheet
        open={ask}
        onClose={() => setAsk(false)}
        title="Kustutan tunniplaani ja kõik puudumised selles seadmes."
        message="Seda ei saa tagasi võtta."
        actions={[{ label: "Kustuta kõik", destructive: true, onClick: onReset }]}
      />
    </>
  );
}

/** Settings row label with its icon; one colour for all icons keeps the list calm. */
function IconLabel({ icon, children }: { icon: Parameters<typeof SettingsIcon>[0]["name"]; children: string }) {
  return (
    <span className="flex items-center gap-3">
      <SettingsIcon name={icon} color="var(--accent)" />
      {children}
    </span>
  );
}

/** Temporary on-device checks: which haptic route works, which sheet variant avoids the flash. */
function DevTestPage() {
  const [variant, setVariant] = useState<null | "A" | "B" | "C" | "D">(null);
  const [sw, setSw] = useState(false);
  const [n, setN] = useState(0);
  const standalone = typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone);
  const ios = navigator.userAgent.match(/OS (\d+)_(\d+)/);
  const variants = {
    A: { label: "A: nagu praegu", lockScroll: true, backdrop: "full" as const },
    B: { label: "B: leht võib kerida", lockScroll: false, backdrop: "full" as const },
    C: { label: "C: tume kiht algab kella alt", lockScroll: true, backdrop: "below" as const },
    D: { label: "D: tumedat kihti pole", lockScroll: true, backdrop: "none" as const },
  };
  const v = variant ? variants[variant] : null;
  return (
    <>
      <Section title="Seade">
        <Row detail={<span className="num">{ios ? `iOS ${ios[1]}.${ios[2]}` : "pole iOS"}</span>}>Süsteem</Row>
        <Row detail={standalone ? "avakuvalt" : "brauseris"}>Avatud</Row>
      </Section>
      <Section title="Haptika" footer="Puuduta igat ja ütle, millise puhul telefon värises.">
        <label className="cell flex items-center justify-between gap-3 px-5 min-h-[52px]">
          <span>1. Päris iOS lüliti</span>
          {/* @ts-expect-error: Safari's native switch attribute */}
          <input type="checkbox" switch="" className="scale-125" />
        </label>
        <div className="cell flex items-center justify-between gap-3 px-5 min-h-[52px]">
          <span>2. Äpi lüliti</span>
          <Switch label="Äpi lüliti" checked={sw} onChange={setSw} />
        </div>
        <Row
          onClick={() => {
            haptic();
            setN((x) => x + 1);
          }}
          detail={<span className="num">{n}</span>}
        >
          <span className="text-accent">3. Nupp (peidetud lüliti)</span>
        </Row>
        <label className="cell press flex items-center justify-between gap-3 px-5 min-h-[52px] cursor-pointer">
          <span className="text-accent">4. Nupp, mis on ise lüliti silt</span>
          {/* @ts-expect-error: Safari's native switch attribute */}
          <input type="checkbox" switch="" className="absolute opacity-0 pointer-events-none size-px" />
        </label>
      </Section>
      <Section title="Lehe avamine" footer="Ava igaüks ja vaata, kas ekraani ülaosa vilgub avamisel või sulgemisel.">
        {(Object.keys(variants) as (keyof typeof variants)[]).map((k) => (
          <Row key={k} onClick={() => setVariant(k)} chevron>
            {variants[k].label}
          </Row>
        ))}
      </Section>
      <Sheet open={!!variant} onClose={() => setVariant(null)} title={v?.label ?? ""} lockScroll={v?.lockScroll ?? true} backdrop={v?.backdrop ?? "full"}>
        <Section>
          <Row>Sulge Loobu nupuga või tõmba alla.</Row>
        </Section>
      </Sheet>
    </>
  );
}
