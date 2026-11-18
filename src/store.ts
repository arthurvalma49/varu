import { useCallback, useEffect, useState } from "react";
import { validateData } from "./core/share";
import { migrateSetup } from "./core/templates";
import type { Absence, AppData, Setup } from "./core/types";

const KEY = "varu:v1";

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (validateData(d)) return d.setup ? { ...d, setup: migrateSetup(d.setup) } : d;
    }
  } catch {
    /* private mode or corrupted: start fresh */
  }
  return { setup: null, absences: [] };
}

export function useAppData() {
  const [data, setData] = useState<AppData>(load);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }, [data]);

  // Keep several open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setData(load());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setSetup = useCallback((setup: Setup | null) => setData((d) => ({ ...d, setup })), []);
  const updateSetup = useCallback(
    (fn: (s: Setup) => void) =>
      setData((d) => {
        if (!d.setup) return d;
        const s = structuredClone(d.setup);
        fn(s);
        return { ...d, setup: s };
      }),
    [],
  );
  const addAbsences = useCallback((a: Absence[]) => setData((d) => ({ ...d, absences: [...d.absences, ...a] })), []);
  const removeAbsence = useCallback(
    (id: string) => setData((d) => ({ ...d, absences: d.absences.filter((a) => a.id !== id) })),
    [],
  );
  const updateAbsence = useCallback(
    (id: string, lessons: Record<string, number>) =>
      setData((d) => {
        const clean = Object.fromEntries(Object.entries(lessons).filter(([, n]) => n > 0));
        return {
          ...d,
          absences: Object.keys(clean).length
            ? d.absences.map((a) => (a.id === id ? { ...a, lessons: clean } : a))
            : d.absences.filter((a) => a.id !== id),
        };
      }),
    [],
  );
  const replaceAll = useCallback((next: AppData) => setData(next), []);

  return { data, saveError, setSetup, updateSetup, addAbsences, removeAbsence, updateAbsence, replaceAll };
}

export type Store = ReturnType<typeof useAppData>;

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
