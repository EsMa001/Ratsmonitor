import { useSyncExternalStore } from "react";

/** Ob die Filter unter der Karte aufgeklappt sind; geteilt zwischen Filter-Knopf auf der Karte und Filterbereich */
const listeners = new Set<() => void>();
let open = false;

export function setFiltersOpen(v: boolean) {
  open = v;
  listeners.forEach((l) => l());
}

export function useFiltersOpen(): boolean {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => open,
    () => false,
  );
}
