import { useState, type DragEvent } from "react";
import { ArrowRight, Check, ChevronDown, CircleAlert, Clock3, GripVertical, ListChecks, LayoutList, LoaderCircle, RefreshCw, Search, Undo2 } from "lucide-react";
import { TODO_PEOPLE, TODO_PRIORITIES, TODO_RESOLUTIONS, TODO_STATUSES, fmtShort, localToday, taskResolution, taskStatus, todoPriority, todoState, type TodoItem, type TodoPersonId, type TodoResolution, type TodoStatus } from "../lib/todos";
import { PageHead } from "./blocks";
import { TodoChoice, TodoEditor, TodoOrder, TodoOwner, TodoPriorityChoice, TodoStatusChoice } from "./TodoControls";
import { useTodoBoard, type TodoPatch } from "./useTodoBoard";

type View = "list" | "board";
type Swimlane = "work" | "person" | "none";
type BacklogScope = "backlog" | "all" | "open" | "done";
type DueFilter = "all" | "overdue" | "today" | "undated";
type ResolutionFilter = "all" | "open" | TodoResolution;
type Entry = { item: TodoItem; categoryId: string; category: string; index: number };
type Lane = { id: string; name: string };

const BOARD_STATUSES = TODO_STATUSES.filter((status) => status.id !== "backlog");
const WORK_LANES: Lane[] = [{ id: "tech", name: "Technik & Produkt" }, { id: "market", name: "Markt & Auftritt" }, { id: "company", name: "Unternehmen & Betrieb" }];
const CLOSED_KEY = "ratsmonitor:todo-closed:v1";
const workLane = (category: string) => ["frontend", "backend", "produkt", "ideen"].includes(category) ? "tech" : ["marketing", "marke"].includes(category) ? "market" : "company";
const order = (a: Entry, b: Entry) => (a.item.reihenfolge ?? a.index) - (b.item.reihenfolge ?? b.index) || a.index - b.index;
const recentDone = (item: TodoItem, today: string) => {
  if (taskStatus(item) !== "done" || !item.erledigtAm) return false;
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${item.erledigtAm}T00:00:00Z`)) / 86_400_000);
  return days >= 0 && days < 14;
};
const completionPatch = (item: TodoItem, status: TodoStatus, today: string, resolution?: TodoResolution): TodoPatch => ({ status, erledigt: status === "done", abschluss: status === "done" ? resolution ?? taskResolution(item) ?? "done" : null, erledigtAm: status === "done" ? taskStatus(item) === "done" ? item.erledigtAm : today : null });

/** Both views edit the same persisted tasks; the list opens first, the Kanban board only on request. */
export function TodoPage({ embedded = false }: { embedded?: boolean } = {}) {
  const store = useTodoBoard();
  const [view, setView] = useState<View>("list");
  const [swimlane, setSwimlane] = useState<Swimlane>("work");
  const [scope, setScope] = useState<BacklogScope>("open");
  const [query, setQuery] = useState("");
  const [personFilter, setPersonFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [resolutionFilter, setResolutionFilter] = useState<ResolutionFilter>("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");
  const [waitingFilter, setWaitingFilter] = useState(false);
  const [mobileStatus, setMobileStatus] = useState<TodoStatus>("ready");
  const [closed, setClosed] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const value: unknown = JSON.parse(localStorage.getItem(CLOSED_KEY) || "[]");
      return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    } catch { return []; }
  });
  const [editor, setEditor] = useState<{ id?: string; categoryId: string; returnFocus: HTMLElement | null } | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [today] = useState(localToday);

  const changeClosed = (next: string[]) => {
    setClosed(next);
    try { localStorage.setItem(CLOSED_KEY, JSON.stringify(next)); } catch {}
  };

  let position = 0;
  const entries: Entry[] = store.categories.flatMap((category) => category.items.map((item) => ({ item, categoryId: category.id, category: category.name, index: position++ })));
  const board = entries.filter(({ item }) => taskStatus(item) !== "backlog" && (taskStatus(item) !== "done" || recentDone(item, today)));
  const unfinished = entries.filter(({ item }) => taskStatus(item) !== "done");
  const backlogCount = entries.filter(({ item }) => taskStatus(item) === "backlog").length;
  const overdue = entries.filter(({ item }) => todoState(item, today).kind === "overdue").length;
  const needle = query.trim().toLocaleLowerCase("de-DE");
  const matches = ({ item, category }: Entry) => {
    if (personFilter !== "all" && (item.bearbeiter ?? "unassigned") !== personFilter) return false;
    if (priorityFilter !== "all" && String(todoPriority(item)) !== priorityFilter) return false;
    const resolution = taskResolution(item);
    if (resolutionFilter !== "all" && (resolutionFilter === "open" ? resolution !== null : resolution !== resolutionFilter)) return false;
    if (kindFilter !== "all" && (item.art ?? "extern") !== kindFilter) return false;
    if (waitingFilter && !item.wartetAuf) return false;
    const due = todoState(item, today).kind;
    if (dueFilter === "overdue" && due !== "overdue") return false;
    if (dueFilter === "today" && due !== "today") return false;
    if (dueFilter === "undated" && (item.faellig || item.startDatum)) return false;
    return !needle || [item.text, item.hinweis, ...(item.unteraufgaben ?? []).map(subtask => subtask.text), item.wartetAuf, category, item.id, TODO_PEOPLE.find((person) => person.id === item.bearbeiter)?.name].filter(Boolean).join(" ").toLocaleLowerCase("de-DE").includes(needle);
  };
  const group = (entry: Entry) => swimlane === "work" ? workLane(entry.categoryId) : swimlane === "person" ? entry.item.bearbeiter ?? "unassigned" : "all";
  const lanes: Lane[] = swimlane === "work" ? WORK_LANES : swimlane === "person" ? [...TODO_PEOPLE.map((person) => ({ id: person.id, name: person.name })), { id: "unassigned", name: "Nicht zugewiesen" }] : [{ id: "all", name: "Aktuelle Aufgaben" }];
  const shownBoard = board.filter(matches);
  const hasFilters = !!needle || personFilter !== "all" || priorityFilter !== "all" || resolutionFilter !== "all" || kindFilter !== "all" || dueFilter !== "all" || waitingFilter;
  const changeResolutionFilter = (value: string) => {
    const next = value as ResolutionFilter;
    setResolutionFilter(next);
    if (TODO_RESOLUTIONS.some((resolution) => resolution.id === next)) {
      setScope("done");
      setMobileStatus("done");
    } else if (next === "open" && scope === "done") {
      setScope("open");
      setMobileStatus("ready");
    }
  };
  const resetFilters = () => { setQuery(""); setPersonFilter("all"); setPriorityFilter("all"); setResolutionFilter("all"); setKindFilter("all"); setDueFilter("all"); setWaitingFilter(false); };
  const openEditor = (entry?: Entry, categoryId?: string) => {
    setEditor({ id: entry?.item.id, categoryId: entry?.categoryId ?? categoryId ?? store.categories[0]?.id ?? "", returnFocus: document.activeElement as HTMLElement | null });
  };
  const editorEntry = editor?.id ? entries.find(({ item }) => item.id === editor.id) : undefined;
  const reload = async (preserve = false) => { setLoading(true); await store.load(preserve); setLoading(false); };
  const updateOwner = (entry: Entry, person: TodoPersonId | null) => store.change([{ id: entry.item.id, patch: { bearbeiter: person } }]);
  const updateStatus = (entry: Entry, status: TodoStatus, resolution?: TodoResolution) => {
    if (taskStatus(entry.item) === status) {
      if (status === "done" && resolution && taskResolution(entry.item) !== resolution) store.change([{ id: entry.item.id, patch: completionPatch(entry.item, status, today, resolution) }]);
      return;
    }
    const peers = entries.filter((other) => taskStatus(other.item) === status && group(other) === group(entry) && other.item.id !== entry.item.id);
    const last = peers.length ? Math.max(...peers.map((peer) => peer.item.reihenfolge ?? peer.index)) : -1;
    store.change([{ id: entry.item.id, patch: { ...completionPatch(entry.item, status, today, resolution), reihenfolge: last + 1 } }]);
  };
  const rearrange = (entry: Entry, status: TodoStatus, lane: string, beforeId?: string) => {
    if (swimlane === "work" && group(entry) !== lane) return;
    const peers = entries.filter((other) => taskStatus(other.item) === status && group(other) === lane && other.item.id !== entry.item.id).sort(order);
    const before = beforeId ? peers.findIndex((other) => other.item.id === beforeId) : -1;
    peers.splice(before >= 0 ? before : peers.length, 0, entry);
    store.change(peers.map((peer, index) => ({ id: peer.item.id, patch: peer.item.id === entry.item.id ? { ...completionPatch(entry.item, status, today), ...(swimlane === "person" ? { bearbeiter: lane === "unassigned" ? null : lane as TodoPersonId } : {}), reihenfolge: index } : { reihenfolge: index } })));
  };
  const reorder = (entry: Entry, offset: -1 | 1) => {
    const status = taskStatus(entry.item);
    const peers = entries.filter((other) => taskStatus(other.item) === status && group(other) === group(entry)).sort(order);
    const index = peers.findIndex((other) => other.item.id === entry.item.id);
    const target = index + offset;
    if (target < 0 || target >= peers.length) return;
    [peers[index], peers[target]] = [peers[target], peers[index]];
    store.change(peers.map((peer, index) => ({ id: peer.item.id, patch: { reihenfolge: index } })));
  };
  const allowDrop = (lane: string) => {
    const entry = entries.find(({ item }) => item.id === dragged);
    return !!entry && (swimlane !== "work" || group(entry) === lane);
  };
  const dragOver = (event: DragEvent, lane: string, target: string) => {
    if (!allowDrop(lane)) return;
    event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropTarget(target);
  };
  const drop = (event: DragEvent, status: TodoStatus, lane: string, beforeId?: string) => {
    event.preventDefault(); event.stopPropagation();
    const entry = entries.find(({ item }) => item.id === dragged);
    if (entry && entry.item.id !== beforeId) rearrange(entry, status, lane, beforeId);
    setDragged(null); setDropTarget(null);
  };
  const taskMeta = (entry: Entry) => {
    const state = todoState(entry.item, today);
    const resolution = taskResolution(entry.item);
    return <div className="admin-todo-meta">
      <TodoPriorityChoice item={entry.item} onChange={(prio) => store.change([{ id: entry.item.id, patch: { prio } }])}/>
      {resolution && <span className="admin-todo-resolution" data-resolution={resolution}>{TODO_RESOLUTIONS.find((option) => option.id === resolution)?.label}</span>}
      <span>{entry.item.art === "code" ? "Code" : "Außerhalb Code"}</span>
      {(entry.item.startDatum || entry.item.faellig) && <span className={state.kind === "overdue" ? "admin-todo-overdue" : ""} title={`Start: ${entry.item.startDatum ? fmtShort(entry.item.startDatum) : "Nicht geplant"}; Geplantes Ende: ${entry.item.faellig ? fmtShort(entry.item.faellig) : "Nicht geplant"}${taskStatus(entry.item) !== "done" ? `; ${state.label}` : ""}`}><Clock3 size={12} aria-hidden="true"/>{entry.item.startDatum ? fmtShort(entry.item.startDatum) : "Offen"} → {entry.item.faellig ? fmtShort(entry.item.faellig) : "Offen"}</span>}
      {!!entry.item.unteraufgaben?.length && <span title="Erledigte Unteraufgaben" aria-label={`${entry.item.unteraufgaben.filter(subtask => subtask.erledigt).length} von ${entry.item.unteraufgaben.length} Unteraufgaben erledigt`}><ListChecks size={14} aria-hidden="true"/>{entry.item.unteraufgaben.filter(subtask => subtask.erledigt).length}/{entry.item.unteraufgaben.length}</span>}
      {taskStatus(entry.item) === "done" && entry.item.erledigtAm && <span title={`Geschlossen am ${fmtShort(entry.item.erledigtAm)}`}><Check size={12} aria-hidden="true"/>{fmtShort(entry.item.erledigtAm)}</span>}
    </div>;
  };
  const waiting = (entry: Entry) => entry.item.wartetAuf ? <p className="admin-todo-waiting" title={entry.item.wartetAuf}><CircleAlert size={14} aria-hidden="true"/><span>Wartet auf: {entry.item.wartetAuf}</span></p> : null;
  const saveMessage = store.saveState === "saving" ? "Speichert …" : store.saveState === "conflict" ? "Änderungen prüfen" : store.saveState === "error" ? "Nicht gespeichert" : store.dirty ? `${store.dirty} ${store.dirty === 1 ? "Änderung" : "Änderungen"} ausstehend` : store.saveState === "saved" ? "Gespeichert" : "Aktueller Stand";

  return <>
    {!embedded && <PageHead icon="circleCheck" label="Intern" name="To-do-Liste" lead="Aktuelle Arbeit und Aufgaben für den nächsten Schritt."/>}
    <section className="admin-todo" aria-label="To-do-Liste">
      {store.error && <div className="admin-todo-error" role="alert">
        <p><CircleAlert size={18} aria-hidden="true"/><span>{store.error}</span></p>
        <div className="admin-todo-error-actions">
          {!store.data && <button type="button" className="admin-todo-text-action" disabled={loading} onClick={() => void reload()}>Erneut laden<RefreshCw size={14}/></button>}
          {store.data && store.saveState === "error" && <button type="button" className="admin-todo-text-action" onClick={() => void store.save()}>Erneut speichern<RefreshCw size={14}/></button>}
          {store.saveState === "conflict" && <>
            <button type="button" className="admin-todo-text-action" disabled={loading} onClick={() => void reload(true)}>{loading ? "Lädt …" : "Aktuellen Stand laden"}<RefreshCw size={14}/></button>
            {store.conflictFresh && <button type="button" className="admin-todo-text-action" onClick={() => void store.save()}>Eigene Änderungen speichern<ArrowRight size={14}/></button>}
          </>}
        </div>
        {store.conflictFresh && Object.keys(store.updates).length > 0 && <details className="admin-todo-conflicts"><summary>Ausstehende Änderungen ansehen</summary><ul>{Object.entries(store.updates).map(([id, patch]) => {
          const saved = store.data?.kategorien.flatMap((category) => category.items).find((item) => item.id === id);
          return <li key={id}><strong>{saved?.text ?? id}</strong>{Object.entries(patch).map(([field, value]) => {
            const labels: Record<string, string> = { status: "Status", abschluss: "Abschluss", text: "Aufgabe", hinweis: "Beschreibung", prio: "Priorität", art: "Art", bearbeiter: "Bearbeiter", wartetAuf: "Wartet auf", startDatum: "Startdatum", faellig: "Geplantes Enddatum", unteraufgaben: "Unteraufgaben", reihenfolge: "Reihenfolge" };
            if (!labels[field]) return null;
            const display = (v: unknown) => field === "unteraufgaben" && Array.isArray(v) ? v.map(subtask => `${subtask.erledigt ? "Erledigt" : "Offen"}: ${subtask.text}`).join("; ") || "Keine" : field === "status" ? TODO_STATUSES.find((s) => s.id === v)?.label ?? "Backlog" : field === "abschluss" ? TODO_RESOLUTIONS.find((option) => option.id === v)?.label ?? "Nicht geschlossen" : field === "prio" ? TODO_PRIORITIES.find((option) => option.id === v)?.label ?? "Mittel" : field === "bearbeiter" ? TODO_PEOPLE.find((p) => p.id === v)?.name ?? "Nicht zugewiesen" : String(v ?? "–");
            const savedValue = saved ? field === "prio" ? todoPriority(saved) : field === "abschluss" ? taskResolution(saved) : field === "status" ? taskStatus(saved) : saved[field as keyof TodoItem] : null;
            return <span key={field}>{labels[field]}: {display(savedValue)} → {display(value)}</span>;
          })}</li>;
        })}</ul></details>}
      </div>}
      {!store.data && !store.error && <p className="admin-todo-loading" role="status"><LoaderCircle size={18} className="admin-todo-spin" aria-hidden="true"/>Aufgaben werden geladen …</p>}
      {store.data && <>
        <dl className="admin-todo-summary" aria-label="Aufgabenübersicht">
          <div><dt>Aktuell</dt><dd>{board.filter(({ item }) => taskStatus(item) !== "done").length}</dd></div>
          <div><dt>Backlog</dt><dd>{backlogCount}</dd></div>
          <div><dt>Geschlossen</dt><dd>{entries.length - unfinished.length}<span> / {entries.length}</span></dd></div>
          <div><dt>Überfällig</dt><dd className={overdue ? "admin-todo-overdue" : ""}>{overdue}</dd></div>
        </dl>
        <div className="admin-todo-head">
          <div role="tablist" aria-label="Aufgabenansicht" className="admin-todo-tabs">
            <button type="button" role="tab" id="todo-list-tab" aria-controls="todo-list-view" aria-selected={view === "list"} tabIndex={view === "list" ? 0 : -1} onClick={() => setView("list")} onKeyDown={(event) => { if (["ArrowRight", "ArrowLeft"].includes(event.key)) { event.preventDefault(); setView("board"); document.getElementById("todo-board-tab")?.focus(); } }}>To-do-Liste<span>{unfinished.length}</span></button>
            <button type="button" role="tab" id="todo-board-tab" aria-controls="todo-board-view" aria-selected={view === "board"} tabIndex={view === "board" ? 0 : -1} onClick={() => setView("board")} onKeyDown={(event) => { if (["ArrowRight", "ArrowLeft"].includes(event.key)) { event.preventDefault(); setView("list"); document.getElementById("todo-list-tab")?.focus(); } }}>Kanban-Board<span>{board.length}</span></button>
          </div>
          <div className="admin-todo-head-actions">
            <span className="admin-todo-save-state" role="status" aria-live="polite">{store.saveState === "saving" ? <LoaderCircle size={14} className="admin-todo-spin"/> : store.saveState === "saved" && !store.dirty ? <Check size={14}/> : null}{saveMessage}</span>
            <button type="button" className="admin-todo-icon" title="Letzte Änderung rückgängig machen" aria-label="Letzte Änderung rückgängig machen" disabled={!store.canUndo} onClick={store.undo}><Undo2 size={18} aria-hidden="true"/></button>
            <button type="button" className="admin-todo-icon" title="Aktualisieren" aria-label="Aufgaben aktualisieren" disabled={!!store.dirty || store.saveState === "saving" || loading} onClick={() => void reload()}><RefreshCw size={18} className={loading ? "admin-todo-spin" : ""} aria-hidden="true"/></button>
            <button type="button" className="admin-todo-primary" onClick={() => openEditor()}>Neue Aufgabe<ArrowRight size={16} aria-hidden="true"/></button>
          </div>
        </div>
        <div className="admin-todo-filters" role="group" aria-label="Aufgaben filtern">
          <label className="admin-todo-search"><Search size={16} aria-hidden="true"/><input autoComplete="off" type="search" aria-label="Aufgaben suchen" placeholder="Aufgaben suchen" value={query} onChange={(event) => setQuery(event.target.value)}/></label>
          <TodoChoice label="Bearbeiter filtern" value={personFilter} onChange={setPersonFilter} options={[{ value: "all", label: "Alle Bearbeiter" }, ...TODO_PEOPLE.map((person) => ({ value: person.id, label: person.name })), { value: "unassigned", label: "Nicht zugewiesen" }]}/>
          <TodoChoice label="Priorität filtern" value={priorityFilter} onChange={setPriorityFilter} options={[{ value: "all", label: "Alle Prioritäten" }, ...TODO_PRIORITIES.map((priority) => ({ value: String(priority.id), label: priority.label }))]}/>
          <TodoChoice label="Abschluss filtern" value={resolutionFilter} onChange={changeResolutionFilter} options={[{ value: "all", label: "Alle Abschlüsse" }, { value: "open", label: "Nicht geschlossen" }, ...TODO_RESOLUTIONS.map((resolution) => ({ value: resolution.id, label: resolution.label }))]}/>
          <TodoChoice label="Art filtern" value={kindFilter} onChange={setKindFilter} options={[{ value: "all", label: "Alle Arten" }, { value: "code", label: "Code" }, { value: "extern", label: "Außerhalb Code" }]}/>
          <TodoChoice label="Termin filtern" value={dueFilter} onChange={(value) => setDueFilter(value as DueFilter)} options={[{ value: "all", label: "Alle Termine" }, { value: "overdue", label: "Überfällig" }, { value: "today", label: "Heute fällig" }, { value: "undated", label: "Ohne Termin" }]}/>
          <label className="admin-todo-wait-filter"><input type="checkbox" checked={waitingFilter} onChange={(event) => setWaitingFilter(event.target.checked)}/><span>Wartende</span></label>
          {hasFilters && <button type="button" className="admin-todo-text-action" onClick={resetFilters}>Filter zurücksetzen</button>}
        </div>
        {view === "board" ? <div role="tabpanel" id="todo-board-view" aria-labelledby="todo-board-tab">
          <div className="admin-todo-view-tools"><div className="admin-todo-swimlane"><span>Swimlanes</span><TodoChoice label="Swimlanes" value={swimlane} onChange={(value) => { setSwimlane(value as Swimlane); setDragged(null); setDropTarget(null); }} options={[{ value: "work", label: "Arbeitsbereiche" }, { value: "person", label: "Bearbeiter" }, { value: "none", label: "Ohne Gruppierung" }]}/></div><span>Geschlossen: letzte 14 Tage</span></div>
          <div className="admin-todo-mobile-status"><TodoChoice label="Boardspalte" value={mobileStatus} onChange={(value) => setMobileStatus(value as TodoStatus)} options={BOARD_STATUSES.map((status) => ({ value: status.id, label: `${status.label} (${shownBoard.filter(({ item }) => taskStatus(item) === status.id).length})` }))}/></div>
          <div className="admin-todo-board" data-mobile-status={mobileStatus}>
            <div className="admin-todo-columns" aria-hidden="true">{BOARD_STATUSES.map((status) => <div key={status.id} className="admin-todo-column-heading" data-status={status.id}><strong>{status.label}</strong><span>{shownBoard.filter(({ item }) => taskStatus(item) === status.id).length}</span></div>)}</div>
            {shownBoard.length > 0 && lanes.map((lane) => {
              const laneEntries = shownBoard.filter((entry) => group(entry) === lane.id);
              const personWork = swimlane === "person" ? laneEntries.filter(({ item }) => taskStatus(item) === "doing").length : 0;
              return <section className="admin-todo-lane" key={lane.id} aria-label={lane.name}>
                <h2 className="admin-todo-lane-heading"><span>{lane.name}</span><span>{laneEntries.length}{swimlane === "person" && personWork > 0 ? ` · ${personWork} in Arbeit` : ""}</span>{swimlane === "person" && lane.id !== "unassigned" && personWork > 2 && <span className="admin-todo-wip"><CircleAlert size={12}/>{personWork} gleichzeitig</span>}</h2>
                <div className="admin-todo-lane-columns">{BOARD_STATUSES.map((status) => {
                  const column = laneEntries.filter(({ item }) => taskStatus(item) === status.id).sort(order);
                  const cellId = `${lane.id}:${status.id}`;
                  return <div className={`admin-todo-cell ${dropTarget === cellId ? "is-drop-target" : ""}`} key={status.id} role="group" data-status={status.id} data-lane={lane.id} aria-label={`${lane.name}, ${status.label}`} onDragOver={(event) => dragOver(event, lane.id, cellId)} onDrop={(event) => drop(event, status.id, lane.id)}>
                    {column.map((entry) => {
                      const peers = entries.filter((other) => group(other) === lane.id && taskStatus(other.item) === status.id).sort(order);
                      const index = peers.findIndex((peer) => peer.item.id === entry.item.id);
                      return <article key={entry.item.id} data-todo-id={entry.item.id} className={`admin-todo-card ${dragged === entry.item.id ? "is-dragging" : ""} ${dropTarget === entry.item.id ? "is-drop-before" : ""} ${taskStatus(entry.item) === "done" ? "is-done" : ""}`} draggable onDragStart={(event) => { setDragged(entry.item.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", entry.item.id); }} onDragEnd={() => { setDragged(null); setDropTarget(null); }} onDragOver={(event) => { if (allowDrop(lane.id)) { event.stopPropagation(); dragOver(event, lane.id, entry.item.id); } }} onDrop={(event) => drop(event, status.id, lane.id, entry.item.id)}>
                        <div className="admin-todo-card-top"><span>{entry.category}</span><GripVertical size={14} aria-hidden="true"/></div>
                        <button type="button" className="admin-todo-task-title" onClick={() => openEditor(entry)}>{entry.item.text}</button>
                        {taskMeta(entry)}{waiting(entry)}
                        <div className="admin-todo-card-owner"><TodoOwner item={entry.item} onChange={(person) => updateOwner(entry, person)}/></div>
                        <div className="admin-todo-card-actions"><TodoStatusChoice item={entry.item} onChange={(next, resolution) => updateStatus(entry, next, resolution)}/><TodoOrder canUp={index > 0} canDown={index >= 0 && index < peers.length - 1} onMove={(offset) => reorder(entry, offset)}/></div>
                      </article>;
                    })}
                    {!column.length && <span className="admin-todo-cell-empty">Keine Aufgaben</span>}
                  </div>;
                })}</div>
              </section>;
            })}
            {!shownBoard.length && <div className="admin-todo-empty"><LayoutList size={24} aria-hidden="true"/><p>{board.length ? "Keine Aufgaben für diese Filter." : "Aktuell sind keine Aufgaben eingeplant."}</p><button type="button" className="admin-todo-text-action" onClick={board.length ? resetFilters : () => setView("list")}>{board.length ? "Filter zurücksetzen" : "Zur Liste"}<ArrowRight size={16}/></button></div>}
          </div>
        </div> : <div role="tabpanel" id="todo-list-view" aria-labelledby="todo-list-tab">
          <div className="admin-todo-view-tools"><TodoChoice label="Liste anzeigen" value={scope} onChange={(value) => setScope(value as BacklogScope)} options={[{ value: "open", label: "Offene Aufgaben" }, { value: "backlog", label: "Nicht eingeplant" }, { value: "all", label: "Alle Aufgaben" }, { value: "done", label: "Geschlossene Aufgaben" }]}/><button type="button" className="admin-todo-text-action" onClick={() => changeClosed(closed.length ? [] : store.categories.map((category) => category.id))}>{closed.length ? "Alle ausklappen" : "Alle einklappen"}<ChevronDown size={14}/></button></div>
          <div className="admin-todo-backlog">{store.categories.map((category) => {
            const rows = entries.filter((entry) => entry.categoryId === category.id);
            const visible = rows.filter((entry) => matches(entry) && (scope === "all" || scope === "backlog" && taskStatus(entry.item) === "backlog" || scope === "open" && taskStatus(entry.item) !== "done" || scope === "done" && taskStatus(entry.item) === "done")).sort((a, b) => Number(taskStatus(a.item) === "done") - Number(taskStatus(b.item) === "done") || todoPriority(a.item) - todoPriority(b.item) || order(a, b));
            const collapsed = closed.includes(category.id);
            return <section key={category.id} className="admin-todo-category" aria-label={category.name}>
              <div className="admin-todo-category-head"><h2><button type="button" onClick={() => changeClosed(collapsed ? closed.filter((id) => id !== category.id) : [...closed, category.id])} aria-expanded={!collapsed} aria-controls={`todo-category-${category.id}`}><ChevronDown size={16} className={collapsed ? "is-collapsed" : ""} aria-hidden="true"/>{category.name}<span>{visible.length}</span></button></h2><button type="button" className="admin-todo-text-action" aria-label={`Neue Aufgabe in ${category.name}`} onClick={() => openEditor(undefined, category.id)}>Neue Aufgabe<ArrowRight size={14}/></button></div>
              <ul hidden={collapsed} id={`todo-category-${category.id}`} className="admin-todo-backlog-rows">
                {visible.map((entry) => <li key={entry.item.id} data-todo-id={entry.item.id} className={`admin-todo-row ${entry.item.erledigt ? "is-done" : ""}`}>
                  <div className="admin-todo-row-main"><button type="button" className="admin-todo-task-title" onClick={() => openEditor(entry)}>{entry.item.text}</button>{entry.item.hinweis && <p className="admin-todo-row-description">{entry.item.hinweis}</p>}{taskMeta(entry)}{waiting(entry)}</div>
                  <div className="admin-todo-row-owner"><TodoOwner item={entry.item} onChange={(person) => updateOwner(entry, person)}/></div>
                  <div className="admin-todo-row-status"><TodoStatusChoice item={entry.item} onChange={(next, resolution) => updateStatus(entry, next, resolution)}/></div>
                  {taskStatus(entry.item) === "backlog" && <button type="button" className="admin-todo-text-action admin-todo-plan" onClick={() => updateStatus(entry, "ready")}>Aufs Board<ArrowRight size={14} aria-hidden="true"/></button>}
                </li>)}
                {!visible.length && <li className="admin-todo-category-empty">Keine Aufgaben in dieser Auswahl.</li>}
              </ul>
            </section>;
          })}</div>
        </div>}
      </>}
    </section>
    {editor && store.data && <TodoEditor key={editor.id ?? "new"} item={editorEntry?.item} categoryId={editor.categoryId} categories={store.categories} returnFocus={editor.returnFocus} onApply={(patch) => { if (editor.id) store.change([{ id: editor.id, patch }]); }} onCreate={store.create} onClose={() => setEditor(null)}/>}
  </>;
}
