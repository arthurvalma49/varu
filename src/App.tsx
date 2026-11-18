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
import { fmtDate, tunde } from "./ui/kit";

type Tab = "overview" | "log" | "history" | "settings";
const TITLES: Record<Tab, string> = { overview: "Varu", log: "Lisa puudumine", history: "Ajalugu", settings: "Seaded" };
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "Ülevaade", icon: "M4 19V9m6 10V5m6 14v-7m4 7H2" },
  { id: "log", label: "Lisa", icon: "M12 5v14M5 12h14" },
  { id: "history", label: "Ajalugu", icon: "M12 7v5l3 2M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9Z" },
  { id: "settings", label: "Seaded", icon: "M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4" },
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
    window.scrollTo({ top: 0 });
  };
  const lessonsIn = (a: Absence) => Object.values(a.lessons).reduce((s, n) => s + n, 0);
  const logged = (a: Absence) => {
    addAbsences([a]);
    go("overview");
    setToast({
      text: `${a.date > now ? "Plaanis" : "Kirjas"}: ${fmtDate(a.date)}, ${tunde(lessonsIn(a))}.`,
      undo: () => removeAbsence(a.id),
      key: Date.now(),
    });
  };
  const removed = (id: string) => {
    const a = data.absences.find((x) => x.id === id);
    removeAbsence(id);
    if (a) setToast({ text: `Kustutatud: ${fmtDate(a.date)}.`, undo: () => addAbsences([a]), key: Date.now() });
  };
  const skipToday = () => {
    if (!data.setup) return;
    const lessons: Record<string, number> = {};
    for (const b of missableOn(data.setup, now)) lessons[b.subjectId] = (lessons[b.subjectId] ?? 0) + b.count;
    logged({ id: newId(), date: now, lessons, createdAt: new Date().toISOString() });
  };

  const clearHash = () => history.replaceState(null, "", location.pathname + location.search);

  // Drop a broken #setup= hash so it doesn't linger.
  useEffect(() => {
    if (!incoming && location.hash.startsWith("#setup=")) clearHash();
  }, [incoming]);

  const loggedDates = useMemo(() => new Set(data.absences.map((a) => a.date)), [data.absences]);
  const rows = useMemo(() => (data.setup ? summary(data.setup, data.absences, now) : []), [data, now]);

  const header = data.setup && (
    <header className="px-1 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[13px] text-muted truncate">
          {data.setup.schoolName}
          {data.setup.className ? ` · ${data.setup.className}` : ""} · {data.setup.windowName}
        </div>
        <h1 className="text-[28px] font-bold leading-tight m-0">{TITLES[tab]}</h1>
      </div>
    </header>
  );

  return (
    <div className="min-h-dvh">
      <main className="max-w-[720px] mx-auto px-4 pt-5 pb-28 flex flex-col gap-4">
        {store.saveError && (
          <div className="rounded-xl px-3 py-2.5 bg-bad-soft text-sm">Ei saa selles brauseris salvestada (nt privaatne aken). Muudatused kaovad.</div>
        )}

        {!data.setup ? (
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
        ) : (
          <>
            {header}
            {incoming && (
              <div className="rounded-2xl border border-accent bg-accent-soft p-3 flex flex-col gap-2 fade-in">
                <div className="text-sm">
                  Avasid jagamislingi: <b>{incoming.schoolName} {incoming.className}</b>, {incoming.windowName}. Asendan sinu seadistuse? Puudumised jäävad alles.
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="min-h-11 px-4 rounded-xl bg-accent text-accent-ink font-bold cursor-pointer"
                    onClick={() => {
                      replaceAll({ ...data, setup: incoming });
                      setIncoming(null);
                      clearHash();
                    }}
                  >
                    Asenda
                  </button>
                  <button
                    type="button"
                    className="min-h-11 px-4 rounded-xl border border-line font-bold cursor-pointer"
                    onClick={() => {
                      setIncoming(null);
                      clearHash();
                    }}
                  >
                    Ei
                  </button>
                </div>
              </div>
            )}
            {tab === "overview" && fresh && <ShareCard setup={data.setup} onClose={() => setFresh(false)} />}
            {tab === "overview" && (
              <Overview
                setup={data.setup}
                rows={rows}
                now={now}
                loggedDates={loggedDates}
                onLog={() => go("log")}
                onSkipToday={skipToday}
              />
            )}
            {tab === "log" && <LogAbsence setup={data.setup} rows={rows} now={now} onSave={logged} />}
            {tab === "history" && <History setup={data.setup} absences={data.absences} now={now} onRemove={removed} onUpdate={updateAbsence} onImport={addAbsences} />}
            {tab === "settings" && <Settings store={store} />}
          </>
        )}
      </main>

      {toast && (
        <div
          key={toast.key}
          role="status"
          className="toast-in fixed z-20 inset-x-4 bottom-[calc(57px+env(safe-area-inset-bottom)+12px)] max-w-[688px] mx-auto rounded-2xl bg-ink text-bg pl-4 pr-1.5 py-1.5 flex items-center gap-3 shadow-[0_10px_30px_-10px_oklch(0_0_0/0.5)]"
        >
          <span className="flex-1 min-w-0 text-[15px] num">{toast.text}</span>
          {toast.undo && (
            <button
              type="button"
              className="min-h-11 px-3 rounded-xl font-bold text-[15px] cursor-pointer hover:bg-bg/10"
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

      {data.setup && (
        <nav className="fixed bottom-0 inset-x-0 bg-surface/90 backdrop-blur border-t border-line safe-bottom" aria-label="Põhimenüü">
          <div className="max-w-[720px] mx-auto grid grid-cols-4">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-current={tab === t.id ? "page" : undefined}
                onClick={() => go(t.id)}
                className={`relative flex flex-col items-center gap-0.5 pt-2 pb-2 min-h-14 cursor-pointer ${tab === t.id ? "text-accent" : "text-muted hover:text-ink"}`}
              >
                {tab === t.id && <span className="absolute top-0 inset-x-6 h-[3px] rounded-b-full bg-accent" aria-hidden />}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={t.icon} />
                </svg>
                <span className={`text-xs ${tab === t.id ? "font-bold" : ""}`}>{t.label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
