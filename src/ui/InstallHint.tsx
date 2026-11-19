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
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
function snoozed() {
  try {
    const t = Number(localStorage.getItem(KEY) || 0);
    return Date.now() - t < SNOOZE_DAYS * 864e5;
  } catch {
    return false;
  }
}

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
  const ios = typeof navigator !== "undefined" && isIOS();
  if (hidden || (!ios && !canPrompt)) return null;

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
        {ios ? (
          <p className="m-0 mt-0.5 text-[15px] leading-[20px] text-muted">
            Puuduta <span className="inline-flex align-[-3px] text-accent" aria-label="Jaga nuppu"><Icon name="share" size={18} stroke={2.2} /></span> <b className="font-semibold text-ink">Jaga</b> ja vali{" "}
            <b className="font-semibold text-ink">„Lisa avakuvale”</b>. Siis avaneb Varu nagu äpp ja töötab ka ilma netita.
            {early ? " Tee seda enne seadistamist: brauseris tehtud seaded ei liigu äppi kaasa." : ""}
          </p>
        ) : (
          <p className="m-0 mt-0.5 text-[15px] leading-[20px] text-muted">Paigalda Varu, siis avaneb see nagu äpp ja töötab ka ilma netita.</p>
        )}
        <div className="flex gap-2 mt-3">
          {!ios && canPrompt && (
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
