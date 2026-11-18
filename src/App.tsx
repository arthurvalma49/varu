import { useEffect, useMemo, useState } from "react";
import { missableOn, summary, withCancelled } from "./core/calc";
import { today } from "./core/dates";
import { decodeSetup } from "./core/share";
import type { Absence, Setup } from "./core/types";
import { newId, useAppData } from "./store";
import { History } from "./ui/History";
import { LogAbsence } from "./ui/LogAbsence";
import { Onboarding } from "./ui/Onboarding";
import { Overview } from "./ui/Overview";
import { Settings, leaveDemo } from "./ui/Settings";
import { ShareCard } from "./ui/ShareCard";
import { Button, Icon, LargeTitle, TAB_ICONS, cap, fmtDate, fmtLong, joinEt, tunde } from "./ui/kit";

type Tab = "overview" | "log" | "history" | "settings";
const TITLES: Record<Tab, string> = { overview: "Täna", log: "Lisa", history: "Ajalugu", settings: "Seaded" };
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "Täna", icon: TAB_ICONS.overview },
  { id: "log", label: "Lisa", icon: TAB_ICONS.log },
  { id: "history", label: "Ajalugu", icon: TAB_ICONS.history },
  { id: "settings", label: "Seaded", icon: TAB_ICONS.settings },
];

function readHashSetup(): Setup | null {
  const m = location.hash.match(/#setup=([\w-]+)/);
  return m ? decodeSetup(m[1]) : null;
}

export default function App() {
  const store = useAppData();
  const { data, setSetup, addAbsences, removeAbsence, updateAbsence, replaceAll } = store;
  const [fresh, setFresh] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [incoming, setIncoming] = useState<Setup | null>(readHashSetup);
  const [toast, setToast] = useState<{ text: string; undo?: () => void; key: number } | null>(null);
  const now = today();
  // Keep "Praegu / Järgmine" and the day roll-over current: re-render every 30 s and on return.
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((x) => x + 1);
    const t = setInterval(bump, 30000);
    const vis = () => document.visibilityState === "visible" && bump();
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);
  // iOS: the large title collapses into a compact bar once it scrolls away.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 48);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const go = (t: Tab) => {
    setTab(t);
    setToast(null);
    window.scrollTo({ top: 0 });
  };
  const name = (id: string) => data.setup?.subjects.find((s) => s.id === id)?.name ?? id;
  const lessonsIn = (a: Absence) => Object.values(a.lessons).reduce((s, n) => s + n, 0);
  const logged = (a: Absence) => {
    addAbsences([a]);
    go("overview");
    setToast({
      text: `${a.date > now ? "Plaanis" : "Kirjas"}: ${fmtDate(a.date)}, ${tunde(lessonsIn(a))}`,
      undo: () => removeAbsence(a.id),
      key: Date.now(),
    });
  };
  /** Several days at once (Lisa: Mitu päeva): one entry per day, one undo for all. */
  const loggedMany = (list: Absence[]) => {
    if (!list.length) return;
    addAbsences(list);
    go("overview");
    const n = list.reduce((s, a) => s + lessonsIn(a), 0);
    const plan = list[0].date > now;
    setToast({
      text: `${plan ? "Plaanis" : "Kirjas"}: ${list.length} päeva, ${tunde(n)}`,
      undo: () => list.forEach((a) => removeAbsence(a.id)),
      key: Date.now(),
    });
  };
  /** One lesson from the Täna list: merged into that day's entry so history stays one row per day. */
  const logLesson = (date: string, subjectId: string, count: number) => {
    const existing = data.absences.find((a) => a.date === date);
    const text = date > now ? `${name(subjectId)} plaanis, ${tunde(count)}` : date === now ? `${name(subjectId)} kirjas. Naudi vaba tundi.` : `${name(subjectId)} kirjas, ${tunde(count)}`;
    if (existing) {
      const prev = { ...existing.lessons };
      updateAbsence(existing.id, { ...prev, [subjectId]: (prev[subjectId] ?? 0) + count });
      setToast({ text, undo: () => updateAbsence(existing.id, prev), key: Date.now() });
    } else {
      const a: Absence = { id: newId(), date, lessons: { [subjectId]: count }, createdAt: new Date().toISOString() };
      addAbsences([a]);
      setToast({ text, undo: () => removeAbsence(a.id), key: Date.now() });
    }
  };
  /**
   * Cancelled lessons (k > 0 adds, k < 0 restores). They lower totals, so the toast says when that
   * also lowers how many absences a subject allows.
   */
  const changeCancelled = (date: string, changes: Record<string, number>, label: string) => {
    if (!data.setup) return;
    const prev = data.setup.cancelled;
    const next = { ...data.setup, cancelled: withCancelled(prev, date, changes) };
    const before = new Map(rows.map((r) => [r.subject.id, r.max]));
    const fewer = summary(next, data.absences, now)
      .filter((r) => (before.get(r.subject.id) ?? r.max) > r.max)
      .map((r) => r.subject.name);
    store.updateSetup((d) => void (d.cancelled = next.cancelled));
    setToast({
      text: fewer.length ? `${label} ${joinEt(fewer)}: lubatud puudumisi 1 võrra vähem.` : label,
      undo: () => store.updateSetup((d) => void (d.cancelled = prev ? structuredClone(prev) : undefined)),
      key: Date.now(),
    });
  };
  const removed = (id: string) => {
    const a = data.absences.find((x) => x.id === id);
    removeAbsence(id);
    if (a) setToast({ text: `Kustutatud: ${fmtDate(a.date)}`, undo: () => addAbsences([a]), key: Date.now() });
  };
  /** Whole day, or the rest of it when some lessons are already logged (merged into that day's entry). */
  const skipDay = (date: string) => {
    if (!data.setup) return;
    const existing = data.absences.find((a) => a.date === date);
    const rest: Record<string, number> = {};
    const loggedLeft = { ...(existing?.lessons ?? {}) };
    for (const b of missableOn(data.setup, date)) {
      const used = Math.min(loggedLeft[b.subjectId] ?? 0, b.count);
      if (used) loggedLeft[b.subjectId] -= used;
      if (b.count - used > 0) rest[b.subjectId] = (rest[b.subjectId] ?? 0) + b.count - used;
    }
    if (!Object.keys(rest).length) return;
    if (existing) {
      const prev = { ...existing.lessons };
      const merged = { ...prev };
      for (const [id, n] of Object.entries(rest)) merged[id] = (merged[id] ?? 0) + n;
      updateAbsence(existing.id, merged);
      const n = Object.values(rest).reduce((x, y) => x + y, 0);
      setToast({ text: `Ülejäänud ${tunde(n)} kirjas`, undo: () => updateAbsence(existing.id, prev), key: Date.now() });
    } else logged({ id: newId(), date, lessons: rest, createdAt: new Date().toISOString() });
  };

  const clearHash = () => history.replaceState(null, "", location.pathname + location.search);

  // Drop a broken #setup= hash so it doesn't linger.
  useEffect(() => {
    if (!incoming && location.hash.startsWith("#setup=")) clearHash();
  }, [incoming]);

  const rows = useMemo(() => (data.setup ? summary(data.setup, data.absences, now) : []), [data, now]);

  if (!data.setup)
    return (
      <div className="min-h-dvh">
        <main className="max-w-[640px] mx-auto px-4 pb-10 pt-[env(safe-area-inset-top)]">
          {store.saveError && <SaveError />}
          <Onboarding
            incoming={incoming}
            today={now}
            onDone={(s, absences, isFresh) => {
              setSetup(s);
              if (absences?.length) addAbsences(absences);
              setIncoming(null);
              clearHash();
              setFresh(!!isFresh);
              go("overview");
            }}
          />
        </main>
      </div>
    );

  const sub =
    tab === "overview"
      ? `${cap(fmtLong(now))}${data.setup.className ? ` · ${data.setup.className}` : ""}`
      : tab === "settings"
        ? undefined
        : `${data.setup.schoolName}${data.setup.className ? ` · ${data.setup.className}` : ""}`;

  return (
    <div className="min-h-dvh">
      {tab !== "settings" && (
        <div
          aria-hidden={!scrolled}
          className={`fixed inset-x-0 top-0 z-20 bg-bar backdrop-blur-xl shadow-[0_0.5px_0_var(--line)] pt-[env(safe-area-inset-top)] transition-opacity duration-200 motion-reduce:transition-none ${
            scrolled ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <div className="h-11 grid place-items-center font-semibold text-[17px]">{TITLES[tab]}</div>
        </div>
      )}
      <main className="max-w-[640px] mx-auto px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-32 flex flex-col gap-7">
        {store.saveError && <SaveError />}
        {data.demo && (
          <div className="flex items-center justify-between gap-3 rounded-full bg-warn-soft pl-4 pr-1.5 py-1.5 text-[15px] -mb-3">
            <span className="text-warn font-semibold">Testrežiim · näidisandmed</span>
            <Button variant="quiet" className="min-h-8 px-3 text-warn" onClick={() => leaveDemo(data, replaceAll)}>
              Välju
            </Button>
          </div>
        )}
        {tab !== "settings" && <div className="-mx-4 -mb-3"><LargeTitle title={TITLES[tab]} subtitle={sub} /></div>}
        {incoming && (
          <div className="rounded-[26px] bg-surface p-5 flex flex-col gap-3 fade-in">
            <div className="text-[15px]">
              Avasid jagamislingi: <b>{incoming.schoolName} {incoming.className}</b>, {incoming.windowName}. Asendan sinu seadistuse? Puudumised jäävad alles.
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  // A classmate's setup replaces yours, but your marked cancellations stay.
                  replaceAll({ ...data, setup: { ...incoming, cancelled: incoming.cancelled ?? data.setup!.cancelled } });
                  setIncoming(null);
                  clearHash();
                }}
              >
                Asenda
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setIncoming(null);
                  clearHash();
                }}
              >
                Ei
              </Button>
            </div>
          </div>
        )}
        {tab === "overview" && fresh && <ShareCard setup={data.setup} onClose={() => setFresh(false)} />}
        {tab === "overview" && (
          <Overview
            setup={data.setup}
            rows={rows}
            absences={data.absences}
            now={now}
            onLog={() => go("log")}
            onSkipDay={skipDay}
            onLogLesson={logLesson}
            onCancel={changeCancelled}
          />
        )}
        {tab === "log" && (
          <LogAbsence
            setup={data.setup}
            rows={rows}
            absences={data.absences}
            now={now}
            onSave={logged}
            onSaveMany={loggedMany}
            onCancel={(date, changes, label) => {
              changeCancelled(date, changes, label);
              setTab("overview");
              window.scrollTo({ top: 0 });
            }}
          />
        )}
        {tab === "history" && <History setup={data.setup} absences={data.absences} now={now} onRemove={removed} onUpdate={updateAbsence} onImport={addAbsences} />}
        {tab === "settings" && <Settings store={store} />}
      </main>

      {toast && (
        <div
          key={toast.key}
          role="status"
          className="toast-in fixed z-20 inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+82px)] max-w-[420px] mx-auto rounded-[24px] bg-[#1c1c1e]/95 dark:bg-[#2c2c2e]/95 backdrop-blur-xl text-white pl-2.5 pr-1.5 py-1.5 flex items-center gap-2.5 shadow-[0_8px_30px_rgb(0_0_0/0.25)]"
        >
          <span className="shrink-0 size-6 rounded-full bg-[#30d158] text-black grid place-items-center">
            <Icon name="check" size={14} stroke={3} />
          </span>
          <span className="flex-1 min-w-0 text-[15px] leading-snug num py-1.5">{toast.text}</span>
          {toast.undo && (
            <button
              type="button"
              className="min-h-10 px-4 rounded-full font-semibold text-[15px] text-[#0a84ff] cursor-pointer active:opacity-60"
              onClick={() => {
                toast.undo!();
                setToast(null);
              }}
            >
              Võta tagasi
            </button>
          )}
        </div>
      )}

      <nav className="fixed z-10 inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+10px)] px-5 pointer-events-none" aria-label="Põhimenüü">
        <div className="glass pointer-events-auto max-w-[420px] mx-auto rounded-full p-1 grid grid-cols-4 relative">
          <span
            aria-hidden
            className="absolute top-1 bottom-1 left-1 w-[calc((100%-8px)/4)] rounded-full bg-surface-2 transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
            style={{ transform: `translateX(${TABS.findIndex((t) => t.id === tab) * 100}%)` }}
          />
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-current={on ? "page" : undefined}
                onClick={() => go(t.id)}
                className={`relative flex flex-col items-center justify-center gap-[2px] min-h-[54px] rounded-full cursor-pointer transition-colors duration-200 ${
                  on ? "text-accent" : "text-ink"
                }`}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={on ? 2.3 : 1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={t.icon} />
                </svg>
                <span className={`text-[10px] leading-none ${on ? "font-semibold" : "font-medium"}`}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function SaveError() {
  return <div className="rounded-xl px-4 py-3 bg-bad-soft text-[15px] my-3">Ei saa selles brauseris salvestada (nt privaatne aken). Muudatused kaovad.</div>;
}
