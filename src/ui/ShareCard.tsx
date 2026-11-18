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
    <Card className="gap-3 fade-in">
      <div className="flex items-start gap-3">
        <span className="shrink-0 size-11 rounded-full bg-accent-soft text-accent grid place-items-center">
          <Icon name="share" size={22} />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="m-0 text-[17px] font-semibold">Valmis. Saada klassikaaslastele?</h2>
          <p className="m-0 mt-0.5 text-[15px] text-muted num">
            {setup.subjects.length} ainet, {lessons} tundi perioodis, vaheajad arvestatud. Nemad saavad sama tunniplaani ühe puudutusega, sinu puudumisi link ei sisalda.
          </p>
        </div>
        <button type="button" aria-label="Sulge" onClick={onClose} className="size-8 -mr-1 -mt-1 grid place-items-center rounded-full bg-surface-2 text-muted cursor-pointer">
          <Icon name="x" size={16} stroke={2.4} />
        </button>
      </div>
      <div className="flex gap-3 items-center">
        <Button
          onClick={async () => {
            try {
              if (navigator.share) await navigator.share({ title: "Tunniplaan", text: `${setup.schoolName} ${setup.className}`, url });
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
        <span className="text-[15px] text-muted" role="status">
          {msg}
        </span>
      </div>
    </Card>
  );
}
