import { dayCapacity, fractionToPct, planningSegment } from "../core/calc";
import { eachDay } from "../core/dates";
import type { Setup, SubjectRow, Weekday } from "../core/types";
import { Card, Empty, Meter, Pill, WD_SHORT, fmtLimit, pct, ruleLabel, tunde } from "./kit";

function blockSizes(setup: Setup, segId: string | undefined, subjectId: string) {
  const seg = setup.segments.find((s) => s.id === segId);
  const sizes = new Set<number>();
  for (const day of Object.values(seg?.timetable ?? {})) for (const b of day) if (b.subjectId === subjectId && !b.selfStudy) sizes.add(b.count);
  return [...sizes];
}

export function Overview({ setup, rows, now, onLog }: { setup: Setup; rows: SubjectRow[]; now: string; onLog: () => void }) {
  const seg = planningSegment(setup, now);
  const cap = dayCapacity(setup, rows, seg);
  const limitPct = fractionToPct(setup.rule.limit) / 100;
  const schoolDaysLeft = now > setup.windowEnd ? 0 : eachDay(now > setup.windowStart ? now : setup.windowStart, setup.windowEnd).filter((d) => {
    const w = new Date(d + "T12:00").getDay();
    return w >= 1 && w <= 5 && !setup.holidays.includes(d);
  }).length;

  if (!rows.length)
    return (
      <Card>
        <Empty title="Aineid pole veel">Lisa seadetes ained ja tunniplaan, siis näed siin, kui palju varu sul igas aines on.</Empty>
      </Card>
    );

  const t = rows[0];
  const over = rows.filter((r) => r.left < 0);

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] text-muted">Kõige kitsam koht</div>
            <div className="font-display font-bold text-[clamp(28px,7vw,36px)] leading-[1.05] tracking-tight break-words">{t.subject.name}</div>
          </div>
          <Pill status={t.status}>{t.left < 0 ? "üle piiri" : `${tunde(t.left)} varu`}</Pill>
        </div>
        <div className="num text-[15px] text-muted -mt-2">
          {t.absent} / {t.total} tundi puudutud · {pct(t.pct)} · piir {fmtLimit(setup.rule.limit)}
        </div>
        {over.length > 0 && (
          <div className="text-sm rounded-xl px-3 py-2.5 bg-bad-soft">
            <b className="text-bad">Üle piiri:</b> {over.map((r) => r.subject.name).join(", ")}. {setup.rule.consequence}
          </div>
        )}
        <div>
          <div className="text-[13px] text-muted mb-1.5">
            Terveid päevi võid veel vahele jätta{seg?.assumed ? " (eeldusel, et tunniplaan jääb samaks)" : ""}
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {([1, 2, 3, 4, 5] as Weekday[]).map((d) => {
              const v = cap[d];
              const tone = v === null ? "border border-dashed border-line" : v === 0 ? "bg-bad-soft" : v === 1 ? "bg-warn-soft" : "bg-ok-soft";
              const ink = v === null ? "text-muted" : v === 0 ? "text-bad" : v === 1 ? "text-warn" : "text-ok";
              return (
                <div key={d} className={`rounded-xl py-2 text-center flex flex-col gap-0.5 ${tone}`}>
                  <b className={`num font-display leading-none ${v === null ? "text-[13px] leading-[26px]" : "text-[26px]"} ${ink}`}>{v === null ? "iseõpe" : v}</b>
                  <span className="text-xs text-muted">{WD_SHORT[d]}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[13px] text-muted num">
            {setup.windowName}: {schoolDaysLeft} koolipäeva veel · {ruleLabel(setup.rule)} {setup.rule.automatic ? "· automaatne" : "· õpetaja otsus"}
          </div>
          <button type="button" onClick={onLog} className="text-accent font-bold text-sm min-h-11 px-1 cursor-pointer">
            Kontrolli enne puudumist →
          </button>
        </div>
      </Card>

      <Card className="gap-0">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-xl font-bold m-0">Ained</h2>
          <span className="text-xs text-muted">punane joon = piir</span>
        </div>
        {rows.map((r, i) => {
          let hint = r.subject.note ?? "";
          const sizes = blockSizes(setup, seg?.id, r.subject.id);
          if (r.left > 0 && sizes.length && Math.min(...sizes) > r.left) hint = `${hint} Kõik tunnid on paaristunnid, ühtegi tervet tundi enam vahele jätta ei saa.`.trim();
          else if (r.left > 1 && r.left <= 5 && sizes.length === 1 && sizes[0] === 2) hint = `${hint} See on ${Math.floor(r.left / 2)} paaristundi.`.trim();
          return (
            <div key={r.subject.id} className={`grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 py-3 ${i ? "border-t border-line" : "pt-0"}`}>
              <div className="min-w-0">
                <div className="font-bold">{r.subject.name}</div>
                <div className="num text-sm text-muted">
                  {r.absent} / {r.total} · {pct(r.pct)} · max {r.max}
                </div>
              </div>
              <Pill status={r.status}>{r.left < 0 ? `${-r.left} üle` : `${r.left} varu`}</Pill>
              <div className="col-span-2">
                <Meter pct={r.pct} limitPct={limitPct} status={r.status} label={`${r.subject.name}: ${pct(r.pct)}, piir ${fmtLimit(setup.rule.limit)}`} />
              </div>
              {hint && <div className="col-span-2 text-[13px] text-muted">{hint}</div>}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
