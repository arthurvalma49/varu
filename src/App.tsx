import { useEffect, useMemo, useState } from "react";
import { missableOn, summary } from "./core/calc";
import { today } from "./core/dates";
import { decodeSetup } from "./core/share";
import type { Absence, Setup } from "./core/types";
import { newId, useAppData } from "./store";
import { History } from "./ui/History";
import { LogAbsence } from "./ui/LogAbsence";
import { Onboarding } from "./ui/Onboarding";
import { Overview } from "./ui/Overview";
import { Settings } from "./ui/Settings";
import { ShareCard } from "./ui/ShareCard";
import { Button, LargeTitle, cap, fmtDate, fmtLong, tunde } from "./ui/kit";

type Tab = "overview" | "log" | "history" | "settings";
const TITLES: Record<Tab, string> = { overview: "Täna", log: "Lisa puudumine", history: "Ajalugu", settings: "Seaded" };
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "Täna", icon: "M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm3 8h2m4 0h2m-8 4h2" },
  { id: "log", label: "Lisa", icon: "M12 8v8M8 12h8M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" },
  { id: "history", label: "Ajalugu", icon: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" },
  { id: "settings", label: "Seaded", icon: "M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4" },
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
  /** One lesson from the Täna list: merged into that day's entry so history stays one row per day. */
  const logLesson = (date: string, subjectId: string, count: number) => {
    const existing = data.absences.find((a) => a.date === date);
    const text = `${name(subjectId)} ${date > now ? "plaanis" : "kirjas"}, ${tunde(count)}`;
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
    for (const b of missableOn(data.setup, date)) if (!existing?.lessons[b.subjectId]) rest[b.subjectId] = (rest[b.subjectId] ?? 0) + b.count;
    if (!Object.keys(rest).length) return;
    if (existing) {
      const prev = { ...existing.lessons };
      updateAbsence(existing.id, { ...prev, ...rest });
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
      <main className="max-w-[640px] mx-auto px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-32 flex flex-col gap-7">
        {store.saveError && <SaveError />}
        {tab !== "settings" && <div className="-mx-4 -mb-3"><LargeTitle title={TITLES[tab]} subtitle={sub} /></div>}
        {incoming && (
          <div className="rounded-[26px] bg-surface p-5 flex flex-col gap-3 fade-in">
            <div className="text-[15px]">
              Avasid jagamislingi: <b>{incoming.schoolName} {incoming.className}</b>, {incoming.windowName}. Asendan sinu seadistuse? Puudumised jäävad alles.
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  replaceAll({ ...data, setup: incoming });
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
          />
        )}
        {tab === "log" && <LogAbsence setup={data.setup} rows={rows} now={now} onSave={logged} />}
        {tab === "history" && <History setup={data.setup} absences={data.absences} now={now} onRemove={removed} onUpdate={updateAbsence} onImport={addAbsences} />}
        {tab === "settings" && <Settings store={store} />}
      </main>

      {toast && (
        <div
          key={toast.key}
          role="status"
          className="toast-in fixed z-20 inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+82px)] max-w-[420px] mx-auto rounded-full bg-[#1c1c1e]/95 dark:bg-[#2c2c2e]/95 backdrop-blur-xl text-white pl-5 pr-1.5 py-1.5 flex items-center gap-3 shadow-[0_8px_30px_rgb(0_0_0/0.25)]"
        >
          <span className="flex-1 min-w-0 text-[15px] num truncate">{toast.text}</span>
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
        <div className="glass pointer-events-auto max-w-[420px] mx-auto rounded-full p-1 grid grid-cols-4">
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-current={on ? "page" : undefined}
                onClick={() => go(t.id)}
                className={`flex flex-col items-center justify-center gap-[2px] min-h-[54px] rounded-full cursor-pointer transition-colors duration-200 ${
                  on ? "bg-surface-2 text-accent" : "text-ink"
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
