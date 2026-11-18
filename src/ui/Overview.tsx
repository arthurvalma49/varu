import { useState } from "react";
import { dayCapacity, dayVerdict, fractionToPct, missableOn, nextLesson, nextSchoolDay, planningSegment } from "../core/calc";
import { addDays, eachDay, weekdayOf } from "../core/dates";
import type { Setup, SubjectRow, Weekday } from "../core/types";
import { Button, Card, Empty, Meter, Pill, WD_ON, WD_SHORT, cap, fmtDate, fmtLimit, joinEt, leftLabel, limitPhrase, pct, tunde } from "./kit";

function blockSizes(setup: Setup, segId: string | undefined, subjectId: string) {
  const seg = setup.segments.find((s) => s.id === segId);
  const sizes = new Set<number>();
  for (const day of Object.values(seg?.timetable ?? {})) for (const b of day) if (b.subjectId === subjectId && !b.selfStudy) sizes.add(b.count);
  return [...sizes];
}

export function Overview({
  setup,
  rows,
  now,
  loggedDates,
  onLog,
  onSkipToday,
}: {
  setup: Setup;
  rows: SubjectRow[];
  now: string;
  /** Dates that already have an entry (missed or planned). */
  loggedDates: ReadonlySet<string>;
  onLog: () => void;
  onSkipToday: () => void;
}) {
  const [showCalm, setShowCalm] = useState(false);
  const seg = planningSegment(setup, now);
  const capacity = dayCapacity(setup, rows, seg);
  const limitPct = fractionToPct(setup.rule.limit) / 100;
  const schoolDaysLeft =
    now > setup.windowEnd
      ? 0
      : eachDay(now > setup.windowStart ? now : setup.windowStart, setup.windowEnd).filter((d) => {
          const w = new Date(d + "T12:00").getDay();
          return w >= 1 && w <= 5 && !setup.holidays.includes(d);
        }).length;

  if (!rows.length)
    return (
      <Card>
        <Empty title="Aineid pole veel">Lisa seadetes ained ja tunniplaan, siis näed siin, kui palju varu sul igas aines on.</Empty>
      </Card>
    );

  const name = (id: string) => setup.subjects.find((s) => s.id === id)?.name ?? id;
  const graded = rows.filter((r) => !r.subject.advisory);
  const over = graded.filter((r) => r.left < 0);
  const edge = graded.filter((r) => r.left === 0);
  const mh = setup.rule.automatic ? "MH" : "üle piiri";

  // The next school day that has no entry yet: a day already planned is decided.
  const next = nextSchoolDay(setup, now, loggedDates);
  const v = next ? dayVerdict(setup, rows, next) : null;
  const dayWord = next ? (next === addDays(now, 1) ? "Homme" : cap(WD_ON[weekdayOf(next)])) : "";
  const today = missableOn(setup, now);
  const todayLessons = today.reduce((s, b) => s + b.count, 0);
  const todayV = todayLessons && !loggedDates.has(now) ? dayVerdict(setup, rows, now) : null;

  const groups: { id: string; title: string; rows: SubjectRow[] }[] = [
    { id: "edge", title: "Piiril", rows: graded.filter((r) => r.left <= 0) },
    { id: "warn", title: "Jälgi", rows: graded.filter((r) => r.status === "warn") },
    { id: "calm", title: "Rahulik", rows: graded.filter((r) => r.status === "ok") },
    { id: "soft", title: "Vähem tähtis", rows: rows.filter((r) => r.subject.advisory) },
  ].filter((g) => g.rows.length);
  const calmCollapsible = graded.some((r) => r.left <= 2) && graded.filter((r) => r.status === "ok").length > 3;

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-4">
        {v ? (
          <div className="flex flex-col gap-1.5">
            <h2 className={`m-0 font-bold text-[clamp(28px,7.5vw,38px)] leading-[1.05] tracking-[-0.025em] ${v.blockers.length ? "text-bad" : ""}`}>
              {dayWord} {v.blockers.length ? "parem mitte." : "võid puududa."}
            </h2>
            <p className="m-0 text-[15px] text-muted num">
              {fmtDate(next!)} · {tunde(v.lessons)}.{" "}
              {v.blockers.length ? (
                <span className="text-ink">Läheks üle piiri: {joinEt(v.blockers.map(name))}.</span>
              ) : v.tightest ? (
                v.tightest.leftAfter === 0 ? (
                  `Pärast seda on ${name(v.tightest.subjectId)} piiril.`
                ) : (
                  `Pärast seda jääb kõige vähem varu: ${name(v.tightest.subjectId)}, ${tunde(v.tightest.leftAfter)}.`
                )
              ) : null}
            </p>
          </div>
        ) : (
          <h2 className="m-0 font-bold text-[clamp(26px,7vw,34px)] leading-[1.05] tracking-[-0.025em]">Selle poolaasta koolipäevad on läbi.</h2>
        )}

        {over.length > 0 && (
          <div className="rounded-xl px-3 py-2.5 bg-bad text-bad-ink text-[15px] flex flex-col gap-1">
            <b>Üle piiri: {joinEt(over.map((r) => r.subject.name))}.</b>
            <span>{setup.rule.consequence} Räägi aineõpetajaga, kuidas puudujääki tasa teha.</span>
          </div>
        )}

        {edge.length > 0 && (
          <div className="rounded-xl px-3 py-2.5 bg-bad-soft flex flex-col gap-1.5">
            <div className="text-[15px]">
              <b className="text-bad">{joinEt(edge.map((r) => r.subject.name))}:</b> järgmine puudutud tund = {mh}.
            </div>
            <ul className="m-0 p-0 list-none flex flex-col gap-0.5 text-sm text-muted num">
              {edge.map((r) => {
                const d = nextLesson(setup, r.subject.id, now);
                return (
                  <li key={r.subject.id}>
                    {r.subject.name}: {d ? `järgmine tund ${fmtDate(d)}` : "selles poolaastas rohkem tunde pole"}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div>
          <div className="text-[13px] text-muted mb-1.5">
            Terveid päevi võid veel vahele jätta{seg?.assumed ? " (kui tunniplaan jääb samaks)" : ""}
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {([1, 2, 3, 4, 5] as Weekday[]).map((d) => {
              const c = capacity[d];
              const tone = c === null ? "border border-dashed border-line" : c === 0 ? "bg-bad-soft" : c === 1 ? "bg-warn-soft" : "bg-ok-soft";
              const ink = c === null ? "text-muted" : c === 0 ? "text-bad" : c === 1 ? "text-warn" : "text-ok";
              return (
                <div key={d} className={`rounded-xl py-2 text-center flex flex-col gap-0.5 ${tone}`}>
                  <b className={`num font-display leading-none ${c === null ? "text-[13px] leading-[26px]" : "text-[26px]"} ${ink}`}>
                    {c === null ? (seg?.timetable[d]?.some((b) => b.selfStudy) ? "iseõpe" : "vaba") : c}
                  </b>
                  <span className="text-xs text-muted">{WD_SHORT[d]}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {todayV && (
            <Button variant={todayV.blockers.length ? "danger" : "primary"} className="flex-1 min-w-[9rem]" onClick={onSkipToday}>
              Täna puudun
            </Button>
          )}
          <Button variant="ghost" className="flex-1 min-w-[9rem]" onClick={onLog}>
            Vali muu päev
          </Button>
        </div>
        {todayV && todayV.blockers.length > 0 && (
          <div className="text-sm text-bad -mt-2">Täna puududes läheks üle piiri: {joinEt(todayV.blockers.map(name))}.</div>
        )}

        <div className="text-[13px] text-muted num border-t border-line pt-3">
          {setup.windowName}: {schoolDaysLeft} koolipäeva veel · {limitPhrase(setup.rule)}
        </div>
      </Card>

      <Card className="gap-0">
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <h2 className="text-xl font-bold m-0">Ained</h2>
          <span className="text-xs text-muted text-right">% kogu poolaasta tundidest · joon = piir</span>
        </div>
        {groups.map((g) => {
          const collapsed = g.id === "calm" && calmCollapsible && !showCalm;
          return (
            <div key={g.id} className="flex flex-col">
              <h3 className="m-0 mt-4 mb-1 text-[13px] font-bold text-muted tracking-normal flex items-center gap-2">
                {g.title}
                <span className="num font-body font-normal">{g.rows.length}</span>
              </h3>
              {collapsed ? (
                <Button variant="quiet" className="self-start -ml-2 text-sm" onClick={() => setShowCalm(true)} aria-expanded={false}>
                  Näita {g.rows.length} rahulikku ainet
                </Button>
              ) : (
                g.rows.map((r, i) => <Row key={r.subject.id} r={r} first={i === 0} setup={setup} segId={seg?.id} limitPct={limitPct} />)
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}

function Row({ r, first, setup, segId, limitPct }: { r: SubjectRow; first: boolean; setup: Setup; segId?: string; limitPct: number }) {
  let hint = r.subject.note ?? "";
  const sizes = blockSizes(setup, segId, r.subject.id);
  if (r.left > 0 && sizes.length && Math.min(...sizes) > r.left) hint = `${hint} Kõik tunnid on paaristunnid, ühtegi tervet tundi enam vahele jätta ei saa.`.trim();
  else if (r.left > 1 && r.left <= 5 && sizes.length === 1 && sizes[0] === 2) hint = `${hint} See on ${Math.floor(r.left / 2)} paaristundi.`.trim();
  return (
    <div className={`grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 py-3 ${first ? "" : "border-t border-line"} ${r.subject.advisory ? "opacity-80" : ""}`}>
      <div className="min-w-0">
        <div className="font-bold">{r.subject.name}</div>
        <div className="num text-sm text-muted">
          {r.absent} / {r.total} puudutud · {pct(r.pct)}
          {r.planned > 0 && ` · ${r.planned} plaanis`}
        </div>
      </div>
      <Pill status={r.status}>{leftLabel(r.left)}</Pill>
      <div className="col-span-2">
        <Meter
          pct={r.pct}
          planPct={r.total ? r.planned / r.total : 0}
          limitPct={limitPct}
          status={r.status}
          label={`${r.subject.name}: ${pct(r.pct)} puudutud, piir ${fmtLimit(setup.rule.limit)}`}
        />
      </div>
      {hint && <div className="col-span-2 text-[13px] text-muted">{hint}</div>}
    </div>
  );
}
