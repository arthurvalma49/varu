import { useState } from "react";
import { appendLesson, cycleLesson, removeLesson, WEEKDAYS } from "../core/setup";
import type { Lesson, Timetable, Weekday } from "../core/types";
import { Icon, Segmented, WD_LONG, WD_SHORT, cap } from "./kit";

/**
 * Build a week by tapping subjects in lesson order. Tapping the same subject twice in a row
 * makes a paaristund; tapping a block's size cycles ×1, ×2, iseõpe.
 */
export function WeekEditor({
  subjects,
  timetable,
  onChange,
}: {
  subjects: { id: string; name: string }[];
  timetable: Timetable;
  onChange: (t: Timetable) => void;
}) {
  const [day, setDay] = useState<Weekday>(1);
  const name = (id: string) => subjects.find((s) => s.id === id)?.name ?? id;
  const lessons = timetable[day] ?? [];
  const set = (d: Lesson[]) => onChange({ ...timetable, [day]: d });

  return (
    <div className="flex flex-col gap-3">
      <Segmented<string>
        label="Nädalapäev"
        value={String(day)}
        onChange={(v) => setDay(Number(v) as Weekday)}
        options={WEEKDAYS.map((d) => {
          const n = (timetable[d] ?? []).reduce((x, l) => x + l.count, 0);
          return {
            value: String(d),
            label: (
              <span className="flex flex-col leading-tight py-0.5">
                <span>{WD_SHORT[d]}</span>
                <span className="num text-[11px] font-normal text-muted">{n || "·"}</span>
              </span>
            ),
          };
        })}
      />

      <div className="rounded-[20px] bg-surface-2/60 overflow-hidden" aria-label={`${cap(WD_LONG[day])}: tunnid`}>
        {lessons.length === 0 ? (
          <div className="px-4 py-4 text-[15px] text-muted">
            {cap(WD_LONG[day])}: puuduta all aineid samas järjekorras nagu tunniplaanis. Kaks korda järjest on paaristund.
          </div>
        ) : (
          lessons.map((l, i) => (
            <div key={i} className="cell flex items-center gap-2 pl-4 pr-1.5 min-h-[50px]" style={{ ["--sep-inset" as string]: "16px" }}>
              <span className="num text-[15px] text-muted w-9 shrink-0">{l.slot}.</span>
              <span className={`flex-1 min-w-0 truncate ${l.selfStudy ? "text-muted" : ""}`}>{name(l.subjectId)}</span>
              <button
                type="button"
                onClick={() => set(cycleLesson(lessons, i))}
                aria-label={`${name(l.subjectId)}: muuda pikkust (praegu ${l.selfStudy ? "iseõpe" : `${l.count} tundi`})`}
                className={`num min-h-8 min-w-14 px-3 rounded-full text-[13px] font-semibold cursor-pointer ${l.selfStudy ? "bg-surface text-muted" : "bg-accent-soft text-accent"}`}
              >
                {l.selfStudy ? "iseõpe" : `×${l.count}`}
              </button>
              <button
                type="button"
                onClick={() => set(removeLesson(lessons, i))}
                aria-label={`Eemalda ${name(l.subjectId)}`}
                className="size-10 grid place-items-center rounded-full text-muted active:bg-surface cursor-pointer"
              >
                <Icon name="x" size={18} />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {subjects.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => set(appendLesson(lessons, s.id))}
            className="min-h-10 pl-3 pr-4 rounded-full bg-surface-2 text-[15px] font-medium cursor-pointer active:scale-[.96] transition-transform duration-100 inline-flex items-center gap-1.5"
          >
            <span className="text-accent">
              <Icon name="plus" size={16} stroke={2.4} />
            </span>
            {s.name}
          </button>
        ))}
      </div>
      {lessons.some((l) => !l.selfStudy) && <div className="text-[13px] text-muted">Puuduta ×1 / ×2, et vahetada pikkust või märkida iseõpe. Iseõpe loeb kohalolekuna.</div>}
    </div>
  );
}
