import { useMemo, useState } from "react";
import { inWindow, lessonsOn, preview, segmentFor, statusOf } from "../core/calc";
import { addDays, weekdayOf } from "../core/dates";
import type { Absence, Setup, SubjectRow } from "../core/types";
import { newId } from "../store";
import { Button, Check, Icon, Pill, Row, Section, Segmented, WD_LONG, cap, fmtDate, joinEt, leftLabel, pct, tunde } from "./kit";

type DayPick = "today" | "tomorrow" | "other";

export function LogAbsence({ setup, rows, now, onSave }: { setup: Setup; rows: SubjectRow[]; now: string; onSave: (a: Absence) => void }) {
  const tomorrow = addDays(now, 1);
  const [date, setDate] = useState(now);
  const [pick, setPick] = useState<DayPick>("today");
  const [unchecked, setUnchecked] = useState<Set<number>>(new Set());
  const [extra, setExtra] = useState<Record<string, number>>({});
  const [extraOpen, setExtraOpen] = useState(false);
  const [note, setNote] = useState("");

  const name = (id: string) => setup.subjects.find((s) => s.id === id)?.name ?? id;
  const blocks = lessonsOn(setup, date);
  const seg = segmentFor(setup, date);
  const wd = weekdayOf(date);
  const future = date > now;

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

  let info = "";
  if (wd === 0 || wd === 6) info = "Nädalavahetus, tunde pole.";
  else if (!inWindow(setup, date)) info = "Väljaspool arvestusperioodi, ei lähe arvesse.";
  else if (setup.holidays.includes(date)) info = "Vaba päev, tunde pole.";
  else if (!seg) info = "Sel päeval tunniplaanis tunde pole (nt vaheaeg). Kui tund siiski toimus, lisa see käsitsi.";
  else if (blocks.length && blocks.every((b) => b.selfStudy)) info = "Iseõppepäev, loeb kohalolekuna.";
  else if (seg.assumed) info = `${seg.name}, tunniplaan eeldatud.`;
  const canLog = blocks.some((b) => !b.selfStudy) || noTimetable || Object.keys(extra).length > 0;
  if (future && inWindow(setup, date) && canLog) info = `${info} Läheb plaanina kirja ja hakkab lugema, kui päev käes.`.trim();

  const save = () => {
    if (!p.total) return;
    onSave({ id: newId(), date, lessons: sel, note: note.trim() || undefined, createdAt: new Date().toISOString() });
    setUnchecked(new Set());
    setExtra({});
    setNote("");
  };

  const goesOver = p.counts && p.over.length > 0;
  const verdict = !p.total
    ? "Vali tunnid"
    : !p.counts
      ? `${tunde(p.total)}, ei lähe arvesse`
      : goesOver
        ? `Läheks üle piiri: ${joinEt(p.over.map(name))}`
        : `${tunde(p.total)}, jääd piiri sisse`;
  const action = future ? "Planeeri" : "Salvesta";

  return (
    <>
      <Section footer={info || undefined}>
        <div className="p-3">
          <Segmented<DayPick>
            label="Päev"
            value={pick}
            onChange={(v) => {
              setPick(v);
              if (v === "today") changeDate(now);
              if (v === "tomorrow") changeDate(tomorrow);
            }}
            options={[
              { value: "today", label: "Täna" },
              { value: "tomorrow", label: "Homme" },
              { value: "other", label: "Muu päev" },
            ]}
          />
        </div>
        <label className="cell flex items-center justify-between gap-3 px-5 min-h-[52px]">
          <span>{cap(WD_LONG[wd])}</span>
          <input
            type="date"
            aria-label="Kuupäev"
            className="num bg-surface-2 rounded-full px-3 py-1.5 text-[17px] border-0 text-accent"
            value={date}
            onChange={(e) => {
              setPick(e.target.value === now ? "today" : e.target.value === tomorrow ? "tomorrow" : "other");
              changeDate(e.target.value);
            }}
          />
        </label>
      </Section>

      {(blocks.length > 0 || noTimetable || extraOpen || Object.keys(extra).length > 0) && (
        <Section title={`Tunnid, ${fmtDate(date)}`}>
          {blocks.map((b, i) =>
            b.selfStudy ? (
              <Row key={i} detail={<span className="text-[15px]">iseõpe</span>}>
                <div className="flex items-baseline gap-3 text-muted">
                  <span className="num text-[15px] w-8">{b.slot}.</span>
                  <span>{name(b.subjectId)}</span>
                </div>
              </Row>
            ) : (
              <button
                key={i}
                type="button"
                role="checkbox"
                aria-checked={!unchecked.has(i)}
                onClick={() => {
                  const n = new Set(unchecked);
                  n.has(i) ? n.delete(i) : n.add(i);
                  setUnchecked(n);
                }}
                className="cell press flex items-center gap-3 px-5 min-h-[52px] w-full text-left cursor-pointer"
              >
                <span className="num text-[15px] text-muted w-8 shrink-0">{b.slot}.</span>
                <span className="flex-1 min-w-0 truncate">{name(b.subjectId)}</span>
                <span className="num text-[15px] text-muted">{tunde(b.count)}</span>
                <Check on={!unchecked.has(i)} />
              </button>
            ),
          )}
          {Object.entries(extra).map(([id, n]) => (
            <Row
              key={id}
              detail={
                <button
                  type="button"
                  aria-label={`Eemalda ${name(id)}`}
                  className="size-9 -mr-2 grid place-items-center rounded-full text-muted cursor-pointer active:bg-surface-2"
                  onClick={() => {
                    const e = { ...extra };
                    delete e[id];
                    setExtra(e);
                  }}
                >
                  <Icon name="x" size={18} />
                </button>
              }
            >
              <span>
                {name(id)} <span className="text-muted num">×{n}</span>
              </span>
            </Row>
          ))}
          {extraOpen || noTimetable ? (
            <label className="cell flex items-center justify-between gap-3 px-5 min-h-[52px]">
              <span className="text-accent">Lisa tund</span>
              <select
                aria-label="Lisa tund, mida tunniplaanis pole"
                className="bg-transparent border-0 text-right text-muted text-[17px] max-w-[60%]"
                value=""
                onChange={(e) => e.target.value && setExtra({ ...extra, [e.target.value]: (extra[e.target.value] ?? 0) + 1 })}
              >
                <option value="">Vali aine</option>
                {setup.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <Row onClick={() => setExtraOpen(true)}>
              <span className="text-accent">Lisa tund, mida tunniplaanis pole</span>
            </Row>
          )}
        </Section>
      )}

      {p.lines.length > 0 && (
        <Section title="Mis alles jääb" footer={`Puudutud / kõik perioodi tunnid${future ? ", koos plaanidega" : ""}.`}>
          <div aria-live="polite">
            {p.lines.map((l) => (
              <Row key={l.subjectId} detail={l.counted ? <Pill status={statusOf(l.leftAfter)}>{leftLabel(l.leftAfter)}</Pill> : <span className="text-[15px]">ei lähe arvesse</span>}>
                <div className="truncate">
                  {name(l.subjectId)} <span className="text-muted num">+{l.add}</span>
                </div>
                {l.counted && (
                  <div className="text-[13px] text-muted num">
                    {l.absentAfter}/{l.total} · {pct(l.absentAfter / l.total)}
                  </div>
                )}
              </Row>
            ))}
          </div>
        </Section>
      )}

      <Section>
        <label className="cell flex items-center px-5">
          <input className="cell-input text-[17px] placeholder:text-faint" maxLength={120} placeholder="Märkus (nt arsti juures)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Märkus" />
        </label>
      </Section>

      <div className="glass sticky z-10 bottom-[calc(env(safe-area-inset-bottom)+82px)] rounded-full pl-5 pr-1.5 py-1.5 flex items-center gap-3">
        <div role="status" className={`flex-1 min-w-0 text-[15px] leading-tight font-medium ${!p.total || !p.counts ? "text-muted" : goesOver ? "text-bad" : "text-ok"}`}>
          {verdict}
        </div>
        <Button variant={goesOver ? "danger" : "primary"} onClick={save} disabled={!p.total} className="shrink-0">
          {goesOver ? `${action} ikkagi` : action}
        </Button>
      </div>
    </>
  );
}
