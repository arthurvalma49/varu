import { useState } from "react";
import { totals } from "../core/calc";
import { encodeSetup } from "../core/share";
import type { Setup } from "../core/types";
import { Button, Card, Icon } from "./kit";

/** Shown once after a hand-made setup: classmates should never have to enter the timetable again. */
export function ShareCard({ setup, onClose }: { setup: Setup; onClose: () => void }) {
  const [msg, setMsg] = useState("");
  const lessons = Object.values(totals(setup)).reduce((s, n) => s + n, 0);
  const url = `${location.origin}${location.pathname}#setup=${encodeSetup(setup)}`;
  return (
    <Card className="gap-2 border-accent/50 bg-accent-soft fade-in">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-bold m-0">Valmis. Saada klassikaaslastele?</h2>
        <button type="button" aria-label="Sulge" onClick={onClose} className="size-10 -mr-2 -mt-2 grid place-items-center rounded-lg text-muted hover:text-ink cursor-pointer">
          <Icon name="x" size={18} />
        </button>
      </div>
      <p className="m-0 text-sm text-muted num">
        {setup.subjects.length} ainet, {lessons} tundi perioodis, vaheajad arvestatud. Link annab klassikaaslastele sama tunniplaani ühe puudutusega, sinu puudumisi see ei sisalda.
      </p>
      <div className="flex gap-2 flex-wrap items-center">
        <Button
          onClick={async () => {
            try {
              if (navigator.share) await navigator.share({ title: "Varu", text: `${setup.schoolName} ${setup.className} tunniplaan Varus`, url });
              else {
                await navigator.clipboard.writeText(url);
                setMsg("Link kopeeritud.");
              }
            } catch {
              /* share sheet closed or clipboard blocked */
            }
          }}
        >
          Jaga linki
        </Button>
        <span className="text-sm text-muted" role="status">
          {msg}
        </span>
      </div>
    </Card>
  );
}
