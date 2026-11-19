import { useEffect, useState } from "react";
import { Button, Icon } from "./kit";

const KEY = "varu:install-hint";
const SNOOZE_DAYS = 7;

/** Chrome/Android's install event (not in the TS DOM lib). */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
  });
}

function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}
function snoozed() {
  try {
    const t = Number(localStorage.getItem(KEY) || 0);
    return Date.now() - t < SNOOZE_DAYS * 864e5;
  } catch {
    return false;
  }
}

type Where =
  | { kind: "inapp"; app: string; ios: boolean }
  | { kind: "ios-safari" }
  | { kind: "ios-other" }
  | { kind: "android" }
  | { kind: "android-firefox" }
  | { kind: "desktop" };

/** Which browser the link was opened in; each needs different steps to install. */
export function whereOpened(ua: string, touchMac = false): Where {
  const ios = /iPad|iPhone|iPod/.test(ua) || touchMac;
  const android = /Android/.test(ua);
  // Apps that open links in their own browser, where installing is not possible.
  const apps: [RegExp, string][] = [
    [/Instagram/, "Instagrami"],
    [/Snapchat/, "Snapchati"],
    [/musical_ly|BytedanceWebview|TikTok/i, "TikToki"],
    [/Messenger|FBAN|FBAV|FB_IAB/, "Facebooki"],
    [/LinkedInApp/, "LinkedIni"],
  ];
  if (ios || android) for (const [re, app] of apps) if (re.test(ua)) return { kind: "inapp", app, ios };
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? { kind: "ios-other" } : { kind: "ios-safari" };
  if (android) return /Firefox/.test(ua) ? { kind: "android-firefox" } : { kind: "android" };
  return { kind: "desktop" };
}

const Share = () => (
  <span className="inline-flex align-[-3px] text-accent" aria-label="Jaga">
    <Icon name="share" size={18} stroke={2.2} />
  </span>
);
const Dots = ({ vertical }: { vertical?: boolean }) => (
  <span className={`inline-flex align-[-4px] text-accent ${vertical ? "rotate-90" : ""}`} aria-label="menüü">
    <Icon name="more" size={20} stroke={3} />
  </span>
);
const B = ({ children }: { children: string }) => <b className="font-semibold text-ink">{children}</b>;

/**
 * Tells phone users who opened the link in the browser how to add Varu to the home screen.
 * iPhone never offers this itself, and data in a Safari tab stays separate from the installed app,
 * so `early` (onboarding) says to install before setting up.
 */
export function InstallHint({ early }: { early?: boolean }) {
  const [canPrompt, setCanPrompt] = useState(!!deferred);
  const [hidden, setHidden] = useState(() => typeof window === "undefined" || isStandalone() || snoozed());
  useEffect(() => {
    const on = (e: Event) => {
      e.preventDefault();
      deferred = e as InstallPromptEvent;
      setCanPrompt(true);
    };
    window.addEventListener("beforeinstallprompt", on);
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);
  const where = typeof navigator === "undefined" ? ({ kind: "desktop" } as Where) : whereOpened(navigator.userAgent, navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (hidden || where.kind === "desktop") return null;
  const prompt = where.kind === "android" && canPrompt;

  const later = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* fine, it shows again next time */
    }
    setHidden(true);
  };

  return (
    <section aria-label="Lisa avakuvale" className="rise bg-surface rounded-[26px] p-4 flex gap-3.5 items-start">
      <span className="shrink-0 size-11 rounded-[12px] bg-accent text-accent-ink grid place-items-center">
        <Icon name="download" size={22} stroke={2.2} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[17px]">Lisa avakuvale</div>
        <p className="m-0 mt-0.5 text-[15px] leading-[20px] text-muted">
          {where.kind === "inapp" ? (
            <>
              Link avanes {where.app} sees, siit ei saa Varu avakuvale lisada ja andmed ei jää alles. Puuduta <Dots vertical={!where.ios} /> või <Share /> ja vali{" "}
              <B>{where.ios ? "„Ava Safaris”" : "„Ava brauseris”"}</B>, siis lisa avakuvale.
            </>
          ) : where.kind === "ios-safari" ? (
            <>
              Puuduta <Share /> <B>Jaga</B> ja vali <B>„Lisa avakuvale”</B>. Siis avaneb Varu nagu äpp ja töötab ka ilma netita.
            </>
          ) : where.kind === "ios-other" ? (
            <>
              Puuduta <Share /> <B>Jaga</B> (või menüüs <Dots />) ja vali <B>„Lisa avakuvale”</B>. Kui seda pole, ava link Safaris. Siis avaneb Varu nagu äpp ja töötab ka ilma netita.
            </>
          ) : prompt ? (
            <>Paigalda Varu, siis avaneb see nagu äpp ja töötab ka ilma netita.</>
          ) : (
            <>
              Ava brauseri menüü <Dots vertical /> ja vali <B>„Paigalda”</B> või <B>„Lisa avakuvale”</B>. Siis avaneb Varu nagu äpp ja töötab ka ilma netita.
            </>
          )}
          {early && where.kind !== "inapp" ? " Tee seda enne seadistamist: brauseris tehtud seaded ei liigu äppi kaasa." : ""}
        </p>
        <div className="flex gap-2 mt-3">
          {prompt && (
            <Button
              className="min-h-9 px-4"
              onClick={async () => {
                const e = deferred;
                if (!e) return;
                await e.prompt();
                const { outcome } = await e.userChoice;
                deferred = null;
                setCanPrompt(false);
                if (outcome === "accepted") setHidden(true);
              }}
            >
              Paigalda
            </Button>
          )}
          <Button variant="quiet" className="min-h-9 !px-0" onClick={later}>
            Hiljem
          </Button>
        </div>
      </div>
    </section>
  );
}
