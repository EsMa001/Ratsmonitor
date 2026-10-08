/** Interne To-Do-Liste (Daten: docs/todo/todos.json, nur im lokalen Dev-Server verfügbar) */
export type TodoItem = {
  id: string;
  text: string;
  hinweis?: string;
  erledigt: boolean;
  /** geplantes Datum, ISO „JJJJ-MM-TT“ */
  faellig: string | null;
  /** Tag, an dem der Eintrag abgehakt und gespeichert wurde */
  erledigtAm: string | null;
};
export type TodoCategory = { id: string; name: string; items: TodoItem[] };
export type TodoData = { version: number; kategorien: TodoCategory[] };

export type TodoKind = "done" | "overdue" | "today" | "soon" | "planned" | "open";
export type TodoState = { kind: TodoKind; label: string };

/** Heutiges Datum des Browsers als „JJJJ-MM-TT“ */
export function localToday(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** „2026-10-05“ → „05.10.26“ */
export function fmtShort(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y.slice(2)}`;
}

const DAY = 86_400_000;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / DAY);
/* Dativ: „seit 1 Tag“, „seit 7 Tagen“, „in 3 Tagen“ */
const days = (n: number) => (n === 1 ? "1 Tag" : `${n} Tagen`);

/** Status eines Eintrags: erledigt, überfällig, heute fällig, bald (bis 7 Tage), geplant oder ohne Termin */
export function todoState(item: Pick<TodoItem, "erledigt" | "faellig" | "erledigtAm">, today: string): TodoState {
  if (item.erledigt) return { kind: "done", label: item.erledigtAm ? `Erledigt am ${fmtShort(item.erledigtAm)}` : "Erledigt" };
  if (!item.faellig) return { kind: "open", label: "Ohne Termin" };
  const diff = daysBetween(today, item.faellig);
  if (diff < 0) return { kind: "overdue", label: `Überfällig seit ${days(-diff)}` };
  if (diff === 0) return { kind: "today", label: "Heute fällig" };
  if (diff <= 7) return { kind: "soon", label: `Fällig in ${days(diff)}` };
  return { kind: "planned", label: `Geplant für ${fmtShort(item.faellig)}` };
}
