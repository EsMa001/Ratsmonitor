import { useSyncExternalStore } from "react";
import { onOtherTab } from "./otherTab";

/** Gespeicherte Artikel (Lesezeichen), nur in diesem Browser */
export interface SavedArticle {
  id: string;
  title: string;
  date: string;
  gemeinde: string;
  teaser: string;
  savedAt: string;
  /** Benachrichtigen, wenn es zu diesem Vorgang Neuigkeiten gibt */
  follow?: boolean;
}

const KEY = "ratsmonitor:saved-articles:v1";
const listeners = new Set<() => void>();
let cache: SavedArticle[] | null = null;
const EMPTY: SavedArticle[] = [];
/* Ein anderer Tab hat gespeichert oder entfernt: neu lesen und anzeigen */
onOtherTab([KEY], () => {
  cache = null;
  listeners.forEach((l) => l());
});

function read(): SavedArticle[] {
  if (cache) return cache;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    cache = Array.isArray(v) ? v.filter((a) => a && typeof a.id === "string") : [];
  } catch {
    cache = [];
  }
  return cache;
}

/** false: der Browser lässt nichts dauerhaft speichern (privates Fenster, voller Speicher); der Stand gilt bis zum Neuladen */
function write(list: SavedArticle[]): boolean {
  cache = list;
  let ok = true;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    ok = false;
  }
  listeners.forEach((l) => l());
  return ok;
}

export function toggleSavedArticle(a: Omit<SavedArticle, "savedAt">): boolean {
  const list = read();
  return write(list.some((x) => x.id === a.id) ? list.filter((x) => x.id !== a.id) : [{ ...a, savedAt: new Date().toISOString() }, ...list]);
}

/** Vorgang folgen bzw. entfolgen; folgen speichert den Artikel mit */
export function toggleFollow(a: Omit<SavedArticle, "savedAt" | "follow">): boolean {
  const list = read();
  const hit = list.find((x) => x.id === a.id);
  return write(hit ? list.map((x) => (x.id === a.id ? { ...x, follow: !x.follow } : x)) : [{ ...a, savedAt: new Date().toISOString(), follow: true }, ...list]);
}

/** Entfernt den Artikel und gibt ihn zurück (für „Rückgängig“) */
export function removeSavedArticle(id: string): SavedArticle | undefined {
  const list = read();
  const hit = list.find((x) => x.id === id);
  write(list.filter((x) => x.id !== id));
  return hit;
}

/** Entfernten Artikel an seiner Stelle (nach Speicherdatum) wiederherstellen */
export function restoreSavedArticle(a: SavedArticle) {
  const list = read().filter((x) => x.id !== a.id);
  write([...list, a].sort((x, y) => (y.savedAt || "").localeCompare(x.savedAt || "")));
}

export function clearSavedArticles() {
  write([]);
}

export function useSavedArticles(): SavedArticle[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => EMPTY,
  );
}
