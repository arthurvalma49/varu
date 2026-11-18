import type { ButtonHTMLAttributes, ReactNode } from "react";
import { fractionToPct } from "../core/calc";
import type { Fraction, Rule, Status } from "../core/types";

export const WD_SHORT = ["P", "E", "T", "K", "N", "R", "L"];
export const WD_LONG = ["pühapäev", "esmaspäev", "teisipäev", "kolmapäev", "neljapäev", "reede", "laupäev"];
/** "on Monday" (adessive), for sentences like "Esmaspäeval võid puududa". */
export const WD_ON = ["pühapäeval", "esmaspäeval", "teisipäeval", "kolmapäeval", "neljapäeval", "reedel", "laupäeval"];
const MON = ["jaan", "veebr", "märts", "apr", "mai", "juuni", "juuli", "aug", "sept", "okt", "nov", "dets"];

export const tunde = (n: number) => (Math.abs(n) === 1 ? `${n} tund` : `${n} tundi`);
export const pct = (x: number) => (x * 100).toFixed(1).replace(".", ",") + "%";
export function fmtDate(ds: string, withYear = false) {
  const [y, m, d] = ds.split("-").map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  return `${WD_SHORT[wd]} ${d}. ${MON[m - 1]}${withYear ? " " + y : ""}`;
}
export function fmtLimit(f: Fraction) {
  if (f.den === 3 && f.num === 1) return "1/3";
  const p = fractionToPct(f);
  return (Number.isInteger(p) ? String(p) : p.toFixed(1).replace(".", ",")) + "%";
}
/** Plain wording of where the limit is: "25% või rohkem = MH". */
export function limitPhrase(r: Rule) {
  const where = r.mode === "gte" ? `${fmtLimit(r.limit)} või rohkem` : `üle ${fmtLimit(r.limit)}`;
  return `${where} = ${r.automatic ? "MH" : "õpetaja otsus"}`;
}
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** "Füüsika", "Füüsika ja Keemia", "Füüsika, Keemia ja Geograafia". */
export function joinEt(xs: string[]) {
  return xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ja ${xs[xs.length - 1]}`;
}

const ICONS = {
  left: "m15 18-6-6 6-6",
  right: "m9 18 6-6-6-6",
  x: "M18 6 6 18M6 6l12 12",
  plus: "M12 5v14M5 12h14",
} as const;
export function Icon({ name, size = 20 }: { name: keyof typeof ICONS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`bg-surface border border-line rounded-2xl p-4 flex flex-col gap-3 ${className}`}>{children}</section>;
}

export function Button({
  variant = "primary",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "quiet" }) {
  const v = {
    primary: "bg-accent text-accent-ink border-accent hover:brightness-110",
    ghost: "bg-transparent text-accent border-line hover:bg-accent-soft",
    danger: "bg-bad text-white border-bad hover:brightness-110",
    quiet: "bg-transparent text-muted border-transparent hover:text-ink hover:bg-surface-2",
  }[variant];
  return (
    <button
      type="button"
      className={`min-h-11 px-4 rounded-xl border font-bold text-[15px] cursor-pointer active:scale-[.98] transition-[transform,filter,background-color] duration-100 disabled:opacity-45 disabled:cursor-not-allowed ${v} ${className}`}
      {...rest}
    />
  );
}

const PILL: Record<Status, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  edge: "bg-bad-soft text-bad",
  over: "bg-bad text-bad-ink",
};
/** Display face for the numbers: Atkinson's slashed zero reads like "Ø" in "0 varu". */
export function Pill({ status, children }: { status: Status; children: ReactNode }) {
  return (
    <span className={`num font-display text-[15px] leading-none font-bold px-2.5 py-1.5 rounded-full whitespace-nowrap self-start ${PILL[status]}`}>{children}</span>
  );
}
/** Short label for how many lessons are left: "5 varu", "piiril", "2 üle". */
export const leftLabel = (left: number) => (left < 0 ? `${-left} üle` : left === 0 ? "piiril" : `${left} varu`);

const BAR: Record<Status, string> = { ok: "bg-ok", warn: "bg-warn", edge: "bg-bad", over: "bg-bad" };
/**
 * Missed share of the half-year's lessons. The limit line sits at 62.5% of the track so
 * "over" still has room; planned lessons show as a faded extension after the missed ones.
 */
export function Meter({ pct: p, planPct = 0, limitPct, status, label }: { pct: number; planPct?: number; limitPct: number; status: Status; label: string }) {
  const scale = limitPct * 1.6;
  const w = Math.min(p / scale, 1) * 100;
  const wp = Math.min((p + planPct) / scale, 1) * 100 - w;
  return (
    <div className="relative h-2 rounded-full bg-surface-2 mt-1" role="img" aria-label={label}>
      <i className={`anim absolute inset-y-0 left-0 rounded-full ${BAR[status]}`} style={{ width: `${w}%` }} />
      {wp > 0 && <i className={`anim absolute inset-y-0 rounded-full opacity-40 ${BAR[status]}`} style={{ left: `${w}%`, width: `${wp}%` }} />}
      <span className="absolute -top-1 -bottom-1 w-[3px] rounded bg-bad" style={{ left: "62.5%" }} />
    </div>
  );
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="text-sm text-muted">
      {children}
    </label>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="text-center py-6 px-2 flex flex-col gap-2 items-center">
      <div className="font-display font-bold text-lg">{title}</div>
      {children && <div className="text-muted text-sm max-w-[42ch]">{children}</div>}
    </div>
  );
}
