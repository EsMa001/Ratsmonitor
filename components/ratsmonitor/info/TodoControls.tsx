import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Check, ChevronDown, Plus, Trash2, UserRound, X } from "lucide-react";
import { Dialog, Popover } from "radix-ui";
import { TODO_PEOPLE, TODO_PRIORITIES, TODO_RESOLUTIONS, TODO_STATUSES, localToday, taskResolution, taskStatus, todoPriority, type TodoCategory, type TodoItem, type TodoPersonId, type TodoResolution, type TodoStatus, type TodoSubtask } from "../lib/todos";
import type { TodoCreate, TodoPatch } from "./useTodoBoard";

type Option = { value: string; label: string; content?: ReactNode };

export function TodoChoice({ label, value, options, onChange, children, className = "" }: { label: string; value: string; options: Option[]; onChange: (value: string) => void; children?: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const current = options.find((option) => option.value === value);
  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger asChild>
      <button type="button" className={`admin-todo-choice ${className}`} aria-label={`${label}: ${current?.label ?? ""}`} aria-haspopup="listbox" onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); }
      }}>{children ?? <span>{current?.label}</span>}<ChevronDown size={14} aria-hidden="true"/></button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content align="start" sideOffset={5} className="admin-todo-menu" aria-describedby={undefined} onOpenAutoFocus={(event: Event) => {
        event.preventDefault();
        const element = event.currentTarget as HTMLElement;
        (element.querySelector<HTMLElement>('[aria-selected="true"]') ?? element.querySelector<HTMLElement>('[role="option"]'))?.focus();
      }}>
        <ul role="listbox" aria-label={label} id={id} onKeyDown={(event) => {
          const options = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="option"]'));
          const index = options.indexOf(document.activeElement as HTMLElement);
          let next: number | undefined;
          if (event.key === "ArrowDown") next = (index + 1) % options.length;
          if (event.key === "ArrowUp") next = (index - 1 + options.length) % options.length;
          if (event.key === "Home") next = 0;
          if (event.key === "End") next = options.length - 1;
          if (next !== undefined) { event.preventDefault(); options[next]?.focus(); }
        }}>
          {options.map((option) => <li key={option.value}><button type="button" role="option" aria-selected={option.value === value} onClick={() => { onChange(option.value); setOpen(false); }}>
            <span>{option.content ?? option.label}</span>{option.value === value && <Check size={16} aria-hidden="true"/>}
          </button></li>)}
        </ul>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}

function TodoPerson({ person }: { person?: TodoPersonId | null }) {
  const selected = TODO_PEOPLE.find((option) => option.id === person);
  return <span className="admin-todo-person"><span className={`admin-todo-avatar ${selected ? `is-${selected.id}` : "is-unassigned"}`} aria-hidden="true">{selected?.initials ?? <UserRound size={14}/>}</span><span>{selected?.name ?? "Nicht zugewiesen"}</span></span>;
}

export function TodoOwner({ item, onChange }: { item: TodoItem; onChange: (person: TodoPersonId | null) => void }) {
  return <TodoChoice label={`Bearbeiter für: ${item.text}`} value={item.bearbeiter ?? ""} className="admin-todo-owner" onChange={(value) => onChange((value || null) as TodoPersonId | null)} options={[
    { value: "", label: "Nicht zugewiesen", content: <TodoPerson/> },
    ...TODO_PEOPLE.map((person) => ({ value: person.id, label: person.name, content: <TodoPerson person={person.id}/> })),
  ]}><TodoPerson person={item.bearbeiter}/></TodoChoice>;
}

export function TodoPriorityChoice({ item, onChange }: { item: TodoItem; onChange: (priority: 1 | 2 | 3) => void }) {
  const priority = todoPriority(item);
  return <TodoChoice label={`Priorität für: ${item.text}`} value={String(priority)} className={`admin-todo-priority-choice ${priority === 1 ? "is-high" : ""}`} onChange={(value) => onChange(Number(value) as 1 | 2 | 3)} options={TODO_PRIORITIES.map((option) => ({ value: String(option.id), label: option.label }))}/>;
}

export function TodoStatusChoice({ item, onChange }: { item: TodoItem; onChange: (status: TodoStatus, resolution?: TodoResolution) => void }) {
  return <TodoChoice label={`Status für: ${item.text}`} value={taskResolution(item) ?? taskStatus(item)} className="admin-todo-status-choice" onChange={(value) => {
    const resolution = TODO_RESOLUTIONS.find((option) => option.id === value);
    if (resolution) onChange("done", resolution.id);
    else onChange(value as TodoStatus);
  }} options={[
    ...TODO_STATUSES.filter((status) => status.id !== "done").map((status) => ({ value: status.id, label: status.label })),
    ...TODO_RESOLUTIONS.map((resolution) => ({ value: resolution.id, label: resolution.label })),
  ]}/>;
}

export function TodoOrder({ canUp, canDown, onMove }: { canUp: boolean; canDown: boolean; onMove: (offset: -1 | 1) => void }) {
  return <span className="admin-todo-order">
    <button type="button" className="admin-todo-icon" aria-label="Aufgabe nach oben verschieben" title="Nach oben verschieben" disabled={!canUp} onClick={() => onMove(-1)}><ArrowUp size={14} aria-hidden="true"/></button>
    <button type="button" className="admin-todo-icon" aria-label="Aufgabe nach unten verschieben" title="Nach unten verschieben" disabled={!canDown} onClick={() => onMove(1)}><ArrowDown size={14} aria-hidden="true"/></button>
  </span>;
}

type Draft = { text: string; hinweis: string; prio: string; art: string; status: TodoStatus; abschluss: TodoResolution; bearbeiter: TodoPersonId | null; startDatum: string; faellig: string; unteraufgaben: TodoSubtask[]; wartetAuf: string; kategorieId: string };

export function TodoEditor({ item, categoryId, categories, onApply, onCreate, onClose, returnFocus }: { item?: TodoItem; categoryId: string; categories: TodoCategory[]; onApply: (patch: TodoPatch) => void; onCreate: (item: TodoCreate) => void; onClose: () => void; returnFocus?: HTMLElement | null }) {
  const id = useId();
  const [initial] = useState(item);
  const [draft, setDraft] = useState<Draft>(() => ({ text: item?.text ?? "", hinweis: item?.hinweis ?? "", prio: String(item ? todoPriority(item) : 2), art: item?.art ?? "extern", status: item ? taskStatus(item) : "backlog", abschluss: item ? taskResolution(item) ?? "done" : "done", bearbeiter: item?.bearbeiter ?? null, startDatum: item?.startDatum ?? "", faellig: item?.faellig ?? "", unteraufgaben: item?.unteraufgaben ?? [], wartetAuf: item?.wartetAuf ?? "", kategorieId: categoryId }));
  const [newSubtask, setNewSubtask] = useState("");
  const newSubtaskInput = useRef<HTMLInputElement>(null);
  const change = <K extends keyof Draft>(field: K, value: Draft[K]) => setDraft((previous) => ({ ...previous, [field]: value }));
  const pendingSubtasks = () => newSubtask.trim() && draft.unteraufgaben.length < 100 ? [...draft.unteraufgaben, { id: crypto.randomUUID(), text: newSubtask.trim(), erledigt: false }] : draft.unteraufgaben;
  const addSubtask = () => { change("unteraufgaben", pendingSubtasks()); setNewSubtask(""); newSubtaskInput.current?.focus(); };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.text.trim() || !draft.kategorieId) return;
    if (draft.startDatum && draft.faellig && draft.startDatum > draft.faellig) return;
    const patch: TodoPatch = { text: draft.text.trim(), hinweis: draft.hinweis.trim(), prio: Number(draft.prio) as 1 | 2 | 3, art: draft.art as "code" | "extern", status: draft.status, abschluss: draft.status === "done" ? draft.abschluss : null, bearbeiter: draft.bearbeiter, startDatum: draft.startDatum || null, faellig: draft.faellig || null, unteraufgaben: pendingSubtasks().map(subtask => ({ ...subtask, text: subtask.text.trim() })), wartetAuf: draft.wartetAuf.trim() || null, erledigt: draft.status === "done", erledigtAm: draft.status === "done" ? initial && taskStatus(initial) === "done" ? initial.erledigtAm : localToday() : null };
    if (initial) {
      const before: TodoPatch = { text: initial.text, hinweis: initial.hinweis ?? "", prio: todoPriority(initial), art: initial.art ?? "extern", status: taskStatus(initial), abschluss: taskResolution(initial), bearbeiter: initial.bearbeiter ?? null, startDatum: initial.startDatum ?? null, faellig: initial.faellig, unteraufgaben: initial.unteraufgaben ?? [], wartetAuf: initial.wartetAuf ?? null, erledigt: initial.erledigt, erledigtAm: initial.erledigtAm };
      const changed = Object.fromEntries(Object.entries(patch).filter(([key, value]) => key === "unteraufgaben" ? JSON.stringify(before.unteraufgaben) !== JSON.stringify(value) : !Object.is(before[key as keyof TodoPatch], value))) as TodoPatch;
      if (Object.hasOwn(changed, "startDatum") || Object.hasOwn(changed, "faellig")) Object.assign(changed, { startDatum: patch.startDatum, faellig: patch.faellig });
      if (changed.status || Object.hasOwn(changed, "abschluss")) Object.assign(changed, { status: patch.status, abschluss: patch.abschluss, erledigt: patch.erledigt, erledigtAm: patch.erledigtAm });
      onApply(changed);
    }
    else onCreate({ ...patch, id: `todo-${crypto.randomUUID()}`, kategorieId: draft.kategorieId, text: patch.text!, erledigt: draft.status === "done", erledigtAm: patch.erledigtAm ?? null, faellig: patch.faellig ?? null } as TodoCreate);
    onClose();
  };
  return <Dialog.Root open onOpenChange={(open: boolean) => { if (!open) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="admin-todo-overlay"/>
      <Dialog.Content className="admin-todo-dialog" onCloseAutoFocus={(event: Event) => { if (returnFocus?.isConnected) { event.preventDefault(); returnFocus.focus(); } }}>
        <div className="admin-todo-dialog-head"><div><Dialog.Title>{item ? "Aufgabe bearbeiten" : "Neue Aufgabe"}</Dialog.Title><Dialog.Description className="admin-todo-dialog-description">{item ? categories.find((category) => category.id === categoryId)?.name : "Backlog"}</Dialog.Description></div><Dialog.Close asChild><button type="button" className="admin-todo-icon" title="Schließen" aria-label="Schließen"><X size={20} aria-hidden="true"/></button></Dialog.Close></div>
        <form onSubmit={submit}>
          <div className="admin-todo-form">
            <label className="admin-todo-field admin-todo-field--wide" htmlFor={`${id}-text`}><span>Aufgabe</span><textarea id={`${id}-text`} required maxLength={1000} rows={2} autoFocus value={draft.text} onChange={(event) => change("text", event.target.value)}/></label>
            <label className="admin-todo-field admin-todo-field--wide" htmlFor={`${id}-hint`}><span>Beschreibung</span><textarea id={`${id}-hint`} maxLength={10000} rows={4} value={draft.hinweis} onChange={(event) => change("hinweis", event.target.value)}/></label>
            <fieldset className="admin-todo-subtasks">
              <legend>Unteraufgaben <span>{draft.unteraufgaben.filter(subtask => subtask.erledigt).length}/{draft.unteraufgaben.length}</span></legend>
              <ul>{draft.unteraufgaben.map((subtask, index) => <li key={subtask.id} className={subtask.erledigt ? "is-done" : ""}>
                <label className="admin-todo-subtask-check"><input type="checkbox" aria-label={`Unteraufgabe abhaken: ${subtask.text}`} checked={subtask.erledigt} onChange={(event) => change("unteraufgaben", draft.unteraufgaben.map(current => current.id === subtask.id ? { ...current, erledigt: event.target.checked } : current))}/></label>
                <input autoComplete="off" type="text" aria-label={`Unteraufgabe ${index + 1}`} required pattern=".*\S.*" maxLength={500} value={subtask.text} onChange={(event) => change("unteraufgaben", draft.unteraufgaben.map(current => current.id === subtask.id ? { ...current, text: event.target.value } : current))}/>
                <button type="button" className="admin-todo-icon" title="Unteraufgabe entfernen" aria-label={`Unteraufgabe entfernen: ${subtask.text}`} onClick={() => change("unteraufgaben", draft.unteraufgaben.filter(current => current.id !== subtask.id))}><Trash2 size={16} aria-hidden="true"/></button>
              </li>)}</ul>
              <div className="admin-todo-subtask-add"><input autoComplete="off" ref={newSubtaskInput} type="text" aria-label="Neue Unteraufgabe" placeholder="Neue Unteraufgabe" maxLength={500} disabled={draft.unteraufgaben.length >= 100} value={newSubtask} onChange={(event) => setNewSubtask(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addSubtask(); } }}/><button type="button" className="admin-todo-icon" title="Unteraufgabe hinzufügen" aria-label="Unteraufgabe hinzufügen" disabled={!newSubtask.trim() || draft.unteraufgaben.length >= 100} onClick={addSubtask}><Plus size={18} aria-hidden="true"/></button></div>
            </fieldset>
            {!item && <div className="admin-todo-field admin-todo-field--wide"><span>Kategorie</span><TodoChoice label="Kategorie" value={draft.kategorieId} onChange={(value) => change("kategorieId", value)} options={categories.map((category) => ({ value: category.id, label: category.name }))}/></div>}
            <div className="admin-todo-field"><span>Status</span><TodoChoice label="Status" value={draft.status} onChange={(value) => change("status", value as TodoStatus)} options={TODO_STATUSES.map((status) => ({ value: status.id, label: status.label }))}/></div>
            {draft.status === "done" && <div className="admin-todo-field"><span>Abschluss</span><TodoChoice label="Abschluss" value={draft.abschluss} onChange={(value) => change("abschluss", value as TodoResolution)} options={TODO_RESOLUTIONS.map((resolution) => ({ value: resolution.id, label: resolution.label }))}/></div>}
            <div className="admin-todo-field"><span>Bearbeiter</span><TodoOwner item={{ ...item, text: draft.text || "Neue Aufgabe", bearbeiter: draft.bearbeiter } as TodoItem} onChange={(value) => change("bearbeiter", value)}/></div>
            <div className="admin-todo-field"><span>Priorität</span><TodoChoice label="Priorität" value={draft.prio} onChange={(value) => change("prio", value)} options={TODO_PRIORITIES.map((priority) => ({ value: String(priority.id), label: priority.label }))}/></div>
            <div className="admin-todo-field"><span>Art</span><TodoChoice label="Art" value={draft.art} onChange={(value) => change("art", value)} options={[{ value: "code", label: "Code" }, { value: "extern", label: "Außerhalb Code" }]}/></div>
            <label className="admin-todo-field" htmlFor={`${id}-start`}><span>Startdatum</span><input id={`${id}-start`} type="date" max={draft.faellig || undefined} value={draft.startDatum} onChange={(event) => change("startDatum", event.target.value)}/></label>
            <label className="admin-todo-field" htmlFor={`${id}-date`}><span>Geplantes Enddatum</span><input id={`${id}-date`} type="date" min={draft.startDatum || undefined} value={draft.faellig} onChange={(event) => change("faellig", event.target.value)}/></label>
            <label className="admin-todo-field admin-todo-field--wide" htmlFor={`${id}-waiting`}><span>Wartet auf</span><input autoComplete="off" id={`${id}-waiting`} type="text" maxLength={1000} value={draft.wartetAuf} onChange={(event) => change("wartetAuf", event.target.value)}/></label>
          </div>
          <div className="admin-todo-dialog-actions"><button type="button" className="admin-todo-text-action" onClick={onClose}>Abbrechen</button><button type="submit" className="admin-todo-primary">{item ? "Übernehmen" : "Aufgabe anlegen"}<ArrowRight size={16} aria-hidden="true"/></button></div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
