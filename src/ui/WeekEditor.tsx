import { useState } from "react";
import { appendLesson, cycleLesson, removeLesson, WEEKDAYS } from "../core/setup";
import type { Lesson, Timetable, Weekday } from "../core/types";
import { Icon, WD_LONG, cap } from "./kit";

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
      <div className="grid grid-cols-5 gap-1" role="tablist" aria-label="Nädalapäev">
        {WEEKDAYS.map((d) => {
          const n = (timetable[d] ?? []).reduce((x, l) => x + l.count, 0);
          const on = day === d;
          return (
            <button
              key={d}
              role="tab"
              aria-selected={on}
              type="button"
              onClick={() => setDay(d)}
              className={`rounded-xl min-h-12 py-1.5 cursor-pointer text-sm font-bold flex flex-col items-center justify-center ${
                on ? "bg-accent text-accent-ink" : "bg-surface-2 hover:brightness-110"
              }`}
            >
              {cap(WD_LONG[d]).slice(0, 2)}
              <span className={`num text-xs font-normal ${on ? "" : "text-muted"}`}>{n ? `${n} t` : "tühi"}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-1.5" aria-label={`${cap(WD_LONG[day])}: tunnid`}>
        {lessons.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line px-3 py-3 text-sm text-muted">
            {cap(WD_LONG[day])}: puuduta all aineid samas järjekorras nagu tunniplaanis. Kaks korda järjest = paaristund.
          </div>
        ) : (
          lessons.map((l, i) => (
            <div key={i} className={`flex items-center gap-2 pl-3 pr-1 min-h-12 rounded-xl border ${l.selfStudy ? "border-dashed border-line" : "border-line bg-surface-2/60"}`}>
              <span className="num text-[13px] text-muted w-9 shrink-0">{l.slot}.</span>
              <span className={`flex-1 min-w-0 truncate ${l.selfStudy ? "text-muted" : ""}`}>{name(l.subjectId)}</span>
              <button
                type="button"
                onClick={() => set(cycleLesson(lessons, i))}
                aria-label={`${name(l.subjectId)}: muuda pikkust (praegu ${l.selfStudy ? "iseõpe" : `${l.count} tundi`})`}
                className="num min-h-10 min-w-16 px-2.5 rounded-lg border border-line text-[13px] font-bold cursor-pointer hover:bg-surface"
              >
                {l.selfStudy ? "iseõpe" : `×${l.count}`}
              </button>
              <button
                type="button"
                onClick={() => set(removeLesson(lessons, i))}
                aria-label={`Eemalda ${name(l.subjectId)}`}
                className="size-10 grid place-items-center rounded-lg text-muted hover:text-bad cursor-pointer"
              >
                <Icon name="x" size={18} />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {subjects.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => set(appendLesson(lessons, s.id))}
            className="min-h-11 px-3.5 rounded-full border border-line text-[15px] cursor-pointer hover:bg-surface-2 active:scale-[.97] transition-transform duration-100"
          >
            {s.name}
          </button>
        ))}
      </div>
      {lessons.some((l) => !l.selfStudy) && (
        <div className="text-[13px] text-muted -mt-1">Pikkus: puuduta ×1 / ×2 / iseõpe. Iseõpe loeb kohalolekuna, sealt puududa ei saa.</div>
      )}
    </div>
  );
}
