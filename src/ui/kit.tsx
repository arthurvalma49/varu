import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type PointerEvent as RPointerEvent, type ReactNode } from "react";
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
  more: "M5 12h.01M12 12h.01M19 12h.01",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Zm0 16a2 2 0 0 1 2-2h13v2",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  archive: "M3 5h18v4H3zM5 9v10h14V9M10 13h4",
  flask: "M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3M7.5 15h9",
  building: "M4 21V8l8-5 8 5v13M9 21v-6h6v6M3 21h18",
  calendarX: "M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm5 8 4 4m0-4-4 4",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  pencil: "M4 20h4L19 9l-4-4L4 16v4Z",
  tray: "M4 13h4l2 3h4l2-3h4M4 13l2-8h12l2 8v6H4v-6Z",
} as const;
export type IconName = keyof typeof ICONS;

/** Tab bar glyphs, shared by the tab bar and the onboarding tour. */
export const TAB_ICONS = {
  overview: "M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm3 8h2m4 0h2m-8 4h2",
  log: "M12 8v8M8 12h8M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  history: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  settings: "M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4",
} as const;
export function Icon({ name, size = 20, stroke = 2 }: { name: IconName; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  );
}

/* ---------- Layout: nav bars and inset grouped lists ---------- */

/** iOS large title, with an optional trailing control (e.g. the + button). */
export function LargeTitle({ title, subtitle, trailing }: { title: string; subtitle?: string; trailing?: ReactNode }) {
  return (
    <header className="px-4 pt-2 pb-1 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="m-0 text-[34px] leading-[41px] font-bold tracking-[0.01em]">{title}</h1>
        {subtitle && <div className="text-[15px] text-muted -mt-0.5 truncate">{subtitle}</div>}
      </div>
      {trailing && <div className="shrink-0 pb-1">{trailing}</div>}
    </header>
  );
}

/** Round glass + button for nav bars (iOS 26 contained bar button). */
export function PlusButton({ onClick, label = "Lisa puudumine", small }: { onClick: () => void; label?: string; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`glass rounded-full grid place-items-center text-accent cursor-pointer active:scale-95 transition-transform ${small ? "size-9" : "size-11"}`}
    >
      <Icon name="plus" size={small ? 20 : 24} stroke={2.4} />
    </button>
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

/** Apple's "nothing here yet": large grey symbol, title, one line, optional action. */
export function Empty({ title, children, icon = "tray", action }: { title: string; children?: ReactNode; icon?: IconName; action?: ReactNode }) {
  return (
    <div className="text-center py-10 px-4 flex flex-col gap-2 items-center">
      <span className="text-faint mb-1">
        <Icon name={icon} size={52} stroke={1.6} />
      </span>
      <div className="font-bold text-[22px] leading-tight">{title}</div>
      {children && <div className="text-muted text-[15px] max-w-[34ch]">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** iOS Settings-style icon: white glyph on a small coloured rounded square. */
export function SettingsIcon({ name, color }: { name: IconName; color: string }) {
  return (
    <span className="shrink-0 size-[30px] rounded-[8px] grid place-items-center text-white" style={{ background: color }} aria-hidden>
      <Icon name={name} size={18} stroke={2.2} />
    </span>
  );
}

/* ---------- Sheets, action sheets, swipe rows, long press ---------- */

/** Mount while open plus an exit animation. */
function usePresence(open: boolean, ms = 300) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(r);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(t);
  }, [open, ms]);
  return { mounted, shown };
}

let sheetsOpen = 0;
/** While a sheet is open the page behind recedes (scaled, dimmed) and does not scroll, as on iOS. */
function useRecede(active: boolean) {
  useEffect(() => {
    if (!active) return;
    sheetsOpen++;
    document.documentElement.classList.add("sheet-open");
    return () => {
      sheetsOpen--;
      if (!sheetsOpen) document.documentElement.classList.remove("sheet-open");
    };
  }, [active]);
}

/**
 * iOS sheet: rises from the bottom, the page behind recedes, swipe the grabber or header down
 * to dismiss. `leading` defaults to a Loobu button.
 */
export function Sheet({
  open,
  onClose,
  title,
  trailing,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  const { mounted, shown } = usePresence(open);
  const [drag, setDrag] = useState(0);
  const start = useRef<{ y: number; t: number } | null>(null);
  useRecede(open);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);
  if (!mounted) return null;
  const down = (e: RPointerEvent) => {
    start.current = { y: e.clientY, t: Date.now() };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const move = (e: RPointerEvent) => start.current && setDrag(Math.max(0, e.clientY - start.current.y));
  const up = () => {
    if (!start.current) return;
    const fast = drag / Math.max(1, Date.now() - start.current.t) > 0.6;
    start.current = null;
    if (drag > 120 || (fast && drag > 40)) onClose();
    setDrag(0);
  };
  // Rendered at the top of the page so the receding page and the tab bar never cover it.
  return createPortal(
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${shown ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <div
        className="sheet absolute inset-x-0 bottom-0 top-[calc(env(safe-area-inset-top)+30px)] max-w-[640px] mx-auto bg-bg rounded-t-[26px] shadow-[0_-10px_40px_rgb(0_0_0/0.25)] flex flex-col overflow-hidden"
        style={{ transform: shown ? `translateY(${drag}px)` : "translateY(100%)", transition: drag ? "none" : undefined }}
      >
        <div className="shrink-0 touch-none cursor-grab" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <div className="mx-auto mt-2 h-[5px] w-9 rounded-full bg-faint" aria-hidden />
          <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 pt-1.5 pb-2 min-h-12">
            <button type="button" onClick={onClose} className="justify-self-start text-accent text-[17px] min-h-11 pr-3 cursor-pointer">
              Loobu
            </button>
            <div className="font-semibold text-[17px] truncate">{title}</div>
            <div className="justify-self-end">{trailing}</div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] flex flex-col gap-7">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export interface SheetAction {
  label: ReactNode;
  onClick: () => void;
  destructive?: boolean;
  bold?: boolean;
}

/** iOS action sheet: a group of choices and a separate Loobu, sliding up from the bottom. */
export function ActionSheet({ open, onClose, title, message, actions }: { open: boolean; onClose: () => void; title?: string; message?: string; actions: SheetAction[] }) {
  const { mounted, shown } = usePresence(open, 260);
  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title ?? "Valikud"}>
      <div className={`absolute inset-0 bg-black/35 transition-opacity duration-200 ${shown ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <div
        className="sheet absolute inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+8px)] max-w-[480px] mx-auto flex flex-col gap-2"
        style={{ transform: shown ? "translateY(0)" : "translateY(110%)" }}
      >
        <div className="glass rounded-[16px] overflow-hidden">
          {(title || message) && (
            <div className="px-4 py-3 text-center border-b border-line">
              {title && <div className="text-[13px] font-semibold text-muted">{title}</div>}
              {message && <div className="text-[13px] text-muted mt-0.5">{message}</div>}
            </div>
          )}
          {actions.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                onClose();
                a.onClick();
              }}
              className={`w-full min-h-[56px] px-4 text-[19px] cursor-pointer active:bg-surface-2 ${i ? "border-t border-line" : ""} ${a.destructive ? "text-bad" : "text-accent"} ${a.bold ? "font-semibold" : ""}`}
            >
              {a.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} className="glass w-full min-h-[56px] rounded-[16px] text-[19px] font-semibold text-accent cursor-pointer active:bg-surface-2">
          Loobu
        </button>
      </div>
    </div>,
    document.body,
  );
}

/** Long press (and right-click) opens a context menu; a moving finger cancels it. */
export function useLongPress(onLong: () => void, ms = 480) {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const at = useRef<{ x: number; y: number } | null>(null);
  const clear = () => {
    if (t.current) clearTimeout(t.current);
    t.current = null;
  };
  return {
    onPointerDown: (e: RPointerEvent) => {
      at.current = { x: e.clientX, y: e.clientY };
      clear();
      t.current = setTimeout(onLong, ms);
    },
    onPointerMove: (e: RPointerEvent) => {
      if (at.current && Math.hypot(e.clientX - at.current.x, e.clientY - at.current.y) > 8) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onContextMenu: (e: { preventDefault: () => void }) => {
      e.preventDefault();
      clear();
      onLong();
    },
  };
}

export interface SwipeAction {
  label: string;
  icon?: IconName;
  tone: "red" | "gray" | "blue" | "orange";
  onClick: () => void;
}
const SWIPE_TONE = { red: "bg-bad-fill", gray: "bg-[#8e8e93]", blue: "bg-[#0a84ff]", orange: "bg-warn-fill" };

/** Mail-style swipe actions: drag a row left to reveal buttons; a tap elsewhere closes it. */
export function SwipeRow({ actions, children, className = "", ...rest }: { actions: SwipeAction[]; children: ReactNode; className?: string } & Record<string, unknown>) {
  const W = actions.length * 80;
  const [x, setX] = useState(0);
  const [openRow, setOpenRow] = useState(false);
  const g = useRef<{ x: number; y: number; base: number; lock?: "h" | "v" } | null>(null);
  const moved = useRef(false);
  const rowRef = useRef<HTMLDivElement>(null);
  // As on iOS, any touch outside an open row closes it.
  useEffect(() => {
    if (!openRow) return;
    const away = (e: PointerEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
        setOpenRow(false);
        setX(0);
      }
    };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, [openRow]);
  const down = (e: RPointerEvent) => {
    g.current = { x: e.clientX, y: e.clientY, base: openRow ? -W : 0 };
    moved.current = false;
  };
  const move = (e: RPointerEvent) => {
    const s = g.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!s.lock && Math.hypot(dx, dy) > 8) {
      s.lock = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      // Keep receiving the gesture even when the finger or cursor leaves the row.
      if (s.lock === "h") (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    }
    if (s.lock !== "h") return;
    moved.current = true;
    setX(Math.min(0, Math.max(-W - 40, s.base + dx)));
  };
  const up = () => {
    const s = g.current;
    g.current = null;
    if (!s || s.lock !== "h") return;
    const o = x < -W / 2;
    setOpenRow(o);
    setX(o ? -W : 0);
  };
  return (
    <div ref={rowRef} className={`cell relative overflow-hidden ${className}`} {...rest}>
      <div className="absolute inset-y-0 right-0 flex" style={{ width: W }} aria-hidden={!openRow}>
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            tabIndex={openRow ? 0 : -1}
            onClick={() => {
              setOpenRow(false);
              setX(0);
              a.onClick();
            }}
            className={`flex-1 flex flex-col items-center justify-center gap-1 text-white text-[13px] font-medium cursor-pointer ${SWIPE_TONE[a.tone]}`}
          >
            {a.icon && <Icon name={a.icon} size={20} />}
            {a.label}
          </button>
        ))}
      </div>
      <div
        className="relative bg-surface touch-pan-y select-none"
        style={{ transform: `translateX(${x}px)`, transition: g.current ? "none" : "transform 260ms cubic-bezier(0.2,0.8,0.2,1)" }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClickCapture={(e) => {
          if (moved.current || openRow) {
            e.stopPropagation();
            e.preventDefault();
            if (openRow && !moved.current) {
              setOpenRow(false);
              setX(0);
            }
          }
        }}
      >
        {children}
      </div>
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
