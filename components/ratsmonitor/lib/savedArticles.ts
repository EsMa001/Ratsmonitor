import { useSyncExternalStore } from "react";

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

function write(list: SavedArticle[]) {
  cache = list;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
  listeners.forEach((l) => l());
}

export function toggleSavedArticle(a: Omit<SavedArticle, "savedAt">) {
  const list = read();
  write(list.some((x) => x.id === a.id) ? list.filter((x) => x.id !== a.id) : [{ ...a, savedAt: new Date().toISOString() }, ...list]);
}

/** Vorgang folgen bzw. entfolgen; folgen speichert den Artikel mit */
export function toggleFollow(a: Omit<SavedArticle, "savedAt" | "follow">) {
  const list = read();
  const hit = list.find((x) => x.id === a.id);
  write(hit ? list.map((x) => (x.id === a.id ? { ...x, follow: !x.follow } : x)) : [{ ...a, savedAt: new Date().toISOString(), follow: true }, ...list]);
}

export function removeSavedArticle(id: string) {
  write(read().filter((x) => x.id !== id));
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
