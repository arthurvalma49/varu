import { useState } from "react";
import { dayCapacity, dayClock, dayVerdict, fractionToPct, lessonTimes, lessonsOn, minutesOf, missableOn, nextLesson, nextSchoolDay, planningSegment, timetableOn } from "../core/calc";
import { addDays, eachDay, weekdayOf } from "../core/dates";
import type { Absence, Setup, SubjectRow, Weekday } from "../core/types";
import { Button, Card, Empty, Icon, Meter, Pill, Row, Section, WD_ON, WD_SHORT, cap, fmtDate, fmtLimit, joinEt, leftLabel, limitPhrase, pct, tunde } from "./kit";

/** Without bell times, the list switches from today to the next school day at this hour. */
const SCHOOL_DAY_OVER = 15;

export function Overview({
  setup,
  rows,
  absences,
  now,
  onLog,
  onSkipDay,
  onLogLesson,
  onCancel,
}: {
  setup: Setup;
  rows: SubjectRow[];
  absences: Absence[];
  now: string;
  onLog: () => void;
  onSkipDay: (date: string) => void;
  onLogLesson: (date: string, subjectId: string, count: number) => void;
  onCancel: (date: string, changes: Record<string, number>, label: string) => void;
}) {
  const [showCalm, setShowCalm] = useState(false);
  const [menu, setMenu] = useState<number | null>(null);

  if (!rows.length)
    return (
      <Card>
        <Empty title="Aineid pole veel">Lisa seadetes ained ja tunniplaan, siis näed siin, kui palju varu sul igas aines on.</Empty>
      </Card>
    );

  const name = (id: string) => setup.subjects.find((s) => s.id === id)?.name ?? id;
  const row = (id: string) => rows.find((r) => r.subject.id === id);
  const seg = planningSegment(setup, now);
  const capacity = dayCapacity(setup, rows, seg);
  const limitPct = fractionToPct(setup.rule.limit) / 100;
  const mh = setup.rule.automatic ? "MH" : "üle piiri";

  // Which day the lesson list is about.
  const todayHasLessons = missableOn(setup, now).length > 0;
  const clockNow = new Date();
  const nowMin = clockNow.getHours() * 60 + clockNow.getMinutes();
  const clock = dayClock(setup, now, nowMin);
  // With bell times the day rolls over after the last lesson ends; without them at a fixed hour.
  const todayOpen = clock ? !clock.over : clockNow.getHours() < SCHOOL_DAY_OVER;
  const focus = todayHasLessons && todayOpen ? now : nextSchoolDay(setup, now);
  const live = focus === now ? clock : null;
  const dayWord = !focus ? "" : focus === now ? "Täna" : focus === addDays(now, 1) ? "Homme" : cap(WD_ON[weekdayOf(focus)]);
  const focusBlocks = focus ? lessonsOn(setup, focus) : [];
  const focusEntry = focus ? absences.find((a) => a.date === focus) : undefined;
  // Verdict on what is still open that day: lessons already logged are spent.
  const open = focusBlocks.filter((b) => !b.selfStudy && !focusEntry?.lessons[b.subjectId]);
  const partial = !!focusEntry && open.length > 0;
  const v = !focus || (focusEntry && !open.length) ? null : partial ? restVerdict() : dayVerdict(setup, rows, focus);
  function restVerdict() {
    const blockers: string[] = [];
    let tightest: { subjectId: string; leftAfter: number } | null = null;
    const per: Record<string, number> = {};
    for (const b of open) per[b.subjectId] = (per[b.subjectId] ?? 0) + b.count;
    for (const [id, k] of Object.entries(per)) {
      const r = row(id);
      if (!r || r.subject.advisory) continue;
      const leftAfter = r.left - k;
      if (r.left >= 0 && leftAfter < 0) blockers.push(id);
      if (r.left >= 0 && leftAfter >= 0 && (!tightest || leftAfter < tightest.leftAfter)) tightest = { subjectId: id, leftAfter };
    }
    return { date: focus!, lessons: open.reduce((x, b) => x + b.count, 0), blockers, tightest };
  }

  const graded = rows.filter((r) => !r.subject.advisory);
  const over = graded.filter((r) => r.left < 0);
  const groups: { id: string; title: string; rows: SubjectRow[] }[] = [
    { id: "edge", title: "Piiril", rows: graded.filter((r) => r.left <= 0) },
    { id: "warn", title: "Jälgi", rows: graded.filter((r) => r.status === "warn") },
    { id: "calm", title: "Rahulik", rows: graded.filter((r) => r.status === "ok") },
    { id: "soft", title: "Vähem tähtis", rows: rows.filter((r) => r.subject.advisory) },
  ].filter((g) => g.rows.length);
  const calmCollapsible = graded.filter((r) => r.status === "ok").length > 5;

  const schoolDaysLeft =
    now > setup.windowEnd
      ? 0
      : eachDay(now > setup.windowStart ? now : setup.windowStart, setup.windowEnd).filter((d) => {
          const w = new Date(d + "T12:00").getDay();
          return w >= 1 && w <= 5 && !setup.holidays.includes(d);
        }).length;

  return (
    <div className="flex flex-col gap-7">
      {/* Verdict */}
      <Card className="gap-2">
        {focus && (
          <span
            aria-hidden
            className={`size-9 rounded-full grid place-items-center mb-1 ${!v ? "bg-surface-2 text-muted" : v.blockers.length ? "bg-bad-soft text-bad" : "bg-ok-soft text-ok"}`}
          >
            <Icon name={v && v.blockers.length ? "alert" : "check"} size={20} stroke={2.4} />
          </span>
        )}
        {!focus ? (
          <>
            <h2 className="m-0 text-[28px] leading-[34px] font-bold">Selle perioodi koolipäevad on läbi.</h2>
            <p className="m-0 text-[15px] text-muted">Uue perioodi jaoks muuda kuupäevad ja impordi uus tunniplaan seadetes.</p>
          </>
        ) : v ? (
          <>
            <h2 className={`m-0 text-[28px] leading-[34px] font-bold ${v.blockers.length ? "text-bad" : ""}`}>
              {partial
                ? v.blockers.length
                  ? "Ülejäänud tunde parem mitte."
                  : "Ülejäänud tunde võid ka puududa."
                : `${dayWord} ${v.blockers.length ? "parem mitte." : "võid puududa."}`}
            </h2>
            <p className="m-0 text-[15px] text-muted num">
              {v.blockers.length
                ? `${partial ? "Ülejäänud päev" : "Terve päev"} viiks üle piiri: ${joinEt(v.blockers.map(name))}.`
                : v.tightest
                  ? v.tightest.leftAfter === 0
                    ? `Pärast seda on ${name(v.tightest.subjectId)} piiril.`
                    : `${v.tightest.leftAfter >= 5 ? "Varu on küllaga. " : ""}Pärast seda jääb kõige vähem: ${name(v.tightest.subjectId)}, ${tunde(v.tightest.leftAfter)}.`
                  : "Selles päevas pole arvestatavaid tunde."}
            </p>
          </>
        ) : (
          <>
            <h2 className="m-0 text-[28px] leading-[34px] font-bold">{dayWord} on kirjas.</h2>
            <p className="m-0 text-[15px] text-muted">{focus === now ? "Kõik tänased tunnid on märgitud. Naudi päeva." : "Kõik selle päeva tunnid on märgitud."} Muuta saad ajaloos.</p>
          </>
        )}
        {over.length > 0 && (
          <div className="mt-2 rounded-[18px] bg-bad-soft px-4 py-3 flex gap-3 items-start">
            <span className="text-bad mt-0.5">
              <Icon name="alert" size={20} />
            </span>
            <div className="text-[15px]">
              <b className="text-bad">Üle piiri: {joinEt(over.map((r) => r.subject.name))}.</b> {setup.rule.consequence} Räägi aineõpetajaga, kuidas puudujääki tasa teha.
            </div>
          </div>
        )}
      </Card>

      {/* The focus day's lessons, one by one */}
      {focus && timetableOn(setup, focus).length > 0 && (
        <Section title={`${dayWord}, ${fmtDate(focus)}`} footer="Võid = selle tunni võid vahele jätta ja jääd piiri sisse. Paaristund võtab 2 tundi varu. Kolme punkti alt saad märkida, et tund jääb ära.">
          {(() => {
            // Show the timetable as planned, with cancelled lessons crossed out (they can be restored).
            const planned = timetableOn(setup, focus);
            const cancelledLeft = { ...(setup.cancelled?.[focus] ?? {}) };
            const shown = planned.map((b) => {
              const cut = b.selfStudy ? 0 : Math.min(cancelledLeft[b.subjectId] ?? 0, b.count);
              if (cut) cancelledLeft[b.subjectId] -= cut;
              return { b: cut && cut < b.count ? { ...b, count: b.count - cut } : b, cancelled: cut === b.count ? cut : 0 };
            });
            const times = shown.map((x) => lessonTimes(setup, x.b));
            const currentIdx = live ? shown.findIndex((x, i) => !x.cancelled && times[i] && minutesOf(times[i]!.start) <= nowMin && nowMin < minutesOf(times[i]!.end)) : -1;
            const nextIdx = live && currentIdx < 0 ? shown.findIndex((x, i) => !x.b.selfStudy && !x.cancelled && times[i] && minutesOf(times[i]!.start) > nowMin) : -1;
            const missable = shown.filter((x) => !x.b.selfStudy && !x.cancelled);
            return shown.map(({ b, cancelled }, i) => {
              const t = times[i];
              const past = !!live && !!t && minutesOf(t.end) <= nowMin;
              if (b.selfStudy)
                return (
                  <Row key={i} detail={<span className="text-[15px]">iseõpe</span>}>
                    <div className="flex items-center gap-3 text-muted">
                      <SlotLabel slot={b.slot} time={t?.start} past />
                      <span>{name(b.subjectId)}</span>
                    </div>
                  </Row>
                );
              if (cancelled)
                return (
                  <div key={i} className="cell flex items-center gap-3 px-5 min-h-[60px]">
                    <SlotLabel slot={b.slot} time={t?.start} past />
                    <div className="flex-1 min-w-0 py-2">
                      <div className="truncate text-muted line-through decoration-1">{name(b.subjectId)}</div>
                      <div className="text-[13px] text-muted">Jääb ära · ei loe puudumiseks</div>
                    </div>
                    <Button
                      variant="quiet"
                      className="shrink-0 min-h-9 px-3 text-[15px]"
                      onClick={() => onCancel(focus, { [b.subjectId]: -cancelled }, `${name(b.subjectId)} toimub siiski.`)}
                    >
                      Taasta
                    </Button>
                  </div>
                );
              const r = row(b.subjectId);
              const done = !!focusEntry?.lessons[b.subjectId];
              const after = r ? r.left - b.count : 0;
              const ok = !r || after >= 0;
              const nextIsMh = !!r && r.left >= 0 && after < 0;
              const highlight = i === currentIdx || i === nextIdx;
              return (
                <div key={i} className="cell">
                  <div className={`flex items-center gap-2 pl-5 pr-3 min-h-[60px] ${highlight ? "bg-accent-soft/60" : ""}`}>
                    <SlotLabel
                      slot={b.slot}
                      time={t?.start}
                      past={past}
                      tag={i === currentIdx ? "praegu" : i === nextIdx ? countdown(minutesOf(t!.start) - nowMin) : undefined}
                    />
                    <div className="flex-1 min-w-0 py-2 pl-1">
                      <div className="truncate">{name(b.subjectId)}</div>
                      <div className={`text-[13px] num truncate ${done ? "text-muted" : ok ? "text-ok" : "text-bad"}`}>
                        {done ? "Kirjas" : !r ? "Ei lähe arvesse" : ok ? (after === 0 ? "Võid · siis piiril" : `Võid · jääb ${after}`) : nextIsMh ? `Ei · see tund = ${mh}` : "Ei · juba üle piiri"}
                      </div>
                    </div>
                    {done ? (
                      <span className="text-ok shrink-0 fade-in px-2">
                        <Icon name="check" size={20} stroke={2.4} />
                      </span>
                    ) : (
                      <>
                        <Button
                          variant={ok ? "ghost" : "quiet"}
                          className={`shrink-0 min-h-9 px-3.5 text-[15px] ${ok ? "" : "text-bad"}`}
                          onClick={() => onLogLesson(focus, b.subjectId, b.count)}
                          aria-label={`Puudun: ${name(b.subjectId)} ${b.slot}`}
                        >
                          Puudun
                        </Button>
                        <button
                          type="button"
                          aria-label={`Muud valikud: ${name(b.subjectId)}`}
                          aria-expanded={menu === i}
                          onClick={() => setMenu(menu === i ? null : i)}
                          className="shrink-0 size-9 grid place-items-center rounded-full text-muted cursor-pointer active:bg-surface-2"
                        >
                          <Icon name="more" size={22} stroke={3} />
                        </button>
                      </>
                    )}
                  </div>
                  {menu === i && !done && (
                    <div className="flex flex-wrap gap-2 px-5 pb-3 pt-1 fade-in">
                      <Button
                        variant="ghost"
                        className="min-h-9 text-[15px]"
                        onClick={() => {
                          setMenu(null);
                          onCancel(focus, { [b.subjectId]: b.count }, `${name(b.subjectId)} jääb ära.`);
                        }}
                      >
                        Tund jääb ära
                      </Button>
                      <Button
                        variant="quiet"
                        className="min-h-9 text-[15px]"
                        onClick={() => {
                          setMenu(null);
                          const all: Record<string, number> = {};
                          for (const x of missable) all[x.b.subjectId] = (all[x.b.subjectId] ?? 0) + x.b.count;
                          onCancel(focus, all, `${dayWord} jääb ära.`);
                        }}
                      >
                        Terve päev jääb ära
                      </Button>
                    </div>
                  )}
                </div>
              );
            });
          })()}
          {open.length > 0 && (
            <Row onClick={() => onSkipDay(focus)}>
              <span className={v && v.blockers.length ? "text-bad" : "text-accent"}>{partial ? "Puudun ülejäänud tundidest" : "Puudun terve päeva"}</span>
            </Row>
          )}
        </Section>
      )}

      {/* Whole days per weekday */}
      {focus && (
      <Section title="Terveid päevi võid veel vahele jätta" footer={seg?.assumed ? "Eeldusel, et tunniplaan jääb samaks." : undefined}>
        <div className="grid grid-cols-5 gap-1.5 p-3">
          {([1, 2, 3, 4, 5] as Weekday[]).map((d) => {
            const c = capacity[d];
            const selfStudy = seg?.timetable[d]?.some((b) => b.selfStudy);
            const tone = c === null ? "border border-dashed border-line text-muted" : c === 0 ? "bg-bad-soft text-bad" : c === 1 ? "bg-warn-soft text-warn" : "bg-surface-2";
            return (
              <div
                key={d}
                className={`rounded-[16px] py-2.5 text-center flex flex-col gap-0.5 ${tone} ${weekdayOf(now) === d ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : ""}`}
              >
                {weekdayOf(now) === d && <span className="sr-only">Täna. </span>}
                <b className={`num leading-none ${c === null ? "text-[13px] leading-[26px] font-medium" : "text-[26px] font-semibold"}`}>
                  {c === null ? (selfStudy ? "iseõpe" : "vaba") : c}
                </b>
                <span className="text-[12px] text-muted">{WD_SHORT[d]}</span>
              </div>
            );
          })}
        </div>
      </Section>
      )}

      {/* Subjects */}
      {groups.map((g) => {
        const collapsed = g.id === "calm" && calmCollapsible && !showCalm;
        const list = collapsed ? g.rows.slice(0, 4) : g.rows;
        return (
          <Section key={g.id} title={g.id === "edge" ? <span className="text-bad">{g.title}</span> : g.title}>
            {list.map((r) => (
              <SubjectRowView key={r.subject.id} r={r} setup={setup} now={now} limitPct={limitPct} mh={mh} />
            ))}
            {collapsed && (
              <Row onClick={() => setShowCalm(true)}>
                <span className="text-accent">Näita kõiki {g.rows.length}</span>
              </Row>
            )}
          </Section>
        );
      })}

      <div className="px-5 -mt-3 flex flex-col gap-3 text-[13px] text-muted num">
        <span>
          {setup.windowName}: {schoolDaysLeft} koolipäeva veel · {limitPhrase(setup.rule)}. % on kogu perioodi tundidest, joon on piir.
        </span>
        <Button variant="ghost" onClick={onLog} className="self-start">
          Kontrolli muud päeva
        </Button>
      </div>
    </div>
  );
}

/** Start time when known, else the lesson number. A live tag replaces the lesson number line. */
function SlotLabel({ slot, time, past, tag }: { slot: string; time?: string; past?: boolean; tag?: string }) {
  return (
    <span className={`num shrink-0 w-14 leading-tight ${past ? "text-faint" : "text-muted"}`}>
      {time ? (
        <>
          <span className={`block text-[15px] ${tag ? "text-accent font-semibold" : ""}`}>{time}</span>
          {tag ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-accent">
              <span className="relative flex size-1.5 shrink-0" aria-hidden>
                <span className="pulse absolute inline-flex size-full rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-accent" />
              </span>
              {tag}
            </span>
          ) : (
            <span className="block text-[11px]">{slot}. tund</span>
          )}
        </>
      ) : (
        <span className="text-[15px]">{slot}.</span>
      )}
    </span>
  );
}

/** "järgmine", "5 min", "1 h 5 min": how soon the next lesson starts. */
function countdown(min: number) {
  if (min > 120 || min < 0) return "järgmine";
  return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`;
}

function blockSizes(setup: Setup, subjectId: string, now: string) {
  const seg = planningSegment(setup, now);
  const sizes = new Set<number>();
  for (const day of Object.values(seg?.timetable ?? {})) for (const b of day) if (b.subjectId === subjectId && !b.selfStudy) sizes.add(b.count);
  return [...sizes];
}

function SubjectRowView({ r, setup, now, limitPct, mh }: { r: SubjectRow; setup: Setup; now: string; limitPct: number; mh: string }) {
  let hint = r.subject.note ?? "";
  const atEdge = r.left === 0 && !r.subject.advisory;
  if (atEdge) {
    const d = nextLesson(setup, r.subject.id, now);
    hint = d ? `Järgmine tund ${fmtDate(d)} = ${mh}.` : "Selles perioodis rohkem tunde pole.";
  } else {
    const sizes = blockSizes(setup, r.subject.id, now);
    if (r.left > 0 && sizes.length && Math.min(...sizes) > r.left) hint = `${hint} Kõik tunnid on paaristunnid, tervet tundi enam vahele jätta ei saa.`.trim();
    else if (r.left > 1 && r.left <= 5 && sizes.length === 1 && sizes[0] === 2) hint = `${hint} See on ${Math.floor(r.left / 2)} paaristundi.`.trim();
  }
  return (
    <div className="cell px-5 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate">{r.subject.name}</span>
        <Pill status={r.status}>{leftLabel(r.left)}</Pill>
      </div>
      <div className="text-[13px] text-muted num mt-0.5">
        {r.absent}/{r.total} puudutud · {pct(r.pct)}
        {r.planned > 0 && ` · ${r.planned} plaanis`}
      </div>
      <Meter
        pct={r.pct}
        planPct={r.total ? r.planned / r.total : 0}
        limitPct={limitPct}
        status={r.status}
        label={`${r.subject.name}: ${pct(r.pct)} puudutud, piir ${fmtLimit(setup.rule.limit)}`}
      />
      {hint && <div className={`text-[13px] mt-1.5 ${atEdge ? "text-bad" : "text-muted"}`}>{hint}</div>}
    </div>
  );
}
