import { useCallback, useEffect, useMemo, useState } from "react";
import { IS_DEV } from "../lib/tier";
import { fmtShort, localToday, todoState, type TodoData, type TodoItem, type TodoKind } from "../lib/todos";
import { PageHead } from "./blocks";
import { IconChevronDown } from "../components/icons";

type Edit = { erledigt: boolean; faellig: string | null };
type Filter = "alle" | "offen" | "ueberfaellig" | "erledigt";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "alle", label: "Alle" },
  { key: "offen", label: "Offen" },
  { key: "ueberfaellig", label: "Überfällig" },
  { key: "erledigt", label: "Erledigt" },
];

/* Überfällig bewusst als einzige Abweichung von der Textpalette (Rot wie bei Fehlermeldungen .ri-err) */
const STATE_COLOR: Record<TodoKind, string> = {
  done: "#0d9488",
  overdue: "#be123c",
  today: "#0f172a",
  soon: "#0f172a",
  planned: "#64748b",
  open: "#64748b",
};

const PRIO_COLOR: Record<1 | 2 | 3, string> = { 1: "#0f172a", 2: "#475569", 3: "#94a3b8" };

const CLOSED_KEY = "ratsmonitor:todo-closed:v1";
const readClosed = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(CLOSED_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

const sameEdit = (a: Edit, b: Edit) => a.erledigt === b.erledigt && a.faellig === b.faellig;

/** embedded: Inhalt im Adminbereich, ohne eigenen Seitenkopf */
export function TodoPage({ embedded = false }: { embedded?: boolean } = {}) {
  const [data, setData] = useState<TodoData | null>(null);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [filter, setFilter] = useState<Filter>("offen");
  const [q, setQ] = useState("");
  const [prio1, setPrio1] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [today] = useState(() => localToday());
  /* Eingeklappte Kategorien, im Browser gemerkt */
  const [closed, setClosed] = useState<string[]>([]);
  useEffect(() => setClosed(readClosed()), []);
  const setClosedSaved = (next: string[]) => {
    setClosed(next);
    try {
      localStorage.setItem(CLOSED_KEY, JSON.stringify(next));
    } catch {}
  };
  const toggleCat = (id: string) => setClosedSaved(closed.includes(id) ? closed.filter((x) => x !== id) : [...closed, id]);

  useEffect(() => {
    if (!IS_DEV) return;
    let cancelled = false;
    fetch("/__todos", { cache: "no-store" })
      .then(async (r) => {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        if (!r.ok) throw new Error(body.error || "Die Liste konnte nicht geladen werden.");
        return body as TodoData;
      })
      .then((d) => !cancelled && setData(d))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = Object.keys(edits).length;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const current = useCallback((item: TodoItem): TodoItem => ({ ...item, ...edits[item.id] }), [edits]);

  /** `saved` ist der gespeicherte Stand; eine Änderung zählt nur, solange sie davon abweicht */
  const change = (saved: TodoItem, patch: Partial<Edit>) => {
    setNote("");
    setEdits((prev) => {
      const base = prev[saved.id] ?? saved;
      const next: Edit = { erledigt: base.erledigt, faellig: base.faellig, ...patch };
      const rest = { ...prev };
      if (sameEdit(next, saved)) delete rest[saved.id];
      else rest[saved.id] = next;
      return rest;
    });
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setNote("");
    try {
      const updates = Object.entries(edits).map(([id, e]) => ({ id, erledigt: e.erledigt, faellig: e.faellig }));
      const r = await fetch("/__todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const body = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(body.error || "Das Speichern ist fehlgeschlagen.");
      setData(body as TodoData);
      setEdits({});
      setNote("Gespeichert.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Das Speichern ist fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  const all = useMemo(() => (data ? data.kategorien.flatMap((c) => c.items.map(current)) : []), [data, current]);
  const done = all.filter((i) => i.erledigt).length;
  const overdue = all.filter((i) => todoState(i, today).kind === "overdue").length;
  const counts: Record<Filter, number> = {
    alle: all.length,
    offen: all.length - done,
    ueberfaellig: overdue,
    erledigt: done,
  };
  const needle = q.trim().toLowerCase();

  const visible = (item: TodoItem) => {
    const kind = todoState(item, today).kind;
    const byFilter = filter === "alle" || (filter === "offen" && kind !== "done") || (filter === "ueberfaellig" && kind === "overdue") || (filter === "erledigt" && kind === "done");
    const byPrio = !prio1 || (item.prio === 1 && !item.erledigt);
    const byText = !needle || item.text.toLowerCase().includes(needle) || (item.hinweis ?? "").toLowerCase().includes(needle);
    return byFilter && byPrio && byText;
  };

  /* Termin schnell setzen: heute plus n Tage */
  const inDays = (n: number) => {
    const d = new Date(today + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };

  const pct = all.length ? Math.round((done / all.length) * 100) : 0;
  const pill = (active: boolean) =>
    "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[14px] transition-colors " +
    (active ? "border-teal-600 bg-teal-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900");

  return (
    <>
      {!embedded && (
        <PageHead
          icon="circleCheck"
          label="Intern"
          name="To-Do-Liste"
          lead="Alles, was vor dem Start noch zu tun ist. Abhaken, Termin eintragen und speichern; erledigte Einträge bleiben in der Liste."
        />
      )}
      <section className="ri-sec ri-sec--tight" style={embedded ? { padding: 0, border: 0 } : undefined}>
        {!IS_DEV ? (
          <p className="m-0 text-[16px] leading-relaxed text-slate-500">Diese Seite ist nur im lokalen Entwicklungsserver verfügbar.</p>
        ) : (
          <div className="max-w-[980px]">
            {error && (
              <p role="alert" className="ri-err" style={{ marginTop: 0, marginBottom: 18 }}>
                {error}
              </p>
            )}
            {!data && !error && <p className="m-0 text-[16px] text-slate-500">Lädt …</p>}
            {data && (
              <>
                {/* Fortschritt */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="m-0 text-[18px] text-slate-900">
                      <strong className="font-semibold">{done} von {all.length}</strong> erledigt
                      {overdue > 0 && <span className="ml-3 text-[15px] font-semibold" style={{ color: STATE_COLOR.overdue }}>{overdue} überfällig</span>}
                    </p>
                    <span className="text-[14px] text-slate-500">{pct} %</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Fortschritt">
                    <div className="h-full rounded-full bg-teal-600 transition-[width]" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {/* Werkzeugleiste: Suche, Filter, Alle ein-/ausklappen */}
                <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filter">
                  <input
                    type="search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Suchen …"
                    aria-label="In der Liste suchen"
                    className="ri-input"
                    style={{ width: 200, height: 36, fontSize: 14, marginRight: 4 }}
                  />
                  {FILTERS.map((f) => (
                    <button key={f.key} type="button" onClick={() => setFilter(f.key)} aria-pressed={filter === f.key} className={pill(filter === f.key)}>
                      {f.label}
                      <span className={"text-[12px] " + (filter === f.key ? "text-white/80" : "text-slate-400")}>{counts[f.key]}</span>
                    </button>
                  ))}
                  <button type="button" onClick={() => setPrio1((v) => !v)} aria-pressed={prio1} className={pill(prio1)} title="Nur offene Punkte mit Priorität 1 (vor dem Start nötig)">
                    Priorität 1
                  </button>
                  <button
                    type="button"
                    onClick={() => setClosedSaved(closed.length ? [] : data.kategorien.map((c) => c.id))}
                    className="ml-auto text-[14px] text-teal-600 hover:underline"
                  >
                    {closed.length ? "Alle ausklappen" : "Alle einklappen"}
                  </button>
                </div>

                {data.kategorien.map((cat) => {
                  const rows = cat.items.map((saved) => ({ saved, item: current(saved) }));
                  /* Offene nach Priorität (1 vor 2 vor 3), erledigte und ohne Priorität ans Ende */
                  const rank = (i: TodoItem) => (i.erledigt ? 9 : i.prio ?? 9);
                  const shown = rows.filter((r) => visible(r.item)).sort((a, b) => rank(a.item) - rank(b.item));
                  if (!shown.length) return null;
                  const catDone = rows.filter((r) => r.item.erledigt).length;
                  const catPct = rows.length ? (catDone / rows.length) * 100 : 0;
                  const isClosed = closed.includes(cat.id);
                  return (
                    <div key={cat.id} className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <h2 className="m-0">
                        <button
                          type="button"
                          onClick={() => toggleCat(cat.id)}
                          aria-expanded={!isClosed}
                          className="flex w-full items-center gap-3 bg-transparent px-5 py-4 text-left hover:bg-slate-50"
                        >
                          <IconChevronDown size={18} style={{ flex: "none", color: "#64748b", transition: "transform .15s", transform: isClosed ? "rotate(-90deg)" : "none" }} />
                          <span className="text-[18px] font-semibold text-slate-900">{cat.name}</span>
                          <span className="ml-auto flex items-center gap-3">
                            <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 sm:block"><span className="block h-full rounded-full bg-teal-600" style={{ width: `${catPct}%` }} /></span>
                            <span className="text-[14px] font-normal tabular-nums text-slate-500">{catDone}/{cat.items.length}</span>
                          </span>
                        </button>
                      </h2>
                      <ul hidden={isClosed} className="m-0 list-none p-0">
                        {shown.map(({ saved, item }) => {
                          const state = todoState(item, today);
                          const isDone = state.kind === "done";
                          const changed = !!edits[item.id];
                          return (
                            <li key={item.id} className="group flex flex-wrap items-start gap-x-5 gap-y-2 border-t border-slate-100 px-5 py-3.5" style={changed ? { background: "#f0fdfa" } : undefined}>
                              <label className="flex min-w-0 flex-[1_1_320px] cursor-pointer gap-3">
                                <input
                                  type="checkbox"
                                  checked={item.erledigt}
                                  onChange={(e) => change(saved, { erledigt: e.target.checked })}
                                  className="mt-[3px] h-[18px] w-[18px] flex-none"
                                  style={{ accentColor: "#0d9488" }}
                                />
                                <span className="min-w-0">
                                  <span className="block text-[16px] font-medium leading-snug" style={{ color: isDone ? "#94a3b8" : "#0f172a", textDecoration: isDone ? "line-through" : "none" }}>
                                    {item.text}
                                  </span>
                                  {item.hinweis && <span className="mt-0.5 block text-[14px] leading-snug text-slate-500">{item.hinweis}</span>}
                                </span>
                              </label>
                              <div className="flex flex-none flex-wrap items-center gap-2.5">
                                {item.prio && !isDone && (
                                  <span className="rounded-full px-2 py-0.5 text-[12px] font-semibold" style={{ background: item.prio === 1 ? "#0f172a" : "#f1f5f9", color: item.prio === 1 ? "#fff" : "#475569" }} title={`Priorität ${item.prio}`}>
                                    P{item.prio}
                                  </span>
                                )}
                                <span className="text-[13px]" style={{ fontWeight: state.kind === "overdue" ? 600 : 400, color: STATE_COLOR[state.kind] }}>{state.label}</span>
                                {!isDone && (
                                  <span className="hidden items-center gap-1 group-hover:flex group-focus-within:flex">
                                    {[["Heute", 0], ["+7", 7]].map(([label, n]) => (
                                      <button key={label} type="button" onClick={() => change(saved, { faellig: inDays(n as number) })} className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[12px] text-slate-600 hover:border-teal-600 hover:text-teal-600" title={n === 0 ? "Heute fällig" : "In 7 Tagen fällig"}>
                                        {label}
                                      </button>
                                    ))}
                                  </span>
                                )}
                                <input
                                  type="date"
                                  className="ri-input"
                                  aria-label={`Geplant für: ${item.text}`}
                                  title={item.faellig ? `Geplant für ${fmtShort(item.faellig)}` : "Datum eintragen"}
                                  value={item.faellig ?? ""}
                                  onChange={(e) => change(saved, { faellig: e.target.value || null })}
                                  style={{ width: 150, height: 34, fontSize: 14 }}
                                />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
                {all.length > 0 && !data.kategorien.some((c) => c.items.some((i) => visible(current(i)))) && (
                  <p className="mt-6 text-[16px] text-slate-500">Nichts gefunden. Filter oder Suche anpassen.</p>
                )}
              </>
            )}
          </div>
        )}
      </section>
      {IS_DEV && data && (
        <div style={{ position: "sticky", bottom: 0, zIndex: 20, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 16, padding: "14px var(--ri-pad)", background: "#fff", borderTop: "1px solid #e2e8f0" }}>
          <button type="button" className="ri-btn ri-btn--dark" onClick={save} disabled={!dirty || saving} style={!dirty || saving ? { opacity: 0.45, cursor: "default" } : undefined}>
            {saving ? "Speichert …" : "Speichern"}
          </button>
          <span style={{ fontSize: 14, color: "#64748b" }} aria-live="polite">
            {dirty ? `${dirty} ungespeicherte ${dirty === 1 ? "Änderung" : "Änderungen"}` : note}
          </span>
        </div>
      )}
    </>
  );
}
