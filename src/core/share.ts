import { isValidISO } from "./dates";
import type { AppData, Setup } from "./types";

/** Share a class setup (no absences) as a URL-safe string, for classmates. */
export function encodeSetup(setup: Setup): string {
  const json = JSON.stringify(setup);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeSetup(code: string): Setup | null {
  try {
    const b64 = code.trim().replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const obj = JSON.parse(new TextDecoder().decode(bytes));
    return validateSetup(obj) ? obj : null;
  } catch {
    return null;
  }
}

export function validateSetup(x: unknown): x is Setup {
  const s = x as Setup;
  return (
    !!s &&
    s.version === 1 &&
    typeof s.schoolName === "string" &&
    isValidISO(s.windowStart) &&
    isValidISO(s.windowEnd) &&
    !!s.rule?.limit &&
    s.rule.limit.den > 0 &&
    Array.isArray(s.subjects) &&
    Array.isArray(s.segments) &&
    Array.isArray(s.holidays) &&
    typeof s.baseline === "object"
  );
}

export function validateData(x: unknown): x is AppData {
  const d = x as AppData;
  return !!d && Array.isArray(d.absences) && (d.setup === null || validateSetup(d.setup));
}
