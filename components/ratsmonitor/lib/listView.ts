import { useSyncExternalStore } from "react";

/** Ansicht der Trefferliste: ausführlich (mit Kurztext und Verlauf) oder kompakt; im Browser gemerkt */
export type ListView = "full" | "compact";
const KEY = "rm-list-view";
const listeners = new Set<() => void>();
let current: ListView | null = null;

function read(): ListView {
  if (current) return current;
  try {
    current = localStorage.getItem(KEY) === "compact" ? "compact" : "full";
  } catch {
    current = "full";
  }
  return current;
}

export function setListView(v: ListView) {
  current = v;
  try {
    localStorage.setItem(KEY, v);
  } catch {}
  listeners.forEach((l) => l());
}

export function useListView(): ListView {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    read,
    () => "full",
  );
}
