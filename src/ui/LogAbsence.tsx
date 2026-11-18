import { useMemo, useState } from "react";
import { inWindow, lessonsOn, preview, segmentFor } from "../core/calc";
import { addDays, weekdayOf } from "../core/dates";
import type { Absence, Setup, SubjectRow } from "../core/types";
import { newId } from "../store";
import { Button, Card, Label, Pill, WD_LONG, fmtDate, pct, tunde } from "./kit";

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
  const [extraPick, setExtraPick] = useState(setup.subjects[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");

  const name = (id: string) => setup.subjects.find((s) => s.id === id)?.name ?? id;
  const blocks = lessonsOn(setup, date);
  const seg = segmentFor(setup, date);
  const wd = weekdayOf(date);

  const changeDate = (d: string) => {
    if (!d) return;
    setDate(d);
    setUnchecked(new Set());
    setExtra({});
    setMsg("");
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

  let info = WD_LONG[wd];
  if (wd === 0 || wd === 6) info += ": nädalavahetus.";
  else if (!inWindow(setup, date)) info += ": väljaspool arvestusperioodi, ei lähe arvesse.";
  else if (setup.holidays.includes(date)) info += ": vaba päev.";
  else if (!seg) info += ": selle päeva tunniplaani pole (nt vaheaeg või 1. periood). Lisa tunnid all käsitsi.";
  else if (blocks.length && blocks.every((b) => b.selfStudy)) info += ": iseõppepäev, loeb kohalolekuna.";
  else if (seg.assumed) info += `: ${seg.name}, tunniplaan eeldatud.`;
  else info += `: ${seg.name}.`;

  const save = () => {
    if (!p.total) return;
    onSave({ id: newId(), date, lessons: sel, note: note.trim() || undefined, createdAt: new Date().toISOString() });
    setUnchecked(new Set());
    setExtra({});
    setNote("");
    setMsg(`Salvestatud: ${fmtDate(date)}, ${tunde(p.total)}.`);
  };

  return (
    <Card className="gap-4">
      <h2 className="text-xl font-bold m-0">Märgi puudumine või kontrolli enne</h2>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="date">Kuupäev</Label>
        <div className="flex gap-2">
          <Button variant="ghost" aria-label="Eelmine päev" className="px-3" onClick={() => changeDate(addDays(date, -1))}>
            ‹
          </Button>
          <input id="date" type="date" className="field num flex-1 min-w-0" value={date} onChange={(e) => changeDate(e.target.value)} />
          <Button variant="ghost" aria-label="Järgmine päev" className="px-3" onClick={() => changeDate(addDays(date, 1))}>
            ›
          </Button>
        </div>
        <div className="text-sm text-muted">
          {info}
          {date > now && inWindow(setup, date) && " Tulevikus: see on plaan, mida saad enne kontrollida."}
        </div>
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="extra">Lisa muu tund</Label>
        <div className="flex gap-2">
          <select id="extra" className="field flex-1 min-w-0" value={extraPick} onChange={(e) => setExtraPick(e.target.value)}>
            {setup.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Button variant="ghost" onClick={() => extraPick && setExtra({ ...extra, [extraPick]: (extra[extraPick] ?? 0) + 1 })}>
            + Lisa
          </Button>
        </div>
        {Object.keys(extra).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(extra).map(([id, n]) => (
              <span key={id} className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-accent-soft text-sm">
                {name(id)} ×{n}
                <button
                  type="button"
                  aria-label={`Eemalda ${name(id)}`}
                  className="text-muted hover:text-ink px-2 py-0.5 rounded-full cursor-pointer"
                  onClick={() => {
                    const e = { ...extra };
                    delete e[id];
                    setExtra(e);
                  }}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5" aria-live="polite">
        {!p.total ? (
          <div className="rounded-xl px-3 py-2.5 bg-surface-2 text-muted text-sm">Vali tunnid, millest puudusid või plaanid puududa.</div>
        ) : (
          <>
            <div
              className={`rounded-xl px-3 py-2.5 font-bold ${
                !p.counts ? "bg-surface-2" : p.over.length ? "bg-bad-soft text-bad" : "bg-ok-soft text-ok"
              }`}
            >
              {!p.counts
                ? `Kokku ${tunde(p.total)}. Ei lähe arvestusse.`
                : p.over.length
                  ? `Kokku ${tunde(p.total)}. Läheks üle piiri: ${p.over.map(name).join(", ")}.`
                  : `Kokku ${tunde(p.total)}. Jääd kõigis ainetes piiri sisse.`}
            </div>
            {p.lines.map((l) => (
              <div key={l.subjectId} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center text-[15px] num">
                <span className="min-w-0 truncate">
                  {name(l.subjectId)} <span className="text-muted">+{l.add}</span>
                </span>
                {l.counted ? (
                  <>
                    <span className="text-muted">
                      {l.absentAfter}/{l.total} · {pct(l.absentAfter / l.total)}
                    </span>
                    <Pill status={l.leftAfter < 0 ? "bad" : l.leftAfter <= 2 ? "warn" : "ok"}>
                      {l.leftAfter < 0 ? `${-l.leftAfter} üle` : `${l.leftAfter} jääb`}
                    </Pill>
                  </>
                ) : (
                  <>
                    <span className="text-muted text-sm">ei lähe arvesse</span>
                    <span />
                  </>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note">Märkus (pole kohustuslik)</Label>
        <input id="note" className="field" maxLength={120} placeholder="nt haige, arsti juures" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={save} disabled={!p.total}>
          Salvesta puudumine
        </Button>
        <span className="text-sm text-muted" role="status">
          {msg}
        </span>
      </div>
    </Card>
  );
}
