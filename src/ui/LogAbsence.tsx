import { useMemo, useState, useCallback } from "react";
import { isStartingAbsence } from "../core/setup";
import { inWindow, lessonTimes, lessonsOn, missableOn, preview, segmentFor, } from "../core/calc";
import { addDays, eachDay, weekdayOf } from "../core/dates";
import type { Absence, Setup, SubjectRow } from "../core/types";
import { newId } from "../store";
import { ActionSheet, Button, Check, DateField, DateRangeField, Icon, Row, Section, Segmented, Switch, WD_LONG, cap, fmtDate, joinEt, tunde } from "./kit";

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
  onUnlog,
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
  /** Takes already logged lessons of a subject off that day again. */
  onUnlog: (date: string, subjectId: string, count: number) => void;
}) {
  /** Block whose logged lessons the user tapped, to offer removing them. */
  const [unlogIdx, setUnlogIdx] = useState<number | null>(null);
  const tomorrow = addDays(now, 1);
  const [date, setDate] = useState(now);
  const [pick, setPick] = useState<DayPick>("today");
  const [unchecked, setUnchecked] = useState<Set<number>>(new Set());
  /** Double lessons where only part is missed: block index -> lessons missed. */
  const [partial, setPartial] = useState<Record<number, number>>({});
  const [extra, setExtra] = useState<Record<string, number>>({});
  const [extraOpen, setExtraOpen] = useState(false);
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
    setPartial({});
    setExtra({});
  };

  // Lessons already logged on this day (from Täna or earlier entries) are shown as done, not offered again.
  const loggedByDay = useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    for (const a of absences) {
      if (isStartingAbsence(a)) continue;
      const d = m.get(a.date) ?? {};
      for (const [id, n] of Object.entries(a.lessons)) d[id] = (d[id] ?? 0) + n;
      m.set(a.date, d);
    }
    return m;
  }, [absences]);
  const loggedPerBlock = useMemo(() => {
    const left = { ...(loggedByDay.get(date) ?? {}) };
    return blocks.map((b) => {
      if (b.selfStudy) return 0;
      const k = Math.min(left[b.subjectId] ?? 0, b.count);
      if (k) left[b.subjectId] -= k;
      return k;
    });
  }, [blocks, loggedByDay, date]);
  const openCount = (i: number) => blocks[i].count - loggedPerBlock[i];

  const sel = useMemo(() => {
    const s: Record<string, number> = {};
    blocks.forEach((b, i) => {
      const rest = b.count - loggedPerBlock[i];
      if (!b.selfStudy && rest > 0 && !unchecked.has(i)) s[b.subjectId] = (s[b.subjectId] ?? 0) + Math.min(partial[i] ?? rest, rest);
    });
    for (const [id, n] of Object.entries(extra)) if (n > 0) s[id] = (s[id] ?? 0) + n;
    return s;
  }, [blocks, unchecked, extra, partial, loggedPerBlock]);

  // Days with nothing to miss (weekends, holidays, self-study, outside the period) are greyed in the calendar.
  const noSchool = useCallback((d: string) => missableOn(setup, d).length === 0, [setup]);

  // Several days: every missable lesson of each school day in the range, one entry per day.
  const rangeDays = useMemo(() => {
    if (!multi || until < date) return [];
    return eachDay(date, until)
      .slice(0, MAX_RANGE_DAYS)
      .map((d) => {
        const lessons: Record<string, number> = {};
        for (const b of missableOn(setup, d)) lessons[b.subjectId] = (lessons[b.subjectId] ?? 0) + b.count;
        for (const [id, n] of Object.entries(loggedByDay.get(d) ?? {})) {
          if (!lessons[id]) continue;
          lessons[id] -= n;
          if (lessons[id] <= 0) delete lessons[id];
        }
        return { date: d, lessons };
      })
      .filter((x) => Object.keys(x.lessons).length);
  }, [multi, date, until, setup, loggedByDay]);
  const rangeSel = useMemo(() => {
    const s: Record<string, number> = {};
    for (const d of rangeDays) for (const [id, n] of Object.entries(d.lessons)) s[id] = (s[id] ?? 0) + n;
    return s;
  }, [rangeDays]);


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
    if (!p.total) return;
    if (multi) {
      const createdAt = new Date().toISOString();
      onSaveMany(rangeDays.map((d) => ({ id: newId(), date: d.date, lessons: d.lessons, createdAt })));
      return;
    }
    onSave({ id: newId(), date, lessons: sel, createdAt: new Date().toISOString() });
    setUnchecked(new Set());
    setExtra({});
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

  return (
    <>
      <Section footer={(!multi && info) || undefined}>
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
        {multi ? (
          <DateRangeField
            label="Päevad"
            start={date}
            end={until}
            defaultOpen
            isOff={noSchool}
            onChange={(a, b) => {
              setPick(a === now ? "today" : a === tomorrow ? "tomorrow" : "other");
              changeDate(a);
              setUntil(b);
            }}
          />
        ) : (
          <DateField
            label={cap(WD_LONG[wd])}
            value={date}
            isOff={noSchool}
            onChange={(v) => {
              setPick(v === now ? "today" : v === tomorrow ? "tomorrow" : "other");
              changeDate(v);
              if (v > until) setUntil(v);
            }}
          />
        )}
        <div className="cell flex items-center justify-between gap-3 px-5 min-h-[52px]">
          <span>Mitu päeva</span>
          <Switch label="Mitu päeva" checked={multi} onChange={setMulti} />
        </div>
      </Section>

      {multi && (
        <Section title={rangeDays.length ? `${rangeDays.length} koolipäeva` : undefined} info={rangeDays.length ? "Iga päev läheb eraldi kirja, kõik selle päeva tunnid. Üksikuid tunde saad hiljem ajaloos muuta." : "Valitud vahemikus pole tunde. Vali teised kuupäevad."}>
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

      {!multi && (blocks.length > 0 || noTimetable || extraOpen || Object.keys(extra).length > 0) && (
        <Section title={`Tunnid, ${fmtDate(date)}`}>
          {blocks.map((b, i) =>
            b.selfStudy ? (
              <Row key={i} detail={<span className="text-[15px]">iseõpe</span>}>
                <div className="flex items-baseline gap-3 text-muted">
                  <span className="num text-[15px] w-8">{b.slot}.</span>
                  <span>{name(b.subjectId)}</span>
                </div>
              </Row>
            ) : openCount(i) <= 0 ? (
              <div key={i} className="cell flex items-center gap-3 pl-5 pr-2.5 min-h-[52px]">
                <span className="num text-[15px] text-muted w-12 shrink-0">{lessonTimes(setup, b)?.start ?? `${b.slot}.`}</span>
                <span className="flex-1 min-w-0 truncate text-muted">{name(b.subjectId)}</span>
                <button
                  type="button"
                  onClick={() => setUnlogIdx(i)}
                  aria-label={`${name(b.subjectId)}: kirjas, muuda`}
                  className="tap shrink-0 flex items-center gap-1.5 min-h-8 px-3 rounded-full bg-ok-soft text-ok text-[15px] font-semibold cursor-pointer"
                >
                  <Icon name="check" size={16} stroke={2.6} />
                  Kirjas
                </button>
              </div>
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
                {openCount(i) > 1 && !unchecked.has(i) ? (
                  <button
                    type="button"
                    onClick={() => setPartial({ ...partial, [i]: (partial[i] ?? openCount(i)) > 1 ? (partial[i] ?? openCount(i)) - 1 : openCount(i) })}
                    aria-label={`${name(b.subjectId)}: puudud ${tunde(partial[i] ?? openCount(i))}, muuda`}
                    className="shrink-0 num min-h-8 px-3 rounded-full bg-accent-soft text-accent text-[13px] font-semibold cursor-pointer"
                  >
                    {tunde(partial[i] ?? openCount(i))}
                  </button>
                ) : (
                  <span className="shrink-0 num text-[15px] text-muted px-1">
                    {loggedPerBlock[i] ? `veel ${tunde(openCount(i))}` : tunde(b.count)}
                  </span>
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

      <div className={`glass sticky z-10 ${inSheet ? "bottom-0" : "bottom-[calc(var(--tabbar-bottom)+72px)]"} rounded-full pl-5 pr-1.5 py-1.5 flex items-center gap-3`}>
          <>
            <div role="status" className={`flex-1 min-w-0 text-[15px] leading-tight font-medium ${!p.total || !p.counts ? "text-muted" : goesOver ? "text-bad" : "text-ok"}`}>
              {verdict}
            </div>
            <Button haptic variant={goesOver ? "danger" : "primary"} onClick={save} disabled={!p.total} className="shrink-0">
              {goesOver ? `${action} ikkagi` : action}
            </Button>
          </>
      </div>
      <ActionSheet
        open={unlogIdx !== null}
        onClose={() => setUnlogIdx(null)}
        title={unlogIdx !== null && blocks[unlogIdx] ? `${name(blocks[unlogIdx].subjectId)}, ${fmtDate(date)}` : undefined}
        message="Kirjas puudumisena"
        actions={
          unlogIdx !== null && blocks[unlogIdx]
            ? [
                {
                  label: loggedPerBlock[unlogIdx] > 1 ? "Eemalda puudumine (mõlemad tunnid)" : "Eemalda puudumine",
                  destructive: true,
                  onClick: () => onUnlog(date, blocks[unlogIdx].subjectId, loggedPerBlock[unlogIdx]),
                },
              ]
            : []
        }
      />
    </>
  );
}
