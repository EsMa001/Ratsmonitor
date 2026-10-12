/** Interne To-Do-Liste (Daten: docs/todo/todos.json; auf dem Server mit Änderungen aus der Datenbank) */
export type TodoStatus = "backlog" | "ready" | "doing" | "review" | "done";
export type TodoPersonId = "max" | "nico";
export type TodoResolution = "done" | "wont_do" | "duplicate";
export type TodoPriority = 1 | 2 | 3;
export type TodoSubtask = { id: string; text: string; erledigt: boolean };
export const TODO_STATUSES: { id: TodoStatus; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "ready", label: "Bereit" },
  { id: "doing", label: "In Arbeit" },
  { id: "review", label: "Prüfung / Freigabe" },
  { id: "done", label: "Geschlossen" },
];
export const TODO_PRIORITIES: { id: TodoPriority; label: string }[] = [
  { id: 1, label: "Hoch" },
  { id: 2, label: "Mittel" },
  { id: 3, label: "Niedrig" },
];
export const TODO_RESOLUTIONS: { id: TodoResolution; label: string }[] = [
  { id: "done", label: "Erledigt" },
  { id: "wont_do", label: "Wird nicht umgesetzt" },
  { id: "duplicate", label: "Duplikat" },
];
export const TODO_PEOPLE: { id: TodoPersonId; name: string; initials: string }[] = [
  { id: "max", name: "Max", initials: "M" },
  { id: "nico", name: "Nico", initials: "N" },
];

export type TodoItem = {
  id: string;
  text: string;
  hinweis?: string;
  /** Jede Aufgabe hat eine Priorität: 1 hoch, 2 mittel, 3 niedrig. */
  prio?: TodoPriority;
  /** Art: „code“ = im Repo umsetzbar, „extern“ = Handlung außerhalb des Codes */
  art?: "code" | "extern";
  erledigt: boolean;
  /** Geplanter Start, ISO „JJJJ-MM-TT“. */
  startDatum?: string | null;
  /** Geplantes Enddatum; bestehende Termine bleiben erhalten. */
  faellig: string | null;
  unteraufgaben?: TodoSubtask[];
  /** Tag, an dem der Eintrag abgehakt und gespeichert wurde */
  erledigtAm: string | null;
  status?: TodoStatus;
  abschluss?: TodoResolution | null;
  bearbeiter?: TodoPersonId | null;
  wartetAuf?: string | null;
  reihenfolge?: number;
};
export type TodoCategory = { id: string; name: string; items: TodoItem[] };
export type TodoData = { version: number; kategorien: TodoCategory[]; revision?: string };

export function taskStatus(item: Pick<TodoItem, "status" | "erledigt">): TodoStatus {
  return TODO_STATUSES.some(status => status.id === item.status) ? item.status! : item.erledigt ? "done" : "backlog";
}

export function todoPriority(item: Pick<TodoItem, "prio">): TodoPriority {
  return TODO_PRIORITIES.some(priority => priority.id === item.prio) ? item.prio! : 2;
}

export function taskResolution(item: Pick<TodoItem, "status" | "erledigt" | "abschluss">): TodoResolution | null {
  if (taskStatus(item) !== "done") return null;
  return TODO_RESOLUTIONS.some(resolution => resolution.id === item.abschluss) ? item.abschluss! : "done";
}

export function normalizeTodoItem(item: TodoItem): TodoItem {
  const status = taskStatus(item);
  return {
    ...item,
    status,
    prio: todoPriority(item),
    abschluss: taskResolution(item),
    bearbeiter: TODO_PEOPLE.some(person => person.id === item.bearbeiter) ? item.bearbeiter : null,
    wartetAuf: item.wartetAuf || null,
    reihenfolge: Number.isFinite(item.reihenfolge) ? item.reihenfolge : 0,
    faellig: item.faellig ?? null,
    startDatum: item.startDatum ?? null,
    unteraufgaben: item.unteraufgaben ?? [],
    erledigt: status === "done",
    erledigtAm: status === "done" ? item.erledigtAm ?? null : null,
  };
}

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
export function todoState(item: Pick<TodoItem, "status" | "abschluss" | "erledigt" | "startDatum" | "faellig" | "erledigtAm">, today: string): TodoState {
  if (taskStatus(item) === "done") {
    const label = TODO_RESOLUTIONS.find(resolution => resolution.id === taskResolution(item))!.label;
    return { kind: "done", label: item.erledigtAm ? `${label} · Geschlossen am ${fmtShort(item.erledigtAm)}` : label };
  }
  if (!item.faellig) return item.startDatum ? { kind: "planned", label: `Start am ${fmtShort(item.startDatum)}` } : { kind: "open", label: "Ohne Termin" };
  const diff = daysBetween(today, item.faellig);
  if (diff < 0) return { kind: "overdue", label: `Überfällig seit ${days(-diff)}` };
  if (diff === 0) return { kind: "today", label: "Heute fällig" };
  if (diff <= 7) return { kind: "soon", label: `Fällig in ${days(diff)}` };
  return { kind: "planned", label: `Geplant für ${fmtShort(item.faellig)}` };
}
