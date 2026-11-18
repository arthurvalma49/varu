import { useState } from "react";
import { SCHOOLS } from "../core/schools";
import { blankSetup, ram9bTemplate } from "../core/templates";
import type { Setup } from "../core/types";
import { Button, Card, fmtLimit } from "./kit";

export function Onboarding({ onDone, incoming }: { onDone: (s: Setup) => void; incoming: Setup | null }) {
  const [school, setSchool] = useState("ram");

  if (incoming)
    return (
      <Card className="gap-4">
        <h2 className="text-2xl font-bold m-0">Said seadistuse</h2>
        <p className="m-0 text-muted">
          {incoming.schoolName} {incoming.className} · {incoming.windowName} · {incoming.subjects.length} ainet, piir {fmtLimit(incoming.rule.limit)}.
        </p>
        <div>
          <Button onClick={() => onDone(incoming)}>Kasuta seda</Button>
        </div>
      </Card>
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="px-1">
        <h1 className="text-[clamp(30px,8vw,40px)] font-bold leading-[1.05] m-0">Kui palju tunde võid veel puududa?</h1>
        <p className="text-muted mt-2 mb-0 max-w-[52ch]">
          Varu arvutab iga aine kohta, kui kaugel sa oled kooli puudumiste piirist, ja kontrollib enne, kas üks vahele jäetud päev viiks sind üle.
        </p>
      </div>

      <Card className="gap-3">
        <h2 className="text-lg font-bold m-0">Kiire algus</h2>
        <button
          type="button"
          onClick={() => onDone(ram9bTemplate())}
          className="text-left rounded-xl border border-accent bg-accent-soft p-3 cursor-pointer hover:brightness-110"
        >
          <div className="font-bold">Rocca al Mare Kool · 9.b</div>
          <div className="text-sm text-muted">I poolaasta 2026/27, tunniplaan ja 1. perioodi tunnid valmis. Piir 25%, MH.</div>
        </button>
        <div className="text-[13px] text-muted">Teine klass? Küsi klassikaaslaselt jagamislinki või alusta tühjalt.</div>
      </Card>

      <Card className="gap-3">
        <h2 className="text-lg font-bold m-0">Alusta tühjalt</h2>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Kool</span>
          <select className="field" value={school} onChange={(e) => setSchool(e.target.value)}>
            {SCHOOLS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({fmtLimit(s.rule.limit)})
              </option>
            ))}
            <option value="custom">Muu kool</option>
          </select>
        </label>
        <div className="text-[13px] text-muted">Järgmisena lisad ained ja tunniplaani. Reeglit saad hiljem muuta.</div>
        <div>
          <Button variant="ghost" onClick={() => onDone(blankSetup(school))}>
            Seadista ise
          </Button>
        </div>
      </Card>
    </div>
  );
}
