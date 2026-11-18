import { useMemo, useState } from "react";
import { inWindow, lessonTimes, lessonsOn, missableOn, preview, segmentFor, statusOf, summary, withCancelled } from "../core/calc";
import { addDays, eachDay, weekdayOf } from "../core/dates";
import type { Absence, Setup, SubjectRow } from "../core/types";
import { newId } from "../store";
import { Button, Check, Icon, Pill, Row, Section, Segmented, Switch, WD_LONG, cap, fmtDate, joinEt, leftLabel, pct, tunde } from "./kit";

type DayPick = "today" | "tomorrow" | "other";

/** Longest range "Mitu päeva" accepts (a long trip is still one screen). */
const MAX_RANGE_DAYS = 31;

export function LogAbsence({
  setup,
  rows,
  absences,
  now,
  onSave,
  onSaveMany,
  onCancel,
  inSheet,
}: {
  /** Shown inside the Lisa sheet: the save bar sits at the sheet's bottom, not above a tab bar. */
  inSheet?: boolean;
  setup: Setup;
  rows: SubjectRow[];
  absences: Absence[];
  now: string;
  onSave: (a: Absence) => void;
  onSaveMany: (a: Absence[]) => void;
  onCancel: (date: string, changes: Record<string, number>, label: string) => void;
}) {
  /** "absent": I miss lessons. "cancel": lessons do not take place (lowers the totals). */
  const [mode, setMode] = useState<"absent" | "cancel">("absent");
  const [cancelPick, setCancelPick] = useState<Set<number>>(new Set());
  const tomorrow = addDays(now, 1);
  const [date, setDate] = useState(now);
  const [pick, setPick] = useState<DayPick>("today");
  const [unchecked, setUnchecked] = useState<Set<number>>(new Set());
  /** Double lessons where only part is missed: block index -> lessons missed. */
  const [partial, setPartial] = useState<Record<number, number>>({});
  const [extra, setExtra] = useState<Record<string, number>>({});
  const [extraOpen, setExtraOpen] = useState(false);
  const [note, setNote] = useState("");
  const [multi, setMulti] = useState(false);
  const [until, setUntil] = useState(addDays(now, 4));

  const name = (id: string) => setup.subjects.find((s) => s.id === id)?.name ?? id;
  const blocks = lessonsOn(setup, date);
  const seg = segmentFor(setup, date);
  const wd = weekdayOf(date);
  const future = date > now;

  const changeDate = (d: string) => {
    if (!d) return;
    setDate(d);
    setUnchecked(new Set());
    setCancelPick(new Set());
    setPartial({});
    setExtra({});
  };

  const sel = useMemo(() => {
    const s: Record<string, number> = {};
    blocks.forEach((b, i) => {
      if (!b.selfStudy && !unchecked.has(i)) s[b.subjectId] = (s[b.subjectId] ?? 0) + (partial[i] ?? b.count);
    });
    for (const [id, n] of Object.entries(extra)) if (n > 0) s[id] = (s[id] ?? 0) + n;
    return s;
  }, [blocks, unchecked, extra, partial]);

  // Several days: every missable lesson of each school day in the range, one entry per day.
  const rangeDays = useMemo(() => {
    if (!multi || until < date) return [];
    return eachDay(date, until)
      .slice(0, MAX_RANGE_DAYS)
      .map((d) => {
        const lessons: Record<string, number> = {};
        for (const b of missableOn(setup, d)) lessons[b.subjectId] = (lessons[b.subjectId] ?? 0) + b.count;
        return { date: d, lessons };
      })
      .filter((x) => Object.keys(x.lessons).length);
  }, [multi, date, until, setup]);
  const rangeSel = useMemo(() => {
    const s: Record<string, number> = {};
    for (const d of rangeDays) for (const [id, n] of Object.entries(d.lessons)) s[id] = (s[id] ?? 0) + n;
    return s;
  }, [rangeDays]);

  // Cancelled lessons: what they do to each subject's total and allowance.
  const cancelSel = useMemo(() => {
    const c: Record<string, number> = {};
    blocks.forEach((b, i) => {
      if (!b.selfStudy && cancelPick.has(i)) c[b.subjectId] = (c[b.subjectId] ?? 0) + b.count;
    });
    return c;
  }, [blocks, cancelPick]);
  const cancelEffect = useMemo(() => {
    if (mode !== "cancel" || !Object.keys(cancelSel).length) return [];
    const after = new Map(summary({ ...setup, cancelled: withCancelled(setup.cancelled, date, cancelSel) }, absences, now).map((r) => [r.subject.id, r]));
    return rows.filter((r) => cancelSel[r.subject.id]).map((r) => ({ before: r, after: after.get(r.subject.id)! }));
  }, [mode, cancelSel, setup, date, absences, now, rows]);
  const cancelTotal = Object.values(cancelSel).reduce((x, y) => x + y, 0);
  const fewerAllowed = cancelEffect.filter((e) => e.after && e.after.max < e.before.max);

  const p = preview(setup, rows, date, multi ? rangeSel : sel);
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
    if (mode === "cancel") {
      if (!cancelTotal) return;
      const names = Object.keys(cancelSel).map(name);
      onCancel(date, cancelSel, `${joinEt(names)} jääb ära, ${fmtDate(date)}.`);
      setCancelPick(new Set());
      return;
    }
    if (!p.total) return;
    if (multi) {
      const createdAt = new Date().toISOString();
      onSaveMany(rangeDays.map((d) => ({ id: newId(), date: d.date, lessons: d.lessons, note: note.trim() || undefined, createdAt })));
      setNote("");
      return;
    }
    onSave({ id: newId(), date, lessons: sel, note: note.trim() || undefined, createdAt: new Date().toISOString() });
    setUnchecked(new Set());
    setExtra({});
    setNote("");
  };

  const goesOver = p.counts && p.over.length > 0;
  const verdict = !p.total
    ? multi
      ? "Neil päevadel tunde pole"
      : "Vali tunnid"
    : !p.counts
      ? `${tunde(p.total)}, ei lähe arvesse`
      : goesOver
        ? `Läheks üle piiri: ${joinEt(p.over.map(name))}`
        : multi
          ? `${rangeDays.length} päeva, ${tunde(p.total)}, jääd piiri sisse`
          : `${tunde(p.total)}, jääd piiri sisse`;
  const action = future ? "Planeeri" : "Salvesta";

  const cancelMode = mode === "cancel";
  return (
    <>
      <Segmented<"absent" | "cancel">
        label="Mida märgid"
        value={mode}
        onChange={(m) => {
          setMode(m);
          if (m === "cancel") setMulti(false);
        }}
        options={[
          { value: "absent", label: "Puudun" },
          { value: "cancel", label: "Tund jääb ära" },
        ]}
      />
      <Section footer={(!multi && (cancelMode ? "Ärajäänud tund ei ole puudumine, aga vähendab aine tundide koguarvu. Nii võib lubatud puudumisi jääda vähemaks." : info)) || undefined}>
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
          <span>{multi ? "Alates" : cap(WD_LONG[wd])}</span>
          <input
            type="date"
            aria-label="Kuupäev"
            className="num bg-surface-2 rounded-full px-3 py-1.5 text-[17px] border-0 text-accent"
            value={date}
            onChange={(e) => {
              setPick(e.target.value === now ? "today" : e.target.value === tomorrow ? "tomorrow" : "other");
              changeDate(e.target.value);
              if (e.target.value > until) setUntil(e.target.value);
            }}
          />
        </label>
        {multi && (
          <label className="cell flex items-center justify-between gap-3 px-5 min-h-[52px]">
            <span>Kuni</span>
            <input
              type="date"
              aria-label="Kuni"
              min={date}
              className="num bg-surface-2 rounded-full px-3 py-1.5 text-[17px] border-0 text-accent"
              value={until}
              onChange={(e) => e.target.value && setUntil(e.target.value)}
            />
          </label>
        )}
        {!cancelMode && (
          <div className="cell flex items-center justify-between gap-3 px-5 min-h-[52px]">
            <span>Mitu päeva</span>
            <Switch label="Mitu päeva" checked={multi} onChange={setMulti} />
          </div>
        )}
      </Section>

      {multi && (
        <Section title={rangeDays.length ? `${rangeDays.length} koolipäeva` : undefined} footer={rangeDays.length ? "Iga päev läheb eraldi kirja, kõik selle päeva tunnid. Üksikuid tunde saad hiljem ajaloos muuta." : "Valitud vahemikus pole tunde. Vali teised kuupäevad."}>
          {rangeDays.map((d) => {
            const n = Object.values(d.lessons).reduce((x, y) => x + y, 0);
            return (
              <Row key={d.date} detail={<span className="num text-[15px]">{tunde(n)}</span>}>
                <div className="num">{fmtDate(d.date)}</div>
                <div className="text-[13px] text-muted truncate">{Object.keys(d.lessons).map(name).join(", ")}</div>
              </Row>
            );
          })}
        </Section>
      )}

      {cancelMode && (
        <Section title={`Mis tunnid jäävad ära, ${fmtDate(date)}`} footer={blocks.some((b) => !b.selfStudy) ? undefined : "Sel päeval pole tunde, mis saaks ära jääda."}>
          {blocks
            .map((b, i) => ({ b, i }))
            .filter(({ b }) => !b.selfStudy)
            .map(({ b, i }) => (
              <button
                key={i}
                type="button"
                role="checkbox"
                aria-checked={cancelPick.has(i)}
                onClick={() => {
                  const n = new Set(cancelPick);
                  n.has(i) ? n.delete(i) : n.add(i);
                  setCancelPick(n);
                }}
                className="cell press flex items-center gap-3 px-5 min-h-[52px] w-full text-left cursor-pointer"
              >
                <span className="num text-[15px] text-muted w-12 shrink-0">{lessonTimes(setup, b)?.start ?? `${b.slot}.`}</span>
                <span className="flex-1 min-w-0 truncate">{name(b.subjectId)}</span>
                <span className="num text-[15px] text-muted">{tunde(b.count)}</span>
                <Check on={cancelPick.has(i)} />
              </button>
            ))}
        </Section>
      )}

      {cancelMode && cancelEffect.length > 0 && (
        <Section title="Mis muutub" footer="Lubatud puudumised arvutatakse uuest, väiksemast tundide arvust.">
          {cancelEffect.map(({ before, after }) => (
            <Row
              key={before.subject.id}
              detail={
                after.max < before.max ? (
                  <span className="text-warn font-semibold text-[15px] num">lubatud {before.max} → {after.max}</span>
                ) : (
                  <span className="text-[15px] num">lubatud {after.max}</span>
                )
              }
            >
              <div className="truncate">{before.subject.name}</div>
              <div className="text-[13px] text-muted num">
                tunde kokku {before.total} → {after.total}
              </div>
            </Row>
          ))}
        </Section>
      )}

      {!cancelMode && !multi && (blocks.length > 0 || noTimetable || extraOpen || Object.keys(extra).length > 0) && (
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
              <div key={i} className="cell flex items-center pr-3">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={!unchecked.has(i)}
                  onClick={() => {
                    const n = new Set(unchecked);
                    n.has(i) ? n.delete(i) : n.add(i);
                    setUnchecked(n);
                  }}
                  className="press flex-1 min-w-0 flex items-center gap-3 pl-5 pr-2 min-h-[52px] text-left cursor-pointer"
                >
                  <span className="num text-[15px] text-muted w-12 shrink-0">{lessonTimes(setup, b)?.start ?? `${b.slot}.`}</span>
                  <span className="flex-1 min-w-0 truncate">{name(b.subjectId)}</span>
                  <Check on={!unchecked.has(i)} />
                </button>
                {b.count > 1 && !unchecked.has(i) ? (
                  <button
                    type="button"
                    onClick={() => setPartial({ ...partial, [i]: (partial[i] ?? b.count) > 1 ? (partial[i] ?? b.count) - 1 : b.count })}
                    aria-label={`${name(b.subjectId)}: puudud ${tunde(partial[i] ?? b.count)}, muuda`}
                    className="shrink-0 num min-h-8 px-3 rounded-full bg-accent-soft text-accent text-[13px] font-semibold cursor-pointer"
                  >
                    {tunde(partial[i] ?? b.count)}
                  </button>
                ) : (
                  <span className="shrink-0 num text-[15px] text-muted px-1">{tunde(b.count)}</span>
                )}
              </div>
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

      {!cancelMode && p.lines.length > 0 && (
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

      {!cancelMode && (
      <Section>
        <label className="cell flex items-center px-5">
          <input className="cell-input text-[17px] placeholder:text-faint" maxLength={120} placeholder="Märkus (nt arsti juures)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Märkus" />
        </label>
      </Section>
      )}

      <div className={`glass sticky z-10 ${inSheet ? "bottom-0" : "bottom-[calc(env(safe-area-inset-bottom)+82px)]"} rounded-full pl-5 pr-1.5 py-1.5 flex items-center gap-3`}>
        {cancelMode ? (
          <>
            <div role="status" className={`flex-1 min-w-0 text-[15px] leading-tight font-medium ${!cancelTotal ? "text-muted" : fewerAllowed.length ? "text-warn" : "text-ink"}`}>
              {!cancelTotal
                ? "Vali tunnid, mis jäävad ära"
                : fewerAllowed.length
                  ? `${tunde(cancelTotal)} jääb ära. ${joinEt(fewerAllowed.map((e) => e.before.subject.name))}: lubatud vähem`
                  : `${tunde(cancelTotal)} jääb ära`}
            </div>
            <Button onClick={save} disabled={!cancelTotal} className="shrink-0">
              Märgi
            </Button>
          </>
        ) : (
          <>
            <div role="status" className={`flex-1 min-w-0 text-[15px] leading-tight font-medium ${!p.total || !p.counts ? "text-muted" : goesOver ? "text-bad" : "text-ok"}`}>
              {verdict}
            </div>
            <Button variant={goesOver ? "danger" : "primary"} onClick={save} disabled={!p.total} className="shrink-0">
              {goesOver ? `${action} ikkagi` : action}
            </Button>
          </>
        )}
      </div>
    </>
  );
}
