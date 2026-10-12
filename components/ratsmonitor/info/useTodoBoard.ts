import { useCallback, useEffect, useRef, useState } from "react";
import { IS_DEV } from "../lib/tier";
import { normalizeTodoItem, type TodoData, type TodoItem, type TodoPersonId, type TodoResolution, type TodoStatus } from "../lib/todos";

export type TodoPatch = Partial<{
  text: string;
  hinweis: string;
  prio: 1 | 2 | 3;
  art: "code" | "extern";
  status: TodoStatus;
  abschluss: TodoResolution | null;
  bearbeiter: TodoPersonId | null;
  wartetAuf: string | null;
  reihenfolge: number;
  erledigt: boolean;
  faellig: string | null;
  erledigtAm: string | null;
}>;
export type TodoCreate = TodoItem & { kategorieId: string };
type Change = { id: string; patch: TodoPatch };
type Undo = { before: Change[]; after: Change[] };
type SaveState = "idle" | "saving" | "saved" | "error" | "conflict";
type State = {
  data: TodoData | null;
  updates: Record<string, TodoPatch>;
  creates: Record<string, TodoCreate>;
  saveState: SaveState;
  error: string;
  conflictFresh: boolean;
  undo: Undo[];
};

const ENDPOINT = IS_DEV ? "/__todos" : "/api/admin/todos";
const FIELDS: (keyof TodoPatch)[] = ["text", "hinweis", "prio", "art", "status", "abschluss", "bearbeiter", "wartetAuf", "reihenfolge", "erledigt", "faellig", "erledigtAm"];
const normalizedData = (data: TodoData): TodoData => ({ ...data, kategorien: data.kategorien.map((cat) => ({ ...cat, items: cat.items.map(normalizeTodoItem) })) });
const patchItem = (item: TodoItem, patch?: TodoPatch): TodoItem => normalizeTodoItem({ ...item, ...patch } as TodoItem);
const valueOf = (item: TodoItem, key: keyof TodoPatch): unknown => {
  if (key === "hinweis") return item.hinweis ?? "";
  if (key === "art") return item.art ?? "extern";
  if (key === "reihenfolge") return item.reihenfolge ?? 0;
  return item[key] ?? null;
};
const findSaved = (state: State, id: string) => state.data?.kategorien.flatMap((cat) => cat.items).find((item) => item.id === id);
const findCurrent = (state: State, id: string) => {
  const created = state.creates[id];
  if (created) return patchItem(created);
  const saved = findSaved(state, id);
  return saved ? patchItem(saved, state.updates[id]) : undefined;
};

function applyChanges(state: State, changes: Change[], remember: boolean, keepPending = false): State {
  const updates = { ...state.updates };
  const creates = { ...state.creates };
  const before: Change[] = [];
  const after: Change[] = [];
  for (const { id, patch } of changes) {
    const current = findCurrent(state, id);
    if (!current) continue;
    const inverse: TodoPatch = {};
    const actual: TodoPatch = {};
    for (const key of FIELDS) {
      if (key in patch && !Object.is(valueOf(current, key), patch[key])) {
        Object.assign(inverse, { [key]: valueOf(current, key) });
        Object.assign(actual, { [key]: patch[key] });
      }
    }
    if (!Object.keys(actual).length) continue;
    if (creates[id]) creates[id] = { ...patchItem(creates[id], actual), kategorieId: creates[id].kategorieId };
    else {
      const saved = findSaved(state, id)!;
      const combined = { ...updates[id], ...actual };
      if (!keepPending) for (const key of FIELDS) if (key in combined && Object.is(valueOf(saved, key), combined[key])) delete combined[key];
      if (Object.keys(combined).length) updates[id] = combined;
      else delete updates[id];
      before.push({ id, patch: inverse });
      after.push({ id, patch: actual });
    }
  }
  return { ...state, updates, creates, saveState: state.saveState === "saved" ? "idle" : state.saveState, undo: remember && before.length ? [...state.undo, { before, after }].slice(-20) : state.undo };
}

/** Serial saves remove only the fields sent in that request; edits made during a save remain pending. */
export function useTodoBoard() {
  const [state, setState] = useState<State>({ data: null, updates: {}, creates: {}, saveState: "idle", error: "", conflictFresh: false, undo: [] });
  const stateRef = useRef(state);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const update = useCallback((fn: (previous: State) => State) => {
    const next = fn(stateRef.current);
    stateRef.current = next;
    if (mounted.current) setState(next);
  }, []);

  const load = useCallback(async (preserveDrafts = false, signal?: AbortSignal) => {
    try {
      const response = await fetch(ENDPOINT, { cache: "no-store", signal });
      const body = await response.json() as Partial<TodoData> & { error?: string };
      if (!response.ok) throw new Error(body.error || "Die Aufgaben konnten nicht geladen werden.");
      if (!body.revision || !Array.isArray(body.kategorien)) throw new Error("Die Aufgaben wurden ohne gültigen Stand zurückgegeben.");
      if (!mounted.current || signal?.aborted) return;
      update((previous) => {
        const data = normalizedData(body as TodoData);
        const updates = preserveDrafts ? { ...previous.updates } : {};
        const creates = preserveDrafts ? { ...previous.creates } : {};
        // A successful create may have lost its response; recover it by its stable id.
        for (const [id, current] of Object.entries(creates)) {
          const saved = data.kategorien.flatMap((category) => category.items).find((item) => item.id === id);
          if (!saved) continue;
          const remaining: TodoPatch = {};
          for (const key of FIELDS) if (!Object.is(valueOf(current, key), valueOf(saved, key))) Object.assign(remaining, { [key]: valueOf(current, key) });
          delete creates[id];
          if (Object.keys(remaining).length) updates[id] = { ...remaining, ...updates[id] };
        }
        const pending = Object.keys(updates).length + Object.keys(creates).length;
        return { ...previous, data, updates, creates, undo: [], saveState: preserveDrafts && pending ? "conflict" : preserveDrafts ? "saved" : "idle", conflictFresh: preserveDrafts && !!pending, error: preserveDrafts && pending ? "Der aktuelle Stand ist geladen. Ihre Änderungen sind noch nicht gespeichert." : "" };
      });
    } catch (error) {
      if (signal?.aborted || !mounted.current) return;
      update((previous) => ({ ...previous, error: error instanceof Error && !(error instanceof TypeError) ? error.message : "Die Aufgaben konnten nicht geladen werden. Bitte erneut versuchen.", saveState: preserveDrafts ? "conflict" : "error" }));
    }
  }, [update]);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void load(false, controller.signal);
    return () => { mounted.current = false; controller.abort(); };
  }, [load]);

  const save = useCallback(async () => {
    const snapshot = stateRef.current;
    if (inFlight.current || !snapshot.data?.revision || (!Object.keys(snapshot.updates).length && !Object.keys(snapshot.creates).length)) return;
    if (snapshot.saveState === "conflict" && !snapshot.conflictFresh) return;
    inFlight.current = true;
    update((previous) => ({ ...previous, saveState: "saving", error: "" }));
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: snapshot.data.revision, updates: Object.entries(snapshot.updates).map(([id, patch]) => ({ id, ...patch })), creates: Object.values(snapshot.creates) }),
      });
      const body = await response.json().catch(() => ({})) as Partial<TodoData> & { error?: string };
      if (!response.ok) {
        update((previous) => ({ ...previous, saveState: response.status === 409 ? "conflict" : "error", conflictFresh: false, error: response.status === 409 ? "Die Aufgaben wurden inzwischen geändert. Ihre Änderungen bleiben hier erhalten." : body.error || "Speichern fehlgeschlagen. Ihre Änderungen bleiben hier erhalten." }));
        return;
      }
      if (!body.revision || !Array.isArray(body.kategorien)) throw new Error("Speichern konnte nicht bestätigt werden. Bitte den aktuellen Stand laden.");
      const savedData = normalizedData(body as TodoData);
      update((previous) => {
        const updates = { ...previous.updates };
        const creates = { ...previous.creates };
        for (const [id, sent] of Object.entries(snapshot.updates)) {
          const remaining = { ...updates[id] };
          for (const key of FIELDS) if (key in sent && Object.is(remaining[key], sent[key])) delete remaining[key];
          if (Object.keys(remaining).length) updates[id] = remaining;
          else delete updates[id];
        }
        for (const id of Object.keys(snapshot.creates)) {
          const current = creates[id];
          const saved = savedData.kategorien.flatMap((cat) => cat.items).find((item) => item.id === id);
          if (!saved || !current) continue;
          const remaining: TodoPatch = {};
          for (const key of FIELDS) if (!Object.is(valueOf(current, key), valueOf(saved, key))) Object.assign(remaining, { [key]: valueOf(current, key) });
          delete creates[id];
          if (Object.keys(remaining).length) updates[id] = { ...remaining, ...updates[id] };
        }
        return { ...previous, data: savedData, updates, creates, saveState: "saved", error: "", conflictFresh: false };
      });
    } catch (error) {
      update((previous) => ({ ...previous, saveState: "error", error: error instanceof Error && !(error instanceof TypeError) ? error.message : "Die Verbindung wurde unterbrochen. Ihre Änderungen bleiben hier erhalten." }));
    } finally {
      inFlight.current = false;
    }
  }, [update]);

  const dirty = Object.keys(state.updates).length + Object.keys(state.creates).length;
  useEffect(() => {
    if (!dirty || !state.data || state.saveState === "saving" || state.saveState === "error" || state.saveState === "conflict") return;
    const timeout = window.setTimeout(() => void save(), 450);
    return () => window.clearTimeout(timeout);
  }, [dirty, state.updates, state.creates, state.saveState, state.data, save]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const change = useCallback((changes: Change[]) => update((previous) => applyChanges(previous, changes, true, inFlight.current)), [update]);
  const create = useCallback((item: TodoCreate) => update((previous) => ({ ...previous, creates: { ...previous.creates, [item.id]: item }, saveState: previous.saveState === "saved" ? "idle" : previous.saveState })), [update]);
  const undo = useCallback(() => update((previous) => {
    const entry = previous.undo.at(-1);
    if (!entry) return previous;
    const matches = entry.after.every(({ id, patch }) => {
      const current = findCurrent(previous, id);
      return current && FIELDS.every((key) => !(key in patch) || Object.is(valueOf(current, key), patch[key]));
    });
    if (!matches) return { ...previous, error: "Diese Änderung kann nach dem neuen Stand nicht mehr rückgängig gemacht werden.", undo: [] };
    return { ...applyChanges(previous, entry.before, false, inFlight.current), undo: previous.undo.slice(0, -1) };
  }), [update]);

  const categories = state.data?.kategorien.map((cat) => ({ ...cat, items: [...cat.items.map((item) => patchItem(item, state.updates[item.id])), ...Object.values(state.creates).filter((item) => item.kategorieId === cat.id).map((item) => patchItem(item))] })) ?? [];
  return { ...state, categories, dirty, change, create, undo, save, load, canUndo: !!state.undo.length };
}
