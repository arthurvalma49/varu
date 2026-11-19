import { fractionToPct, lessonTimes, nextLesson, planningSegment, timetableOn } from "../core/calc";
import { addDays } from "../core/dates";
import { isStartingAbsence } from "../core/setup";
import type { Absence, Setup, SubjectRow, Weekday } from "../core/types";
import { Card, Empty, Meter, NavBar, Row, Section, WD_LONG, cap, fmtDate, fmtLimit, leftLabel, limitPhrase, pct, tunde } from "./kit";

/** One subject, drilled into from Täna: where it stands, what is next, and its own history. */
export function SubjectDetail({
  setup,
  row,
  subjectId,
  absences,
  now,
  onBack,
}: {
  setup: Setup;
  row: SubjectRow | undefined;
  subjectId: string;
  absences: Absence[];
  now: string;
  onBack: () => void;
}) {
  const subject = setup.subjects.find((s) => s.id === subjectId);
  const name = subject?.name ?? subjectId;
  const limitPct = fractionToPct(setup.rule.limit) / 100;
  const next = nextLesson(setup, subjectId, now);
  const nextBlock = next ? timetableOn(setup, next).find((b) => b.subjectId === subjectId && !b.selfStudy) : undefined;
  const nextTime = nextBlock ? lessonTimes(setup, nextBlock) : null;
  const history = absences
    .filter((a) => a.lessons[subjectId])
    .sort((a, b) => b.date.localeCompare(a.date));
  const seg = planningSegment(setup, now);
  const week = ([1, 2, 3, 4, 5] as Weekday[])
    .map((d) => ({ d, blocks: (seg?.timetable[d] ?? []).filter((b) => b.subjectId === subjectId) }))
    .filter((x) => x.blocks.length);
  const tone = !row ? "text-ink" : row.status === "ok" ? "text-ok" : row.status === "warn" ? "text-warn" : "text-bad";

  return (
    <div className="flex flex-col gap-7 -mt-3 push-in">
      <NavBar title={name} onBack={onBack} backLabel="Täna" />

      <Card className="gap-1">
        <div className="text-[15px] text-muted">{name}</div>
        {row ? (
          <>
            <div className={`num font-bold text-[56px] leading-none tracking-[-0.02em] ${tone}`}>{row.left < 0 ? `+${-row.left}` : row.left}</div>
            <div className="text-[17px] font-semibold">{row.left < 0 ? "tundi üle piiri" : row.left === 0 ? "piiril: järgmine puudumine ületab piiri" : row.left === 1 ? "tund varu" : "tundi varu"}</div>
            <Meter pct={row.pct} planPct={row.total ? row.planned / row.total : 0} limitPct={limitPct} status={row.status} label={`${name}: ${pct(row.pct)} puudutud, piir ${fmtLimit(setup.rule.limit)}`} />
            <div className="text-[13px] text-muted mt-1">{limitPhrase(setup.rule)}</div>
          </>
        ) : (
          <div className="text-[17px] text-muted">Ei lähe arvestusse.</div>
        )}
      </Card>

      {row && (
        <Section title="Arvud">
          <Row detail={<span className="num">{row.total}</span>}>Tunde perioodis kokku</Row>
          <Row detail={<span className="num">{row.absent} · {pct(row.pct)}</span>}>Puudutud</Row>
          {row.planned > 0 && <Row detail={<span className="num">{row.planned}</span>}>Plaanis</Row>}
          <Row detail={<span className="num">{row.max}</span>}>Lubatud puudumisi</Row>
          <Row detail={<span className={`num font-semibold ${tone}`}>{leftLabel(row.left)}</span>}>Alles</Row>
        </Section>
      )}

      {next && (
        <Section title="Järgmine tund" footer={subject?.note}>
          <Row detail={<span className="num">{nextTime ? `${nextTime.start}–${nextTime.end}` : nextBlock ? `${nextBlock.slot}. tund` : ""}</span>}>
            <span className="num">{next === addDays(now, 1) ? "Homme" : cap(fmtDate(next))}</span>
          </Row>
        </Section>
      )}

      {week.length > 0 && (
        <Section title="Igal nädalal">
          {week.map(({ d, blocks }) => (
            <Row key={d} detail={<span className="num">{blocks.map((b) => (b.selfStudy ? "iseõpe" : tunde(b.count))).join(", ")}</span>}>
              {cap(WD_LONG[d])}
            </Row>
          ))}
        </Section>
      )}

      <Section title="Puudumised">
        {history.length ? (
          history.map((a) => (
            <Row key={a.id} detail={<span className="num">{tunde(a.lessons[subjectId])}</span>}>
              <span className="num">{isStartingAbsence(a) ? "Enne äppi" : fmtDate(a.date, true)}</span>
              {a.date > now && <span className="ml-2 text-[12px] font-semibold text-accent bg-accent-soft rounded-full px-2 py-0.5">Plaan</span>}
              {a.note && <div className="text-[13px] text-muted truncate">{a.note}</div>}
            </Row>
          ))
        ) : (
          <Empty title="Puudumisi pole" icon="check">
            Selles aines pole sel perioodil ühtegi puudumist.
          </Empty>
        )}
      </Section>
    </div>
  );
}
