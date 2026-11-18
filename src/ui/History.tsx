import { useState } from "react";
import { inWindow } from "../core/calc";
import { parsePaste, toAbsences, type ParsedLine } from "../core/importer";
import type { Absence, Setup } from "../core/types";
import { Button, Card, Empty, Icon, MON_LONG, Row, Section, Sheet, Stepper, SwipeRow, cap, fmtDate, tunde } from "./kit";

export function History({
  setup,
  absences,
  now,
  onRemove,
  onUpdate,
  onImport,
  onAdd,
}: {
  setup: Setup;
  absences: Absence[];
  now: string;
  onRemove: (id: string) => void;
  onUpdate: (id: string, lessons: Record<string, number>) => void;
  onImport: (a: Absence[]) => void;
  /** Opens the Lisa sheet (from the empty state). */
  onAdd: () => void;
}) {
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; lessons: Record<string, number> } | null>(null);
  const name = (id: string) => setup.subjects.find((s) => s.id === id)?.name ?? id;
  const list = [...absences].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const sum = (e: Absence) => Object.values(e.lessons).reduce((x, n) => x + n, 0);
  const done = list.filter((e) => inWindow(setup, e.date) && e.date <= now).reduce((s, e) => s + sum(e), 0);
  const planned = list.filter((e) => inWindow(setup, e.date) && e.date > now).reduce((s, e) => s + sum(e), 0);

  // Group by month, newest first.
  const months: { key: string; items: Absence[] }[] = [];
  for (const e of list) {
    const key = e.date.slice(0, 7);
    const last = months[months.length - 1];
    if (last?.key === key) last.items.push(e);
    else months.push({ key, items: [e] });
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="grid grid-cols-2 gap-3">
        <Card className="gap-0.5">
          <span className="text-[13px] text-muted">Puudutud</span>
          <b className="num text-[28px] leading-[34px] font-bold">{done}</b>
          <span className="text-[13px] text-muted">tundi sel perioodil</span>
        </Card>
        <Card className="gap-0.5">
          <span className="text-[13px] text-muted">Plaanis</span>
          <b className={`num text-[28px] leading-[34px] font-bold ${planned ? "text-accent" : "text-muted"}`}>{planned}</b>
          <span className="text-[13px] text-muted">tundi ees ootamas</span>
        </Card>
      </div>

      <Section>
        <Row onClick={() => setImportOpen((v) => !v)} chevron={!importOpen}>
          <span className="text-accent">{importOpen ? "Sulge import" : "Kleebi Stuudiumist või eKoolist"}</span>
        </Row>
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
      </Section>

      {!list.length ? (
        <Card>
          <Empty
            title="Puhas leht"
            icon="tray"
            action={
              <Button variant="ghost" onClick={onAdd}>
                Lisa puudumine
              </Button>
            }
          >
            Siia tulevad sinu puudumised. Märgi need vaates „Täna”, + nupuga või kleebi nimekiri oma e-koolist.
          </Empty>
        </Card>
      ) : (
        months.map((m) => {
          const [y, mo] = m.key.split("-").map(Number);
          return (
            <Section key={m.key} title={`${cap(MON_LONG[mo - 1])} ${y}`}>
              {m.items.map((e) => {
                const counts = inWindow(setup, e.date);
                const plan = e.date > now;
                return (
                  <SwipeRow
                    key={e.id}
                    actions={[
                      { label: "Muuda", icon: "pencil", tone: "gray", onClick: () => setEditing({ id: e.id, lessons: { ...e.lessons } }) },
                      { label: "Kustuta", icon: "trash", tone: "red", onClick: () => onRemove(e.id) },
                    ]}
                  >
                    <button
                      type="button"
                      onClick={() => setEditing({ id: e.id, lessons: { ...e.lessons } })}
                      className="press w-full flex items-center gap-3 px-5 py-3 text-left cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="num font-semibold">{fmtDate(e.date)}</span>
                          {plan && counts && <span className="text-[12px] font-semibold text-accent bg-accent-soft rounded-full px-2 py-0.5">Plaan</span>}
                          {!counts && <span className="text-[12px] text-muted">ei lähe arvesse</span>}
                        </div>
                        <div className="text-[15px] text-muted truncate">
                          {Object.entries(e.lessons)
                            .map(([id, n]) => `${name(id)}${n > 1 ? ` ×${n}` : ""}`)
                            .join(", ")}
                        </div>
                        {e.note && <div className="text-[13px] text-muted mt-0.5 truncate">{e.note}</div>}
                      </div>
                      <span className="num text-muted shrink-0">{tunde(sum(e))}</span>
                      <span className="text-faint shrink-0">
                        <Icon name="right" size={18} stroke={2.4} />
                      </span>
                    </button>
                  </SwipeRow>
                );
              })}
            </Section>
          );
        })
      )}
      <Sheet
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? fmtDate(absences.find((a) => a.id === editing.id)?.date ?? "") : ""}
        trailing={
          <button
            type="button"
            className="text-accent font-semibold text-[17px] min-h-11 pl-3 cursor-pointer"
            onClick={() => {
              if (!editing) return;
              if (Object.values(editing.lessons).some((n) => n > 0)) onUpdate(editing.id, editing.lessons);
              else onRemove(editing.id);
              setEditing(null);
            }}
          >
            Valmis
          </button>
        }
      >
        {editing && (
          <>
            <Section title="Tunnid" info="Muuda, mitu tundi igas aines puudusid. 0 eemaldab aine sellest sissekandest.">
              {Object.keys(editing.lessons).map((id) => (
                <div key={id} className="cell flex items-center justify-between gap-3 px-5 min-h-[56px]">
                  <span className="min-w-0 truncate">{name(id)}</span>
                  <Stepper label={name(id)} max={12} value={editing.lessons[id] ?? 0} onChange={(n) => setEditing({ ...editing, lessons: { ...editing.lessons, [id]: n } })} />
                </div>
              ))}
            </Section>
            <Section>
              <Row
                onClick={() => {
                  onRemove(editing.id);
                  setEditing(null);
                }}
              >
                <span className="text-bad">Kustuta sissekanne</span>
              </Row>
            </Section>
          </>
        )}
      </Sheet>
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
  const n = ok.reduce((s, l) => s + l.count, 0);

  return (
    <div className="cell px-5 pt-2 pb-4 flex flex-col gap-3 fade-in">
      <div className="text-[13px] text-muted">
        Üks tund rea kohta. Sobib nt <span className="text-ink">12.11 Matemaatika 2 tundi</span> või kuupäev eraldi real ja ained selle all.
      </div>
      <textarea
        className="field py-2.5 min-h-32 font-mono text-[16px] rounded-[16px]"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"12.11.2026 Matemaatika 2 tundi\n13.11\nFüüsika\nKeemia"}
        aria-label="Kleebitud puudumised"
      />
      {parsed.length > 0 && (
        <div className="flex flex-col gap-1 text-[15px]">
          <div className="font-semibold">
            Leidsin {ok.length} rida{bad.length ? `, ${bad.length} jäi vahele` : ""}.
          </div>
          {ok.slice(0, 8).map((l, i) => (
            <div key={i} className="num text-muted">
              {fmtDate(l.date!)} · {name(l.subjectId!)} ×{l.count}
            </div>
          ))}
          {ok.length > 8 && <div className="text-muted">ja veel {ok.length - 8}</div>}
          {bad.slice(0, 4).map((l, i) => (
            <div key={i} className="text-bad truncate">
              „{l.raw}”: {l.reason}
            </div>
          ))}
          {dupes.length > 0 && <div className="text-warn">Nendel päevadel on juba sissekanne: {dupes.map((d) => fmtDate(d)).join(", ")}. Kontrolli, et ei lisaks topelt.</div>}
        </div>
      )}
      <Button disabled={!ok.length} onClick={() => onImport(toAbsences(ok))} className="self-start">
        Impordi {n || ""} {n === 1 ? "tund" : "tundi"}
      </Button>
    </div>
  );
}
