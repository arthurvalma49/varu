import { useState } from "react";
import { inWindow } from "../core/calc";
import { parsePaste, toAbsences, type ParsedLine } from "../core/importer";
import type { Absence, Setup } from "../core/types";
import { Button, Card, Empty, fmtDate, tunde } from "./kit";

export function History({
  setup,
  absences,
  now,
  onRemove,
  onImport,
}: {
  setup: Setup;
  absences: Absence[];
  now: string;
  onRemove: (id: string) => void;
  onImport: (a: Absence[]) => void;
}) {
  const [importOpen, setImportOpen] = useState(false);
  const name = (id: string) => setup.subjects.find((s) => s.id === id)?.name ?? id;
  const tracked = (id: string) => setup.subjects.find((s) => s.id === id)?.tracked ?? false;
  const list = [...absences].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const sum = (e: Absence) => Object.values(e.lessons).reduce((x, n) => x + n, 0);
  const done = list.filter((e) => inWindow(setup, e.date) && e.date <= now).reduce((s, e) => s + sum(e), 0);
  const planned = list.filter((e) => inWindow(setup, e.date) && e.date > now).reduce((s, e) => s + sum(e), 0);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="num">
            <div className="font-display font-bold text-xl">{tunde(done)} puudutud</div>
            <div className="text-sm text-muted">
              {setup.windowName}
              {planned > 0 && ` · ${tunde(planned)} plaanis`}
            </div>
          </div>
          <Button variant="ghost" onClick={() => setImportOpen((v) => !v)} aria-expanded={importOpen}>
            {importOpen ? "Sulge import" : "Kleebi Stuudiumist / eKoolist"}
          </Button>
        </div>
        {importOpen && (
          <PasteImport
            setup={setup}
            existingDates={new Set(absences.map((a) => a.date))}
            onImport={(a) => {
              onImport(a);
              setImportOpen(false);
            }}
          />
        )}
      </Card>

      <Card className="gap-0">
        {!list.length ? (
          <Empty title="Sissekandeid pole veel">Märgi puudumine vaates „Lisa“ või kleebi nimekiri oma e-koolist.</Empty>
        ) : (
          list.map((e, i) => {
            const counts = inWindow(setup, e.date);
            const plan = e.date > now;
            return (
              <div key={e.id} className={`grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 items-center py-3 ${i ? "border-t border-line" : "pt-0"}`}>
                <div className="num font-display font-bold flex items-center gap-2 flex-wrap">
                  {fmtDate(e.date, true)}
                  {plan && counts && <span className="text-xs font-body font-bold text-accent border border-dashed border-accent/60 rounded-full px-2 py-0.5">plaan</span>}
                  {!counts && <span className="text-xs font-body font-normal text-muted">ei lähe arvesse</span>}
                </div>
                <Button variant="quiet" className="px-2 text-sm font-normal row-start-1 col-start-2" onClick={() => onRemove(e.id)} aria-label={`Kustuta ${fmtDate(e.date)}`}>
                  Kustuta
                </Button>
                <div className="min-w-0 col-span-2">
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(e.lessons).map(([id, n]) => (
                      <span
                        key={id}
                        className={`text-[13px] px-2 py-0.5 rounded-full ${counts && tracked(id) && !plan ? "bg-accent-soft" : "border border-dashed border-line text-muted"}`}
                      >
                        {name(id)} ×{n}
                      </span>
                    ))}
                  </div>
                  {e.note && <div className="text-sm text-muted mt-1">{e.note}</div>}
                </div>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}

function PasteImport({ setup, existingDates, onImport }: { setup: Setup; existingDates: Set<string>; onImport: (a: Absence[]) => void }) {
  const [text, setText] = useState("");
  const parsed: ParsedLine[] = text.trim() ? parsePaste(setup, text) : [];
  const ok = parsed.filter((l) => l.ok);
  const bad = parsed.filter((l) => !l.ok);
  const dupes = [...new Set(ok.map((l) => l.date!))].filter((d) => existingDates.has(d));
  const name = (id: string) => setup.subjects.find((s) => s.id === id)?.name ?? id;

  return (
    <div className="flex flex-col gap-2 fade-in">
      <div className="text-sm text-muted">
        Kopeeri puudumiste nimekiri ja kleebi siia, üks tund rea kohta. Sobib nt <span className="text-ink">12.11 Matemaatika 2 tundi</span> või
        kuupäev eraldi real ja ained selle all.
      </div>
      <textarea
        className="field py-2.5 min-h-32 font-mono text-sm"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"12.11.2026 Matemaatika 2 tundi\n13.11\nFüüsika\nKeemia"}
        aria-label="Kleebitud puudumised"
      />
      {parsed.length > 0 && (
        <div className="flex flex-col gap-1 text-sm">
          <div className="font-bold">
            Leidsin {ok.length} rida{bad.length ? `, ${bad.length} jäi vahele` : ""}.
          </div>
          {ok.slice(0, 8).map((l, i) => (
            <div key={i} className="num text-muted">
              {fmtDate(l.date!)} · {name(l.subjectId!)} ×{l.count}
            </div>
          ))}
          {ok.length > 8 && <div className="text-muted">… ja veel {ok.length - 8}</div>}
          {bad.slice(0, 4).map((l, i) => (
            <div key={i} className="text-bad truncate">
              „{l.raw}”: {l.reason}
            </div>
          ))}
          {dupes.length > 0 && (
            <div className="text-warn">Nendel päevadel on juba sissekanne: {dupes.map((d) => fmtDate(d)).join(", ")}. Kontrolli, et ei lisaks topelt.</div>
          )}
        </div>
      )}
      <div>
        <Button disabled={!ok.length} onClick={() => onImport(toAbsences(ok))}>
          Impordi {ok.reduce((s, l) => s + l.count, 0) || ""} {ok.reduce((s, l) => s + l.count, 0) === 1 ? "tund" : "tundi"}
        </Button>
      </div>
    </div>
  );
}
