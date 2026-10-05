import { useSyncExternalStore } from "react";

/** Ansicht der Trefferliste: ausführlich (mit Kurztext und Verlauf) oder kompakt; im Browser gemerkt.
 *  Web: Standard ausführlich, der Knopf macht kompakt. Handy: umgekehrt, Standard kompakt, der Knopf zeigt mehr (eigener Merker). */
export type ListView = "full" | "compact";
const listeners = new Set<() => void>();
const phone = () => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;
const keyOf = () => (phone() ? "rm-list-view-phone" : "rm-list-view");
let current: ListView | null = null;

function read(): ListView {
  if (current) return current;
  const fallback: ListView = phone() ? "compact" : "full";
  try {
    const v = localStorage.getItem(keyOf());
    current = v === "compact" || v === "full" ? v : fallback;
  } catch {
    current = fallback;
  }
  return current;
}

export function setListView(v: ListView) {
  current = v;
  try {
    localStorage.setItem(keyOf(), v);
  } catch {}
  listeners.forEach((l) => l());
}

/* Beim Wechsel zwischen Handy- und Webbreite (Drehen, Fenster ändern) die passende Einstellung laden */
if (typeof window !== "undefined") {
  window.matchMedia("(max-width: 639px)").addEventListener("change", () => {
    current = null;
    listeners.forEach((l) => l());
  });
}

export function useListView(): ListView {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    read,
    () => "full",
  );
}
