import { useMemo, useState } from "react";
import { inWindow, lessonsOn, preview, segmentFor, statusOf } from "../core/calc";
import { addDays, weekdayOf } from "../core/dates";
import type { Absence, Setup, SubjectRow } from "../core/types";
import { newId } from "../store";
import { Button, Card, Icon, Label, Pill, WD_LONG, joinEt, leftLabel, pct, tunde } from "./kit";

export function LogAbsence({
  setup,
  rows,
  now,
  onSave,
}: {
  setup: Setup;
  rows: SubjectRow[];
  now: string;
  onSave: (a: Absence) => void;
}) {
  const [date, setDate] = useState(now);
  const [unchecked, setUnchecked] = useState<Set<number>>(new Set());
  const [extra, setExtra] = useState<Record<string, number>>({});
  const [extraOpen, setExtraOpen] = useState(false);
  const [extraPick, setExtraPick] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  const name = (id: string) => setup.subjects.find((s) => s.id === id)?.name ?? id;
  const blocks = lessonsOn(setup, date);
  const seg = segmentFor(setup, date);
  const wd = weekdayOf(date);
  const future = date > now;
  const tomorrow = addDays(now, 1);

  const changeDate = (d: string) => {
    if (!d) return;
    setDate(d);
    setUnchecked(new Set());
    setExtra({});
  };

  const sel = useMemo(() => {
    const s: Record<string, number> = {};
    blocks.forEach((b, i) => {
      if (!b.selfStudy && !unchecked.has(i)) s[b.subjectId] = (s[b.subjectId] ?? 0) + b.count;
    });
    for (const [id, n] of Object.entries(extra)) if (n > 0) s[id] = (s[id] ?? 0) + n;
    return s;
  }, [blocks, unchecked, extra]);

  const p = preview(setup, rows, date, sel);
  const noTimetable = inWindow(setup, date) && wd >= 1 && wd <= 5 && !setup.holidays.includes(date) && !seg;

  let info = WD_LONG[wd];
  if (wd === 0 || wd === 6) info += ": nädalavahetus.";
  else if (!inWindow(setup, date)) info += ": väljaspool arvestusperioodi, ei lähe arvesse.";
  else if (setup.holidays.includes(date)) info += ": vaba päev.";
  else if (!seg) info += ": selle päeva tunniplaani pole (nt vaheaeg või 1. periood). Lisa tunnid käsitsi.";
  else if (blocks.length && blocks.every((b) => b.selfStudy)) info += ": iseõppepäev, loeb kohalolekuna.";
  else if (seg.assumed) info += `: ${seg.name}, tunniplaan eeldatud.`;
  else info += `: ${seg.name}.`;
  if (future && inWindow(setup, date)) info += " Tulevik: salvestades läheb see plaanina kirja ja hakkab lugema, kui päev käes.";

  const save = () => {
    if (!p.total) return;
    onSave({ id: newId(), date, lessons: sel, note: note.trim() || undefined, createdAt: new Date().toISOString() });
    setUnchecked(new Set());
    setExtra({});
    setNote("");
    setNoteOpen(false);
  };

  const goesOver = p.counts && p.over.length > 0;
  const verdict = !p.total
    ? "Vali tunnid, millest puudusid või plaanid puududa."
    : !p.counts
      ? `${tunde(p.total)}, ei lähe arvesse.`
      : goesOver
        ? `${tunde(p.total)}. Läheks üle piiri: ${joinEt(p.over.map(name))}.`
        : `${tunde(p.total)}. Jääd kõigis ainetes piiri sisse.`;
  const action = future ? "Planeeri" : "Salvesta";

  const chip = (d: string, label: string) => (
    <button
      type="button"
      onClick={() => changeDate(d)}
      aria-pressed={date === d}
      className={`min-h-11 px-4 rounded-full border text-[15px] font-bold cursor-pointer transition-colors duration-100 ${
        date === d ? "bg-accent text-accent-ink border-accent" : "border-line text-ink hover:bg-surface-2"
      }`}
    >
      {label}
    </button>
  );

  return (
    <>
      <Card className="gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            {chip(now, "Täna")}
            {chip(tomorrow, "Homme")}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" aria-label="Eelmine päev" className="px-3" onClick={() => changeDate(addDays(date, -1))}>
              <Icon name="left" />
            </Button>
            <input id="date" aria-label="Kuupäev" type="date" className="field num flex-1 min-w-0" value={date} onChange={(e) => changeDate(e.target.value)} />
            <Button variant="ghost" aria-label="Järgmine päev" className="px-3" onClick={() => changeDate(addDays(date, 1))}>
              <Icon name="right" />
            </Button>
          </div>
          <div className="text-sm text-muted">{info}</div>
        </div>

        {blocks.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {blocks.map((b, i) =>
              b.selfStudy ? (
                <div key={i} className="flex items-center gap-3 px-3 min-h-11 rounded-xl border border-dashed border-line text-muted">
                  <span className="num text-[13px] w-9">{b.slot}.</span>
                  <span className="flex-1">{name(b.subjectId)}</span>
                  <span className="text-[13px]">iseõpe</span>
                </div>
              ) : (
                <label
                  key={i}
                  className={`flex items-center gap-3 px-3 min-h-11 rounded-xl border cursor-pointer select-none transition-colors duration-100 ${
                    unchecked.has(i) ? "border-line opacity-55" : "border-accent/40 bg-accent-soft"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="size-5 accent-[var(--accent)]"
                    checked={!unchecked.has(i)}
                    onChange={(e) => {
                      const n = new Set(unchecked);
                      e.target.checked ? n.delete(i) : n.add(i);
                      setUnchecked(n);
                    }}
                  />
                  <span className="num text-[13px] text-muted w-9">{b.slot}.</span>
                  <span className="flex-1">{name(b.subjectId)}</span>
                  <span className="num text-[13px] text-muted">{tunde(b.count)}</span>
                </label>
              ),
            )}
          </div>
        )}

        {extraOpen || noTimetable || Object.keys(extra).length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="extra">Lisa tund, mida tunniplaanis pole</Label>
            <div className="flex gap-2">
              <select id="extra" className="field flex-1 min-w-0" value={extraPick} onChange={(e) => setExtraPick(e.target.value)}>
                <option value="" disabled>
                  Vali aine
                </option>
                {setup.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <Button variant="ghost" disabled={!extraPick} onClick={() => extraPick && setExtra({ ...extra, [extraPick]: (extra[extraPick] ?? 0) + 1 })}>
                Lisa
              </Button>
            </div>
            {Object.keys(extra).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(extra).map(([id, n]) => (
                  <span key={id} className="inline-flex items-center gap-0.5 pl-3 rounded-full bg-accent-soft text-sm">
                    {name(id)} ×{n}
                    <button
                      type="button"
                      aria-label={`Eemalda ${name(id)}`}
                      className="size-9 grid place-items-center text-muted hover:text-ink rounded-full cursor-pointer"
                      onClick={() => {
                        const e = { ...extra };
                        delete e[id];
                        setExtra(e);
                      }}
                    >
                      <Icon name="x" size={16} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {p.lines.length > 0 && (
          <div className="flex flex-col gap-2" aria-live="polite">
            {p.lines.map((l) => (
              <div key={l.subjectId} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center text-[15px] num">
                <span className="min-w-0 truncate">
                  {name(l.subjectId)} <span className="text-muted">+{l.add}</span>
                </span>
                {l.counted ? (
                  <>
                    <span className="text-muted text-sm">
                      {l.absentAfter}/{l.total} · {pct(l.absentAfter / l.total)}
                    </span>
                    <Pill status={statusOf(l.leftAfter)}>{leftLabel(l.leftAfter)}</Pill>
                  </>
                ) : (
                  <>
                    <span className="text-muted text-sm">ei lähe arvesse</span>
                    <span />
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {noteOpen || note ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">Märkus</Label>
            <input id="note" className="field" maxLength={120} placeholder="nt haige, arsti juures" value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
          </div>
        ) : null}

        <div className="flex gap-1 flex-wrap -ml-2 -mb-1">
          {!(extraOpen || noTimetable || Object.keys(extra).length > 0) && (
            <Button variant="quiet" className="text-sm" onClick={() => setExtraOpen(true)}>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="plus" size={16} /> Muu tund
              </span>
            </Button>
          )}
          {!(noteOpen || note) && (
            <Button variant="quiet" className="text-sm" onClick={() => setNoteOpen(true)}>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="plus" size={16} /> Märkus
              </span>
            </Button>
          )}
        </div>
      </Card>

      <div className="sticky z-10 bottom-[calc(57px+env(safe-area-inset-bottom)+8px)] rounded-2xl border border-line bg-surface shadow-[0_8px_24px_-8px_oklch(0_0_0/0.45)] p-3 flex items-center gap-3">
        <div
          role="status"
          className={`flex-1 min-w-0 text-[15px] leading-snug ${!p.total || !p.counts ? "text-muted" : goesOver ? "text-bad font-bold" : "text-ok font-bold"}`}
        >
          {verdict}
        </div>
        <Button variant={goesOver ? "danger" : "primary"} onClick={save} disabled={!p.total} className="shrink-0">
          {goesOver ? `${action} ikkagi` : action}
        </Button>
      </div>
    </>
  );
}
