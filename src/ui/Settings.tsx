import { useRef, useState, type ReactNode } from "react";
import { totals } from "../core/calc";
import { isValidISO } from "../core/dates";
import { SCHOOLS } from "../core/schools";
import { decodeSetup, encodeSetup, validateData } from "../core/share";
import { emptyTimetable, slug } from "../core/templates";
import type { AppData, Setup } from "../core/types";
import type { Store } from "../store";
import { breakDays } from "../core/setup";
import { Button, Icon, Label, dateRuns, fmtDate, fmtLimit } from "./kit";
import { WeekEditor } from "./WeekEditor";

function Section({ title, sub, children, open = false }: { title: string; sub?: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group bg-surface border border-line rounded-2xl">
      <summary className="list-none cursor-pointer p-4 flex items-center justify-between gap-3 min-h-14 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <div className="font-display font-bold text-lg">{title}</div>
          {sub && <div className="text-sm text-muted truncate">{sub}</div>}
        </div>
        <span className="text-muted transition-transform duration-150 group-open:rotate-90" aria-hidden>
          <Icon name="right" />
        </span>
      </summary>
      <div className="px-4 pb-4 flex flex-col gap-3">{children}</div>
    </details>
  );
}

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
  const [msg, setMsg] = useState("");
  const [code, setCode] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const T = totals(setup);
  const school = SCHOOLS.find((s) => s.id === setup.schoolId);

  const shareUrl = () => `${location.origin}${location.pathname}#setup=${encodeSetup(setup)}`;
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMsg(`${what} kopeeritud.`);
    } catch {
      setCode(text);
      setMsg("Kopeerimine ei õnnestunud, vali tekst allpool käsitsi.");
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `varu-${new Date().toISOString().slice(0, 10)}.json`;
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
      setMsg("See fail ei ole Varu varukoopia.");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Section title="Kool ja reegel" sub={`${setup.schoolName} · ${fmtLimit(setup.rule.limit)} · ${setup.rule.automatic ? "automaatne" : "õpetaja otsus"}`} open>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="school">Kool</Label>
          <select
            id="school"
            className="field"
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
          {setup.schoolId === "custom" && (
            <input className="field" aria-label="Kooli nimi" value={setup.schoolName} onChange={(e) => updateSetup((d) => void (d.schoolName = e.target.value))} />
          )}
          {school && (
            <div className="text-[13px] text-muted">
              {school.scope}.{" "}
              {school.source ? (
                <a className="text-accent underline underline-offset-[0.2em]" href={school.source} target="_blank" rel="noreferrer">
                  Allikas
                </a>
              ) : (
                "Allikas pole avalik, kontrolli oma kooli hindamisjuhendist."
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Piir</span>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Puudumise piir">
            {LIMITS.map((l) => {
              const on = l.num * setup.rule.limit.den === setup.rule.limit.num * l.den;
              return (
                <button
                  key={l.label}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={`num min-h-11 px-4 rounded-xl border font-bold cursor-pointer ${on ? "bg-accent text-accent-ink border-accent" : "border-line hover:bg-surface-2"}`}
                  onClick={() => updateSetup((d) => void (d.rule.limit = { num: l.num, den: l.den }))}
                >
                  {l.label}
                </button>
              );
            })}
            <input
              type="number"
              min={1}
              max={99}
              aria-label="Oma piir protsentides"
              placeholder="muu %"
              className="field num w-28"
              onChange={(e) => {
                const v = Math.round(Number(e.target.value));
                if (v >= 1 && v <= 99) updateSetup((d) => void (d.rule.limit = { num: v, den: 100 }));
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Kui jõuad täpselt piirini</span>
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                ["gte", "Juba piiril läbi", "nt „25% või rohkem”"],
                ["gt", "Alles üle piiri läbi", "nt „rohkem kui 1/3”"],
              ] as const
            ).map(([m, t, s]) => (
              <button
                key={m}
                type="button"
                aria-pressed={setup.rule.mode === m}
                onClick={() => updateSetup((d) => void (d.rule.mode = m))}
                className={`text-left rounded-xl border px-3 py-2 cursor-pointer ${setup.rule.mode === m ? "border-accent bg-accent-soft" : "border-line hover:bg-surface-2"}`}
              >
                <div className="font-bold text-[15px]">{t}</div>
                <div className="text-[13px] text-muted">{s}</div>
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-3 min-h-11 cursor-pointer">
          <input
            type="checkbox"
            className="size-5 accent-[var(--accent)]"
            checked={setup.rule.automatic}
            onChange={(e) => updateSetup((d) => void (d.rule.automatic = e.target.checked))}
          />
          <span>Tagajärg on automaatne (mitte õpetaja otsus)</span>
        </label>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cons">Mis juhtub piiri ületamisel</Label>
          <input id="cons" className="field" value={setup.rule.consequence} onChange={(e) => updateSetup((d) => void (d.rule.consequence = e.target.value))} />
        </div>
      </Section>

      <Section title="Arvestusperiood" sub={`${setup.windowName} · ${fmtDate(setup.windowStart, true)} – ${fmtDate(setup.windowEnd, true)}`}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wname">Nimi</Label>
          <input id="wname" className="field" value={setup.windowName} onChange={(e) => updateSetup((d) => void (d.windowName = e.target.value))} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <DateField label="Algus" value={setup.windowStart} onChange={(v) => updateSetup((d) => void (d.windowStart = v))} />
          <DateField label="Viimane arvesse minev päev" value={setup.windowEnd} onChange={(v) => updateSetup((d) => void (d.windowEnd = v))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cls">Klass</Label>
          <input id="cls" className="field" value={setup.className} placeholder="nt 9.b" onChange={(e) => updateSetup((d) => void (d.className = e.target.value))} />
        </div>
      </Section>

      <Section title="Ained" sub={`${setup.subjects.filter((s) => s.tracked).length} arvestatavat ainet`}>
        <div className="text-[13px] text-muted">
          „Varem” on tunnid, mis toimusid enne esimest tunniplaani (nt 1. periood, loe e-koolist). Kokku = varem + tunniplaani järgi.
        </div>
        {setup.subjects.map((s, i) => (
          <div key={s.id} className="grid grid-cols-[1fr_76px_auto] gap-2 items-center">
            <input
              aria-label="Aine nimi"
              className="field min-w-0"
              value={s.name}
              onChange={(e) => updateSetup((d) => void (d.subjects[i].name = e.target.value))}
            />
            <input
              aria-label={`${s.name}: tunnid varem`}
              type="number"
              min={0}
              className="field num px-2"
              value={setup.baseline[s.id] ?? 0}
              onChange={(e) => updateSetup((d) => void (d.baseline[s.id] = Math.max(0, Math.round(Number(e.target.value) || 0))))}
            />
            <div className="flex items-center gap-1">
              <label className="flex items-center gap-1.5 text-[13px] text-muted min-h-11 px-1 cursor-pointer" title="Arvesta reegli järgi">
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--accent)]"
                  checked={s.tracked}
                  onChange={(e) => updateSetup((d) => void (d.subjects[i].tracked = e.target.checked))}
                />
                <span className="num w-8 text-right">{T[s.id] ?? 0}</span>
              </label>
              <label className="flex items-center min-h-11 px-1 cursor-pointer" title="Vähem tähtis: nt hinne alles aasta lõpus. Ei tõuse ülevaates esile.">
                <input
                  type="checkbox"
                  aria-label={`${s.name}: vähem tähtis`}
                  className="size-5 accent-[var(--accent)]"
                  checked={!!s.advisory}
                  disabled={!s.tracked}
                  onChange={(e) => updateSetup((d) => void (d.subjects[i].advisory = e.target.checked || undefined))}
                />
              </label>
            </div>
          </div>
        ))}
        <div className="text-[13px] text-muted -mt-1">Veerud: nimi · tunde varem · arvestatakse · kokku · vähem tähtis (nt hinne alles aasta lõpus)</div>
        <AddSubject
          onAdd={(name) =>
            updateSetup((d) => {
              let id = slug(name) || "aine";
              while (d.subjects.some((x) => x.id === id)) id += "-2";
              d.subjects.push({ id, name, tracked: true });
            })
          }
        />
      </Section>

      <Section title="Tunniplaanid" sub={setup.segments.map((s) => s.name).join(" · ")}>
        <div className="text-[13px] text-muted">
          Iga periood saab oma tunniplaani. Kui uut tunniplaani veel pole, kopeeri eelmine ja märgi „eeldatud”.
        </div>
        {setup.segments.map((seg, si) => (
          <SegmentEditor key={seg.id} setup={setup} si={si} updateSetup={updateSetup} />
        ))}
        <Button
          variant="ghost"
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
          + Lisa periood
        </Button>
      </Section>

      <Section title="Vabad päevad" sub={setup.holidays.length ? `${setup.holidays.length} koolipäeva ilma tundideta` : "Vaheajad, pühad, koolivälised päevad"}>
        <div className="text-[13px] text-muted">Päevad, kus tunde ei toimu. Need vähendavad tundide koguarvu, seega ka lubatud puudumisi.</div>
        {(() => {
          const missing = breakDays(setup.windowStart, setup.windowEnd).filter((d) => !setup.holidays.includes(d));
          return missing.length > 0 ? (
            <div>
              <Button
                variant="ghost"
                onClick={() => updateSetup((s) => void (s.holidays = [...new Set([...s.holidays, ...missing])].sort()))}
              >
                Lisa riiklikud vaheajad ({missing.length} päeva)
              </Button>
            </div>
          ) : null;
        })()}
        <div className="flex flex-col">
          {dateRuns(setup.holidays).map((r) => (
            <div key={r.start} className="flex items-center justify-between gap-3 min-h-11 border-t border-line first:border-t-0">
              <span className="num text-[15px]">
                {r.start === r.end ? fmtDate(r.start, true) : `${fmtDate(r.start)} – ${fmtDate(r.end, true)}`}
                <span className="text-muted text-sm"> · {r.days.length} p</span>
              </span>
              <button
                type="button"
                aria-label={`Eemalda ${fmtDate(r.start)}${r.start === r.end ? "" : ` – ${fmtDate(r.end)}`}`}
                className="size-10 grid place-items-center rounded-lg text-muted hover:text-bad cursor-pointer"
                onClick={() => updateSetup((s) => void (s.holidays = s.holidays.filter((x) => !r.days.includes(x))))}
              >
                <Icon name="x" size={18} />
              </button>
            </div>
          ))}
        </div>
        <AddHoliday onAdd={(d) => updateSetup((s) => void (!s.holidays.includes(d) && (s.holidays.push(d), s.holidays.sort())))} />
      </Section>

      <Section title="Jaga klassikaaslastega" sub="Saada tunniplaan ja reegel, ilma sinu puudumisteta">
        <div className="text-[13px] text-muted">Klassikaaslane avab lingi ja saab sama seadistuse. Tema puudumised jäävad tema seadmesse.</div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => copy(shareUrl(), "Link")}>Kopeeri link</Button>
          <Button variant="ghost" onClick={() => copy(encodeSetup(setup), "Kood")}>
            Kopeeri kood
          </Button>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="code">Või kleebi kood, mille said</Label>
          <div className="flex gap-2">
            <input id="code" className="field font-mono text-sm min-w-0" value={code} onChange={(e) => setCode(e.target.value)} />
            <Button
              variant="ghost"
              disabled={!code.trim()}
              onClick={() => {
                const s = decodeSetup(code.replace(/^.*#setup=/, ""));
                if (!s) return setMsg("See kood ei tööta.");
                replaceAll({ ...data, setup: s });
                setCode("");
                setMsg("Seadistus laaditud. Sinu puudumised jäid alles.");
              }}
            >
              Lae
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Varukoopia" sub="Andmed on ainult selles seadmes">
        <div className="text-[13px] text-muted">Varu hoiab kõike sinu brauseris. Tee aeg-ajalt varukoopia, eriti enne telefoni vahetust.</div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={exportJson}>
            Laadi alla (.json)
          </Button>
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>
            Taasta failist
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
        </div>
        <ResetAll onReset={() => replaceAll({ setup: null, absences: [] })} />
      </Section>

      <div className="text-sm text-muted min-h-5" role="status">
        {msg}
      </div>
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className="text-sm text-muted">{label}</span>
      <input type="date" className="field num min-w-0" value={value} onChange={(e) => isValidISO(e.target.value) && onChange(e.target.value)} />
    </label>
  );
}

function AddSubject({ onAdd }: { onAdd: (name: string) => void }) {
  const [v, setV] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) onAdd(v.trim());
        setV("");
      }}
    >
      <input className="field min-w-0" placeholder="Uus aine" aria-label="Uue aine nimi" value={v} onChange={(e) => setV(e.target.value)} />
      <Button type="submit" variant="ghost" className="shrink-0" disabled={!v.trim()}>
        Lisa
      </Button>
    </form>
  );
}

function AddHoliday({ onAdd }: { onAdd: (d: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="flex gap-2">
      <input type="date" aria-label="Vaba päev" className="field num min-w-0" value={v} onChange={(e) => setV(e.target.value)} />
      <Button variant="ghost" className="shrink-0" disabled={!isValidISO(v)} onClick={() => (onAdd(v), setV(""))}>
        Lisa
      </Button>
    </div>
  );
}

function ResetAll({ onReset }: { onReset: () => void }) {
  const [ask, setAsk] = useState(false);
  return ask ? (
    <div className="flex items-center gap-2 flex-wrap text-sm">
      <span>Kustutan kõik andmed selles seadmes?</span>
      <Button variant="danger" onClick={onReset}>
        Kustuta kõik
      </Button>
      <Button variant="ghost" onClick={() => setAsk(false)}>
        Ei
      </Button>
    </div>
  ) : (
    <div>
      <Button variant="quiet" className="text-bad" onClick={() => setAsk(true)}>
        Alusta otsast
      </Button>
    </div>
  );
}

function SegmentEditor({ setup, si, updateSetup }: { setup: Setup; si: number; updateSetup: Store["updateSetup"] }) {
  const seg = setup.segments[si];
  const others = setup.segments.filter((_, i) => i !== si);
  const upd = (fn: (s: Setup["segments"][number]) => void) => updateSetup((d) => fn(d.segments[si]));

  return (
    <div className="rounded-xl border border-line p-3 flex flex-col gap-3 bg-surface-2/50">
      <div className="flex gap-2 items-center">
        <input aria-label="Perioodi nimi" className="field font-bold min-w-0" value={seg.name} onChange={(e) => upd((s) => void (s.name = e.target.value))} />
        <Button variant="quiet" className="text-bad" onClick={() => updateSetup((d) => void d.segments.splice(si, 1))} aria-label={`Eemalda ${seg.name}`}>
          Eemalda
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <DateField label="Algus" value={seg.start} onChange={(v) => upd((s) => void (s.start = v))} />
        <DateField label="Lõpp" value={seg.end} onChange={(v) => upd((s) => void (s.end = v))} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <label className="flex items-center gap-2 min-h-11 cursor-pointer text-[15px]">
          <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={!!seg.assumed} onChange={(e) => upd((s) => void (s.assumed = e.target.checked))} />
          Tunniplaan eeldatud
        </label>
        {others.length > 0 && (
          <select
            aria-label="Kopeeri tunniplaan"
            className="field w-auto text-sm"
            value=""
            onChange={(e) => {
              const src = setup.segments.find((s) => s.id === e.target.value);
              if (src) upd((s) => void (s.timetable = structuredClone(src.timetable)));
            }}
          >
            <option value="">Kopeeri tunniplaan…</option>
            {others.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <WeekEditor
        subjects={setup.subjects}
        timetable={seg.timetable}
        onChange={(t) => upd((s) => void (s.timetable = t))}
      />
    </div>
  );
}
