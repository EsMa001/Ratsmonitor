import { useCallback, useEffect, useMemo, useState } from "react";
import { IS_DEV } from "../lib/tier";
import { fmtShort, localToday, todoState, type TodoData, type TodoItem, type TodoKind } from "../lib/todos";
import { PageHead } from "./blocks";

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

const sameEdit = (a: Edit, b: Edit) => a.erledigt === b.erledigt && a.faellig === b.faellig;

export function TodoPage() {
  const [data, setData] = useState<TodoData | null>(null);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [filter, setFilter] = useState<Filter>("alle");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [today] = useState(() => localToday());

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

  const visible = (item: TodoItem) => {
    const kind = todoState(item, today).kind;
    return filter === "alle" || (filter === "offen" && kind !== "done") || (filter === "ueberfaellig" && kind === "overdue") || (filter === "erledigt" && kind === "done");
  };

  return (
    <>
      <PageHead
        icon="circleCheck"
        label="Intern"
        name="To-Do-Liste"
        lead="Alles, was vor dem Start noch zu tun ist. Abhaken, Termin eintragen und speichern; erledigte Einträge bleiben in der Liste."
      />
      <section className="ri-sec ri-sec--tight">
        {!IS_DEV ? (
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: "#64748b" }}>Diese Seite ist nur im lokalen Entwicklungsserver verfügbar.</p>
        ) : (
          <div style={{ maxWidth: 960 }}>
            {error && (
              <p role="alert" className="ri-err" style={{ marginTop: 0, marginBottom: 18 }}>
                {error}
              </p>
            )}
            {!data && !error && <p style={{ margin: 0, fontSize: 16, color: "#64748b" }}>Lädt …</p>}
            {data && (
              <>
                <p style={{ margin: "0 0 14px", fontSize: 18, lineHeight: 1.5, color: "#0f172a" }}>
                  <strong style={{ fontWeight: 600 }}>
                    {done} von {all.length}
                  </strong>{" "}
                  erledigt
                  {overdue > 0 && (
                    <>
                      {" · "}
                      <span style={{ color: STATE_COLOR.overdue, fontWeight: 600 }}>{overdue} überfällig</span>
                    </>
                  )}
                </p>
                <div role="group" aria-label="Filter" style={{ display: "flex", flexWrap: "wrap", gap: 18, marginBottom: 8 }}>
                  {FILTERS.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setFilter(f.key)}
                      aria-pressed={filter === f.key}
                      style={{
                        padding: "4px 0",
                        border: 0,
                        borderBottom: `2px solid ${filter === f.key ? "#0d9488" : "transparent"}`,
                        background: "none",
                        font: "inherit",
                        fontSize: 16,
                        fontWeight: filter === f.key ? 600 : 400,
                        color: filter === f.key ? "#0f172a" : "#64748b",
                        cursor: "pointer",
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                {data.kategorien.map((cat) => {
                  const rows = cat.items.map((saved) => ({ saved, item: current(saved) }));
                  const shown = rows.filter((r) => visible(r.item));
                  if (!shown.length) return null;
                  const catDone = rows.filter((r) => r.item.erledigt).length;
                  return (
                    <div key={cat.id} style={{ marginTop: 40 }}>
                      <h2 style={{ margin: "0 0 4px", fontSize: 22, lineHeight: 1.3, fontWeight: 600, color: "#0f172a" }}>
                        {cat.name} <span style={{ fontSize: 16, fontWeight: 400, color: "#64748b" }}>{catDone}/{cat.items.length}</span>
                      </h2>
                      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                        {shown.map(({ saved, item }) => {
                          const state = todoState(item, today);
                          const isDone = state.kind === "done";
                          return (
                            <li key={item.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "10px 24px", padding: "14px 0", borderTop: "1px solid #eef1f4" }}>
                              <label style={{ display: "flex", flex: "1 1 320px", gap: 12, cursor: "pointer", minWidth: 0 }}>
                                <input
                                  type="checkbox"
                                  checked={item.erledigt}
                                  onChange={(e) => change(saved, { erledigt: e.target.checked })}
                                  style={{ width: 18, height: 18, margin: "3px 0 0", accentColor: "#0d9488", flex: "none" }}
                                />
                                <span style={{ minWidth: 0 }}>
                                  <span style={{ display: "block", fontSize: 16, lineHeight: 1.5, fontWeight: 500, color: isDone ? "#64748b" : "#0f172a", textDecoration: isDone ? "line-through" : "none" }}>
                                    {item.text}
                                  </span>
                                  {item.hinweis && <span style={{ display: "block", marginTop: 2, fontSize: 14, lineHeight: 1.5, color: "#64748b" }}>{item.hinweis}</span>}
                                </span>
                              </label>
                              <div style={{ display: "flex", flex: "0 0 auto", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 14, fontWeight: state.kind === "overdue" ? 600 : 400, color: STATE_COLOR[state.kind] }}>{state.label}</span>
                                <input
                                  type="date"
                                  className="ri-input"
                                  aria-label={`Geplant für: ${item.text}`}
                                  title={item.faellig ? `Geplant für ${fmtShort(item.faellig)}` : "Datum eintragen"}
                                  value={item.faellig ?? ""}
                                  onChange={(e) => change(saved, { faellig: e.target.value || null })}
                                  style={{ width: 168, height: 38, fontSize: 14 }}
                                />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
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
