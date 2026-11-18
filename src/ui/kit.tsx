import type { ButtonHTMLAttributes, ReactNode } from "react";
import { fractionToPct } from "../core/calc";
import type { Fraction, Rule, Status } from "../core/types";

export const WD_SHORT = ["P", "E", "T", "K", "N", "R", "L"];
export const WD_LONG = ["pühapäev", "esmaspäev", "teisipäev", "kolmapäev", "neljapäev", "reede", "laupäev"];
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
export function ruleLabel(r: Rule) {
  return `${r.mode === "gte" ? "Alla" : "Kuni"} ${fmtLimit(r.limit)}`;
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
  bad: "bg-bad-soft text-bad",
};
export function Pill({ status, children }: { status: Status; children: ReactNode }) {
  return <span className={`num text-sm font-bold px-2.5 py-1 rounded-full whitespace-nowrap self-start ${PILL[status]}`}>{children}</span>;
}

const BAR: Record<Status, string> = { ok: "bg-accent", warn: "bg-warn", bad: "bg-bad" };
/** Scale so the limit line sits at 62.5% of the track, leaving room to show "over". */
export function Meter({ pct: p, limitPct, status, label }: { pct: number; limitPct: number; status: Status; label: string }) {
  const scale = limitPct * 1.6;
  const w = Math.min(p / scale, 1) * 100;
  return (
    <div className="relative h-2 rounded-full bg-surface-2 mt-1" role="img" aria-label={label}>
      <i className={`anim absolute inset-y-0 left-0 rounded-full ${BAR[status]}`} style={{ width: `${w}%` }} />
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
