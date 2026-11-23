import { createPortal } from "react-dom";
import { haptic } from "./haptics";
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from "react";
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
  book: "M7 4h11a1 1 0 0 1 1 1v13H7.5A2.5 2.5 0 0 0 5 20.5V6a2 2 0 0 1 2-2Zm-2 16.5A2.5 2.5 0 0 1 7.5 18H19v3H7.5A2.5 2.5 0 0 1 5 20.5ZM9 8h6",
  grid: "M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm-2 5h16M4 14.5h16M10 9v11",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  archive: "M3 5h18v4H3zM5 9v10h14V9M10 13h4",
  palette: "M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.8 1.7-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5c0-4-4-7.2-9-7.2ZM7.5 12.5h.01M9.5 8h.01M14.5 8h.01",
  flask: "M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3M7.5 15h9",
  building: "M4 21V8l8-5 8 5v13M9 21v-6h6v6M3 21h18",
  calendarX: "M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm5 8 4 4m0-4-4 4",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  pencil: "M4 20h4L19 9l-4-4L4 16v4Z",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 7.5v.01",
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
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
      className={`glass glass-btn rounded-full grid place-items-center text-accent cursor-pointer ${small ? "size-9" : "size-11"}`}
    >
      <Icon name="plus" size={small ? 20 : 24} stroke={2.4} />
    </button>
  );
}

/** Round glass settings (gear) button, next to + on the main screen. */
export function GearButton({ onClick, small }: { onClick: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Seaded"
      className={`glass glass-btn rounded-full grid place-items-center text-ink cursor-pointer ${small ? "size-9" : "size-11"}`}
    >
      <svg width={small ? 19 : 22} height={small ? 19 : 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={TAB_ICONS.settings} />
      </svg>
    </button>
  );
}

/** Pushed page nav bar (iOS 26): contained round glass back button, inline title. */
export function NavBar({ title, onBack, backLabel = "Tagasi", trailing }: { title: string; onBack: () => void; backLabel?: string; trailing?: ReactNode }) {
  return (
    <div className="sticky top-0 z-10 -mx-4 px-4 pt-[calc(env(safe-area-inset-top)+8px)] pb-2 grid grid-cols-[44px_1fr_44px] items-center gap-2 bg-gradient-to-b from-bg via-bg/90 to-bg/0">
      <button type="button" onClick={onBack} aria-label={backLabel} className="glass glass-btn size-11 rounded-full grid place-items-center text-ink cursor-pointer">
        <Icon name="left" size={22} stroke={2.4} />
      </button>
      <div className="font-semibold text-[17px] text-center truncate">{title}</div>
      <div className="justify-self-end">{trailing}</div>
    </div>
  );
}

/** Inset grouped section: uppercase header, rounded group, optional footer. */
/**
 * Inset grouped list. `footer` is always shown (use it for warnings and things that change);
 * `info` is background help, hidden behind an (i) next to the title until asked for.
 */
export function Section({
  title,
  footer,
  info,
  children,
  className = "",
}: {
  title?: ReactNode;
  footer?: ReactNode;
  info?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <section className={`flex flex-col ${className}`}>
      {(title || info) && (
        <div className="flex items-center justify-between gap-2 px-5 pb-2 min-h-[22px]">
          {title ? <h2 className="m-0 text-[15px] font-semibold text-ink">{title}</h2> : <span />}
          {info && (
            <button
              type="button"
              onClick={() => setShowInfo((v) => !v)}
              aria-expanded={showInfo}
              aria-label={showInfo ? "Peida selgitus" : "Mis see on?"}
              className={`-my-3 -mr-3 size-11 shrink-0 grid place-items-center rounded-full cursor-pointer transition-colors ${showInfo ? "text-accent" : "text-faint active:text-muted"}`}
            >
              <Icon name="info" size={19} stroke={2} />
            </button>
          )}
        </div>
      )}
      <div className="bg-surface rounded-[26px] overflow-hidden">{children}</div>
      {footer && <div className="px-5 pt-2 text-[13px] leading-[18px] text-muted">{footer}</div>}
      {info && showInfo && <div className="fade-in px-5 pt-2 text-[13px] leading-[18px] text-muted">{info}</div>}
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

/**
 * A button that gives a haptic tap on iPhone. Safari only plays haptics when the user's own tap
 * flips a native switch, so this is a <label> with a hidden switch inside: the tap toggles the
 * switch (haptic) and runs onClick. Behaves like a button for keyboard and screen readers.
 */
export function HapticButton({
  onClick,
  disabled,
  className = "",
  children,
  ...rest
}: {
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
  "aria-pressed"?: boolean;
  tabIndex?: number;
  "data-iso"?: string;
  style?: CSSProperties;
}) {
  return (
    <label
      role="button"
      tabIndex={disabled ? -1 : (rest.tabIndex ?? 0)}
      aria-disabled={disabled || undefined}
      aria-label={rest["aria-label"]}
      aria-pressed={rest["aria-pressed"]}
      data-iso={rest["data-iso"]}
      style={rest.style}
      data-disabled={disabled || undefined}
      className={`relative select-none ${disabled ? "pointer-events-none" : "cursor-pointer"} ${className}`}
      onClick={() => {
        if (disabled) return;
        haptic();
        onClick?.();
      }}
      onKeyDown={(e) => {
        if (disabled || (e.key !== "Enter" && e.key !== " ")) return;
        e.preventDefault();
        onClick?.();
      }}
    >
      {children}
      <input
        type="checkbox"
        // @ts-expect-error: Safari's native switch attribute
        switch=""
        tabIndex={-1}
        aria-hidden
        disabled={disabled}
        // The label forwards a second click to the input; stop it so onClick runs once.
        onClick={(e) => e.stopPropagation()}
        className="absolute opacity-0 pointer-events-none size-px"
      />
    </label>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  haptic: withHaptic,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "quiet"; size?: "sm" | "md" | "lg"; haptic?: boolean }) {
  const v = {
    primary: "bg-accent text-accent-ink",
    ghost: "bg-accent-soft text-accent",
    danger: "bg-bad-fill text-bad-ink",
    quiet: "bg-transparent text-accent",
  }[variant];
  // sm sits inside a 52px list row: 32px tall, so with a 10px right inset it is evenly spaced on all sides.
  const s =
    size === "lg" ? "min-h-[52px] px-6 rounded-full text-[17px]" : size === "sm" ? "min-h-8 px-3.5 rounded-full text-[15px]" : "min-h-11 px-5 rounded-full text-[15px]";
  const cls = `${s} tap font-semibold cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${v} ${className}`;
  if (withHaptic)
    return (
      <HapticButton
        onClick={rest.onClick ? () => rest.onClick!(undefined as never) : undefined}
        disabled={rest.disabled}
        aria-label={rest["aria-label"]}
        className={`inline-flex items-center justify-center ${cls} ${rest.disabled ? "opacity-35" : ""}`}
      >
        {rest.children}
      </HapticButton>
    );
  return <button type="button" className={cls} {...rest} />;
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
    <div role="radiogroup" aria-label={label} className="relative grid auto-cols-fr grid-flow-col p-[3px] rounded-full bg-surface-2">
      {/* The selected pill slides between options on a snappy spring, like UISegmentedControl. */}
      <span
        aria-hidden
        className="absolute top-[3px] bottom-[3px] left-[3px] rounded-full bg-raised shadow-[0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)] transition-transform duration-(--dur-snappy) ease-(--spring-snappy) motion-reduce:transition-none"
        style={{
          width: `calc((100% - 6px) / ${options.length})`,
          transform: `translateX(${Math.max(0, options.findIndex((o) => o.value === value)) * 100}%)`,
        }}
      />
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`relative min-h-[34px] px-2 rounded-full text-[14px] cursor-pointer transition-opacity duration-200 active:opacity-60 ${on ? "font-semibold" : "font-medium"}`}
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
    <label
      className={`group relative shrink-0 w-[51px] h-[31px] rounded-full cursor-pointer transition-colors duration-300 has-[:disabled]:opacity-40 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${checked ? "bg-ok-fill" : "bg-surface-2"}`}
    >
      {/* A real iOS switch input takes the tap, so Safari plays the system haptic itself. */}
      <input
        type="checkbox"
        // @ts-expect-error: Safari's native switch attribute
        switch=""
        role="switch"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="absolute inset-0 m-0 size-full opacity-0 cursor-pointer"
      />
      {/* Like UISwitch: the knob stretches while held, then springs across. */}
      <span
        className={`pointer-events-none absolute top-[2px] left-[2px] h-[27px] w-[27px] group-active:w-[34px] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.15),0_3px_1px_rgb(0_0_0/0.06)] transition-[transform,width] duration-(--dur-snappy) ease-(--spring-snappy) motion-reduce:transition-none ${
          checked ? "translate-x-5 group-active:translate-x-[13px]" : ""
        }`}
      />
    </label>
  );
}

/** Value plus an iOS − | + stepper. */
export function Stepper({ value, onChange, label, max = 99 }: { value: number; onChange: (n: number) => void; label: string; max?: number }) {
  const btn = "press w-[47px] h-8 grid place-items-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed";
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
/** While a sheet is open the page behind does not scroll. */
function useScrollLock(active: boolean) {
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
 * iOS sheet: slides up on a smooth spring over a dimmed page; swipe the grabber or header down
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
  const { mounted, shown } = usePresence(open, 450);
  const [drag, setDrag] = useState(0);
  const start = useRef<{ y: number; t: number } | null>(null);
  useScrollLock(open);
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
  // Rendered at the top of the page so the tab bar never covers it.
  return createPortal(
    <div className="fixed inset-x-0 bottom-0 top-[max(env(safe-area-inset-top),2px)] z-40" role="dialog" aria-modal="true" aria-label={title}>
      {/* The dialog starts below the status bar: a layer appearing over the top edge makes
          Safari re-tint the status bar area, which showed as a brief flash (tested on device). */}
      <div className={`backdrop absolute inset-0 bg-black/40 ${shown ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <div
        className={`sheet ${shown ? "" : "closing"} absolute inset-x-0 bottom-0 top-[28px] max-w-[640px] mx-auto bg-bg rounded-t-[26px] shadow-[0_-10px_40px_rgb(0_0_0/0.25)] flex flex-col overflow-hidden`}
        style={{ transform: shown ? `translateY(${drag}px)` : "translateY(100%)", transition: drag ? "none" : undefined }}
      >
        <div className="shrink-0 touch-none cursor-grab" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <div className="mx-auto mt-2 h-[5px] w-9 rounded-full bg-faint" aria-hidden />
          <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 pt-1.5 pb-2 min-h-12">
            <button type="button" onClick={onClose} className="tap justify-self-start text-accent text-[17px] min-h-11 pr-3 cursor-pointer">
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
  const { mounted, shown } = usePresence(open, 450);
  useScrollLock(open);
  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-x-0 bottom-0 top-[max(env(safe-area-inset-top),2px)] z-50" role="dialog" aria-modal="true" aria-label={title ?? "Valikud"}>
      <div className={`backdrop absolute inset-0 bg-black/35 ${shown ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <div
        className={`sheet ${shown ? "" : "closing"} absolute inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+8px)] max-w-[480px] mx-auto flex flex-col gap-2`}
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
            <HapticButton
              key={i}
              onClick={() => {
                onClose();
                a.onClick();
              }}
              className={`press w-full min-h-[56px] px-4 text-[19px] flex items-center justify-center text-center ${i ? "border-t border-line" : ""} ${a.destructive ? "text-bad" : "text-accent"} ${a.bold ? "font-semibold" : ""}`}
            >
              {a.label}
            </HapticButton>
          ))}
        </div>
        <button type="button" onClick={onClose} className="glass press w-full min-h-[56px] rounded-[16px] text-[19px] font-semibold text-accent cursor-pointer">
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
      haptic();
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
          <HapticButton
            key={a.label}
            tabIndex={openRow ? 0 : -1}
            onClick={() => {
              setOpenRow(false);
              setX(0);
              a.onClick();
            }}
            className={`flex-1 flex flex-col items-center justify-center gap-1 text-white text-[13px] font-medium ${SWIPE_TONE[a.tone]}`}
          >
            {a.icon && <Icon name={a.icon} size={20} />}
            {a.label}
          </HapticButton>
        ))}
      </div>
      <div
        className="relative bg-surface touch-pan-y select-none"
        style={{ transform: `translateX(${x}px)`, transition: g.current ? "none" : "transform var(--dur-quick) var(--spring-quick)" }}
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

/* ---------- Dates ---------- */

const pad2 = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: number, m: number, d: number) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
function todayIso() {
  const t = new Date();
  return isoOf(t.getFullYear(), t.getMonth(), t.getDate());
}

/**
 * A date row with an inline calendar that opens right under it, like the inline UIDatePicker in
 * iOS Settings and Calendar (instead of the browser's floating picker, which covers the list).
 */
export function DateField({
  label,
  value,
  onChange,
  min,
  max,
  placeholder = "Vali kuupäev",
  trailing,
  isOff,
}: {
  label?: ReactNode;
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  trailing?: ReactNode;
  isOff?: (iso: string) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const { mounted, shown } = usePresence(open, 450);
  const shownValue = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
  return (
    <div className="cell">
      <div className="flex items-center justify-between gap-3 px-5 min-h-[52px]">
        {label !== undefined && <span className="min-w-0">{label}</span>}
        <span className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            aria-expanded={open}
            aria-label={`${typeof label === "string" ? label + ": " : ""}${shownValue ? fmtDate(shownValue, true) : placeholder}`}
            onClick={() => setOpen((o) => !o)}
            className={`tap num rounded-full px-3 py-1.5 text-[17px] cursor-pointer transition-colors duration-200 ${open ? "bg-accent-soft text-accent" : shownValue ? "bg-surface-2 text-ink" : "bg-surface-2 text-muted"}`}
          >
            {shownValue ? fmtDate(shownValue, true) : placeholder}
          </button>
          {trailing}
        </span>
      </div>
      <div
        className="grid transition-[grid-template-rows] duration-(--dur-smooth) ease-(--spring-smooth) motion-reduce:transition-none"
        style={{ gridTemplateRows: shown ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          {mounted && (
            <Calendar
              value={shownValue}
              min={min}
              max={max}
              isOff={isOff}
              onPick={(v) => {
                onChange(v);
                setOpen(false);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

const CAL_WD = ["E", "T", "K", "N", "R", "L", "P"];
const isWeekend = (iso: string) => {
  const d = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))).getDay();
  return d === 0 || d === 6;
};

/**
 * Month calendar. Single mode picks one day. Range mode: tap the first and last day, or press
 * and drag across days. `isOff` greys out days without school (they still can be selected).
 */
function Calendar({
  value,
  end,
  min,
  max,
  isOff = isWeekend,
  onPick,
  onRange,
}: {
  value: string;
  end?: string;
  min?: string;
  max?: string;
  isOff?: (iso: string) => boolean;
  onPick?: (v: string) => void;
  onRange?: (start: string, end: string, done: boolean) => void;
}) {
  const range = !!onRange;
  const today = todayIso();
  const start = value || (min && min > today ? min : max && max < today ? max : today);
  const [ym, setYm] = useState(() => ({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) - 1 }));
  // Range: after the first tap we wait for the second one.
  const pending = useRef(false);
  const drag = useRef<{ anchor: string; moved: boolean } | null>(null);
  const justDragged = useRef(false);
  const first = new Date(ym.y, ym.m, 1);
  const lead = (first.getDay() + 6) % 7; // Monday first
  const days = new Date(ym.y, ym.m + 1, 0).getDate();
  const step = (k: number) => setYm(({ y, m }) => ({ y: m + k < 0 ? y - 1 : m + k > 11 ? y + 1 : y, m: (m + k + 12) % 12 }));
  const canPrev = !min || isoOf(ym.y, ym.m, 1) > min;
  const canNext = !max || isoOf(ym.y, ym.m, days) < max;
  const allowed = (iso: string) => !((min && iso < min) || (max && iso > max));
  const lo = value;
  const hi = range ? end || value : value;
  const dayAt = (x: number, y: number) => (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>("[data-iso]")?.dataset.iso;

  const tap = (iso: string) => {
    if (!range) return onPick?.(iso);
    if (!pending.current || iso < lo) {
      pending.current = true;
      onRange!(iso, iso, false);
    } else {
      pending.current = false;
      onRange!(lo, iso, true);
    }
  };

  return (
    <div className="px-3 pb-3 pt-1">
      <div className="flex items-center justify-between pl-2 pb-1">
        <span className="font-semibold text-[17px]">
          {cap(MON_LONG[ym.m])} {ym.y}
        </span>
        <span className="flex">
          <button type="button" aria-label="Eelmine kuu" disabled={!canPrev} onClick={() => step(-1)} className="tap size-11 grid place-items-center text-accent cursor-pointer disabled:opacity-30">
            <Icon name="left" size={22} stroke={2.4} />
          </button>
          <button type="button" aria-label="Järgmine kuu" disabled={!canNext} onClick={() => step(1)} className="tap size-11 grid place-items-center text-accent cursor-pointer disabled:opacity-30">
            <Icon name="right" size={22} stroke={2.4} />
          </button>
        </span>
      </div>
      <div className="grid grid-cols-7 text-center text-[12px] font-semibold text-muted pb-1.5" aria-hidden>
        {CAL_WD.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div
        className={`grid grid-cols-7 gap-y-1 select-none ${range ? "touch-none" : ""}`}
        role="grid"
        aria-label={`${cap(MON_LONG[ym.m])} ${ym.y}`}
        onPointerDown={(e) => {
          if (!range) return;
          const iso = dayAt(e.clientX, e.clientY);
          if (!iso || !allowed(iso)) return;
          drag.current = { anchor: iso, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const iso = dayAt(e.clientX, e.clientY);
          if (!iso || !allowed(iso) || (!d.moved && iso === d.anchor)) return;
          if (!d.moved) {
            haptic();
            // Keep following the finger/cursor across the whole grid once a drag starts.
            (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
          }
          d.moved = true;
          const [a, b] = iso < d.anchor ? [iso, d.anchor] : [d.anchor, iso];
          if (a !== lo || b !== hi) onRange!(a, b, false);
        }}
        onPointerUp={() => {
          const d = drag.current;
          drag.current = null;
          if (d?.moved) {
            pending.current = false;
            justDragged.current = true;
            setTimeout(() => (justDragged.current = false), 0);
            haptic();
            onRange!(lo, hi, true);
          }
        }}
        onPointerCancel={() => (drag.current = null)}
      >
        {Array.from({ length: lead }, (_, i) => (
          <span key={`l${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const iso = isoOf(ym.y, ym.m, i + 1);
          const off = !allowed(iso);
          const free = !off && isOff(iso);
          const isStart = iso === lo;
          const isEnd = range && iso === hi;
          const sel = isStart || isEnd;
          const inside = range && lo && hi > lo && iso > lo && iso < hi;
          const isToday = iso === today;
          const col = (lead + i) % 7;
          const hasBand = range && !!lo && hi > lo && (inside || isStart || isEnd);
          // The band is exactly as tall as the circles; it rounds off at week edges.
          const bandCls = !hasBand
            ? ""
            : `${isStart ? "left-1/2" : col === 0 || i === 0 ? "left-[2px] rounded-l-full" : "left-0"} ${
                isEnd ? "right-1/2" : col === 6 || i === days - 1 ? "right-[2px] rounded-r-full" : "right-0"
              }`;
          return (
            <HapticButton
              key={iso}
              data-iso={iso}
              disabled={off}
              aria-pressed={sel || !!inside}
              aria-label={`${fmtDate(iso, true)}${free ? ", koolivaba" : ""}`}
              onClick={() => {
                if (justDragged.current) return;
                tap(iso);
              }}
              className="group grid place-items-center h-11"
            >
              {hasBand && <span aria-hidden className={`absolute top-[2px] bottom-[2px] bg-accent-soft ${bandCls}`} />}
              <span
                className={`relative num size-10 grid place-items-center rounded-full text-[19px] transition-[background-color,color,transform] duration-200 ${
                  sel
                    ? "bg-accent text-accent-ink font-semibold"
                    : off
                      ? "text-faint opacity-50"
                      : free
                        ? "text-faint"
                        : inside
                          ? "text-accent font-medium"
                          : isToday
                            ? "text-accent font-semibold group-active:bg-surface-2"
                            : "group-active:bg-surface-2"
                }`}
              >
                {i + 1}
              </span>
            </HapticButton>
          );
        })}
      </div>
      <div className="px-2 pt-2 text-[13px] leading-[18px] text-muted">
        {range ? "Puuduta esimest ja viimast päeva või vea sõrmega üle. " : ""}Hallid päevad on koolivabad ja ei lähe arvesse.
      </div>
    </div>
  );
}

/** A day range in one calendar: tap first and last day, or drag across them. */
export function DateRangeField({
  label,
  start,
  end,
  onChange,
  isOff,
  defaultOpen,
}: {
  label: ReactNode;
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  isOff?: (iso: string) => boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const { mounted, shown } = usePresence(open, 450);
  const text = start === end ? fmtDate(start, true) : `${fmtDate(start)} – ${fmtDate(end, start.slice(0, 4) !== end.slice(0, 4))}`;
  return (
    <div className="cell">
      <div className="flex items-center justify-between gap-3 px-5 min-h-[52px]">
        <span className="min-w-0">{label}</span>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={`tap num rounded-full px-3 py-1.5 text-[17px] cursor-pointer transition-colors duration-200 ${open ? "bg-accent-soft text-accent" : "bg-surface-2 text-ink"}`}
        >
          {text}
        </button>
      </div>
      <div className="grid transition-[grid-template-rows] duration-(--dur-smooth) ease-(--spring-smooth) motion-reduce:transition-none" style={{ gridTemplateRows: shown ? "1fr" : "0fr" }}>
        <div className="min-h-0 overflow-hidden">
          {mounted && (
            <Calendar
              value={start}
              end={end}
              isOff={isOff}
              onRange={(a, b, done) => {
                onChange(a, b);
                if (done && a !== b) setTimeout(() => setOpen(false), 350);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
