import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { fractionToPct } from "../core/calc";
import type { Fraction, Rule, Status } from "../core/types";

/* ---------- Estonian formatting ---------- */

export const WD_SHORT = ["P", "E", "T", "K", "N", "R", "L"];
export const WD_LONG = ["pühapäev", "esmaspäev", "teisipäev", "kolmapäev", "neljapäev", "reede", "laupäev"];
/** "on Monday" (adessive), for sentences like "Esmaspäeval võid puududa". */
export const WD_ON = ["pühapäeval", "esmaspäeval", "teisipäeval", "kolmapäeval", "neljapäeval", "reedel", "laupäeval"];
const MON = ["jaan", "veebr", "märts", "apr", "mai", "juuni", "juuli", "aug", "sept", "okt", "nov", "dets"];
export const MON_LONG = ["jaanuar", "veebruar", "märts", "aprill", "mai", "juuni", "juuli", "august", "september", "oktoober", "november", "detsember"];

export const tunde = (n: number) => (Math.abs(n) === 1 ? `${n} tund` : `${n} tundi`);
export const pct = (x: number) => (x * 100).toFixed(1).replace(".", ",") + "%";
export function fmtDate(ds: string, withYear = false) {
  const [y, m, d] = ds.split("-").map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  return `${WD_SHORT[wd]} ${d}. ${MON[m - 1]}${withYear ? " " + y : ""}`;
}
/** "kolmapäev, 18. november" */
export function fmtLong(ds: string) {
  const [y, m, d] = ds.split("-").map(Number);
  return `${WD_LONG[new Date(y, m - 1, d).getDay()]}, ${d}. ${MON_LONG[m - 1]}`;
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
/** Short label for how many lessons are left: "5 varu", "piiril", "2 üle". */
export const leftLabel = (left: number) => (left < 0 ? `${-left} üle` : left === 0 ? "piiril" : `${left} varu`);

/* ---------- Icons (SF Symbols style: one stroke weight, drawn) ---------- */

const ICONS = {
  left: "m15 18-6-6 6-6",
  right: "m9 18 6-6-6-6",
  x: "M18 6 6 18M6 6l12 12",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  check: "m5 12 5 5L20 7",
  alert: "M12 8v5M12 16.5v.01M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  calendar: "M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
  gauge: "M12 14l3-5M4.5 17a9 9 0 1 1 15 0",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z",
  share: "M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6",
} as const;
export type IconName = keyof typeof ICONS;
export function Icon({ name, size = 20, stroke = 2 }: { name: IconName; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  );
}

/* ---------- Layout: nav bars and inset grouped lists ---------- */

/** iOS large title. */
export function LargeTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="px-4 pt-2 pb-1">
      <h1 className="m-0 text-[34px] leading-[41px] font-bold tracking-[0.01em]">{title}</h1>
      {subtitle && <div className="text-[15px] text-muted -mt-0.5">{subtitle}</div>}
    </header>
  );
}

/** Pushed page nav bar (iOS 26): contained round glass back button, inline title. */
export function NavBar({ title, onBack, backLabel = "Tagasi", trailing }: { title: string; onBack: () => void; backLabel?: string; trailing?: ReactNode }) {
  return (
    <div className="sticky top-0 z-10 -mx-4 px-4 pt-[calc(env(safe-area-inset-top)+8px)] pb-2 grid grid-cols-[44px_1fr_44px] items-center gap-2 bg-gradient-to-b from-bg via-bg/90 to-bg/0">
      <button type="button" onClick={onBack} aria-label={backLabel} className="glass size-11 rounded-full grid place-items-center text-ink cursor-pointer active:scale-95 transition-transform">
        <Icon name="left" size={22} stroke={2.4} />
      </button>
      <div className="font-semibold text-[17px] text-center truncate">{title}</div>
      <div className="justify-self-end">{trailing}</div>
    </div>
  );
}

/** Inset grouped section: uppercase header, rounded group, optional footer. */
export function Section({ title, footer, children, className = "" }: { title?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col ${className}`}>
      {title && <h2 className="m-0 px-5 pb-2 text-[15px] font-semibold text-ink">{title}</h2>}
      <div className="bg-surface rounded-[26px] overflow-hidden">{children}</div>
      {footer && <div className="px-5 pt-2 text-[13px] leading-[18px] text-muted">{footer}</div>}
    </section>
  );
}

/** Kept for screens that want one padded block inside a group. */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`bg-surface rounded-[26px] p-5 flex flex-col gap-3 ${className}`}>{children}</section>;
}

/** One list cell. Pass onClick for a tappable row (adds press state and optional chevron). */
export function Row({
  children,
  detail,
  onClick,
  chevron,
  className = "",
  ariaLabel,
}: {
  children: ReactNode;
  detail?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const inner = (
    <>
      <div className="flex-1 min-w-0 py-2.5">{children}</div>
      {detail !== undefined && <div className="shrink-0 text-muted text-[17px] text-right">{detail}</div>}
      {chevron && (
        <span className="shrink-0 text-faint -mr-1">
          <Icon name="right" size={18} stroke={2.4} />
        </span>
      )}
    </>
  );
  const cls = `cell flex items-center gap-3 px-5 min-h-[52px] w-full text-left ${className}`;
  return onClick ? (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className={`${cls} press cursor-pointer`}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/* ---------- Controls ---------- */

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "quiet"; size?: "md" | "lg" }) {
  const v = {
    primary: "bg-accent text-accent-ink",
    ghost: "bg-accent-soft text-accent",
    danger: "bg-bad-fill text-bad-ink",
    quiet: "bg-transparent text-accent",
  }[variant];
  const s = size === "lg" ? "min-h-[52px] px-6 rounded-full text-[17px]" : "min-h-11 px-5 rounded-full text-[15px]";
  return (
    <button
      type="button"
      className={`${s} font-semibold cursor-pointer active:opacity-60 transition-opacity duration-100 disabled:opacity-35 disabled:cursor-not-allowed ${v} ${className}`}
      {...rest}
    />
  );
}

/** iOS segmented control. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col p-[3px] rounded-full bg-surface-2">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`min-h-[34px] px-2 rounded-full text-[14px] cursor-pointer transition-[background-color,box-shadow] duration-150 ${
              on ? "bg-raised font-semibold shadow-[0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)]" : "font-medium"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** iOS switch. */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 w-[51px] h-[31px] rounded-full cursor-pointer transition-colors duration-200 disabled:opacity-40 ${checked ? "bg-ok-fill" : "bg-surface-2"}`}
    >
      <span
        className={`absolute top-[2px] left-[2px] size-[27px] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.15),0_3px_1px_rgb(0_0_0/0.06)] transition-transform duration-200 ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

/** Value plus an iOS − | + stepper. */
export function Stepper({ value, onChange, label, max = 99 }: { value: number; onChange: (n: number) => void; label: string; max?: number }) {
  const btn = "w-[47px] h-8 grid place-items-center cursor-pointer active:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed";
  return (
    <div className="flex items-center gap-3" role="group" aria-label={label}>
      <span className={`num text-[17px] w-6 text-right ${value ? "" : "text-muted"}`} aria-live="polite">
        {value}
      </span>
      <div className="flex items-center rounded-full bg-surface-2">
        <button type="button" className={`${btn} rounded-l-full`} aria-label={`${label}: vähem`} disabled={value <= 0} onClick={() => onChange(Math.max(0, value - 1))}>
          <Icon name="minus" size={18} />
        </button>
        <span className="w-px h-[18px] bg-line" aria-hidden />
        <button type="button" className={`${btn} rounded-r-full`} aria-label={`${label}: rohkem`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
          <Icon name="plus" size={18} />
        </button>
      </div>
    </div>
  );
}

/** Trailing checkmark for selectable rows. */
export function Check({ on }: { on: boolean }) {
  return <span className={`shrink-0 text-accent ${on ? "" : "invisible"}`}>{<Icon name="check" size={20} stroke={2.6} />}</span>;
}

/* ---------- Status ---------- */

const STATUS_TEXT: Record<Status, string> = { ok: "text-ok", warn: "text-warn", edge: "text-bad", over: "text-bad" };
/** Status as coloured trailing text; "over" gets a filled capsule so it never reads as colour alone. */
export function Pill({ status, children }: { status: Status; children: ReactNode }) {
  return status === "over" ? (
    <span className="num text-[15px] font-semibold px-2 py-0.5 rounded-full bg-bad-fill text-bad-ink whitespace-nowrap">{children}</span>
  ) : (
    <span className={`num text-[17px] font-semibold whitespace-nowrap ${STATUS_TEXT[status]}`}>{children}</span>
  );
}

const BAR: Record<Status, string> = { ok: "bg-ok-fill", warn: "bg-warn-fill", edge: "bg-bad-fill", over: "bg-bad-fill" };
/**
 * Missed share of the half-year's lessons. The limit tick sits at 62.5% of the track so
 * "over" still has room; planned lessons show as a faded extension after the missed ones.
 */
export function Meter({ pct: p, planPct = 0, limitPct, status, label }: { pct: number; planPct?: number; limitPct: number; status: Status; label: string }) {
  // Grow in from zero on first paint; the .anim transition only runs under no-preference motion.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(t);
  }, []);
  const scale = limitPct * 1.6;
  const w = shown ? Math.min(p / scale, 1) * 100 : 0;
  const wp = shown ? Math.min((p + planPct) / scale, 1) * 100 - w : 0;
  return (
    <div className="relative h-1 rounded-full bg-surface-2 mt-1.5" role="img" aria-label={label}>
      <i className={`anim absolute inset-y-0 left-0 rounded-full ${BAR[status]}`} style={{ width: `${w}%` }} />
      {wp > 0 && <i className={`anim absolute inset-y-0 rounded-full opacity-40 ${BAR[status]}`} style={{ left: `${w}%`, width: `${wp}%` }} />}
      <span className="absolute -top-[3px] -bottom-[3px] w-[2px] rounded bg-ink/70" style={{ left: "62.5%" }} />
    </div>
  );
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="text-[13px] text-muted">
      {children}
    </label>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="text-center py-8 px-4 flex flex-col gap-1.5 items-center">
      <div className="font-semibold text-[17px]">{title}</div>
      {children && <div className="text-muted text-[15px] max-w-[36ch]">{children}</div>}
    </div>
  );
}

/** Group sorted ISO dates into consecutive weekday runs for display. */
export function dateRuns(dates: string[]): { start: string; end: string; days: string[] }[] {
  const out: { start: string; end: string; days: string[] }[] = [];
  for (const d of [...dates].sort()) {
    const last = out[out.length - 1];
    if (last) {
      const gap = (new Date(d + "T12:00").getTime() - new Date(last.end + "T12:00").getTime()) / 864e5;
      const wd = new Date(d + "T12:00").getDay();
      if (gap === 1 || (gap === 3 && wd === 1)) {
        last.end = d;
        last.days.push(d);
        continue;
      }
    }
    out.push({ start: d, end: d, days: [d] });
  }
  return out;
}
