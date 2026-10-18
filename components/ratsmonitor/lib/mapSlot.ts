import { useSyncExternalStore } from "react";

/** Platz oben auf der Karte (Handy): die Karte meldet ihn an, die Suchleiste der Seite setzt sich per Portal hinein */
const listeners = new Set<() => void>();
let slot: HTMLElement | null = null;

export function setMapSlot(el: HTMLElement | null) {
  if (el === slot) return;
  if (el === null) { slot = null; } else { slot = el; }
  listeners.forEach((l) => l());
}
/** Beim Abmelden nur löschen, wenn der Platz noch derselbe ist (zwei Karten nacheinander) */
export function clearMapSlot(el: HTMLElement | null) { if (slot === el) setMapSlot(null); }

export function useMapSlot(): HTMLElement | null {
  return useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => slot, () => null);
}
