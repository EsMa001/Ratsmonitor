import { useSyncExternalStore } from "react";
import { AccountApiError, api, getMe, onMe, touchAccount } from "./account";
import { openLimitGate } from "../components/GateDialog";

/** Gespeicherte Artikel (Lesezeichen) im Konto: GET/POST/PATCH/DELETE /api/me/articles */
export interface SavedArticle {
  id: string;
  title: string;
  date: string;
  gemeinde: string;
  teaser: string;
  savedAt: string;
  /** Benachrichtigen, wenn es zu diesem Vorgang Neuigkeiten gibt (in Thema 1 nur vorgemerkt) */
  follow?: boolean;
  /** false: über der Grenze der Stufe gespeichert, zählt nicht */
  active?: boolean;
  /** Gebiet (Katalog-ID) aus dem Stand des Servers, für den Namen, wenn gemeinde fehlt */
  region?: string;
  status?: string;
}
type ServerArticle = { id: string; follow: boolean; active: boolean; savedAt: string; lastSeen: string | null; snapshot?: { id: string; title: string; date: string; region: string; status: string } };

const listeners = new Set<() => void>();
const EMPTY: SavedArticle[] = [];
let list: SavedArticle[] = EMPTY;
let ready = false;
/* Angaben der Seite, auf der gespeichert wurde (Ort, Kurztext): der Server kennt nur Titel, Datum, Gebiet und Status */
const details = new Map<string, Pick<SavedArticle, "gemeinde" | "teaser">>();
const emit = () => listeners.forEach((l) => l());
function put(next: SavedArticle[]) {
  list = next;
  emit();
}

const fromServer = (r: ServerArticle): SavedArticle => ({
  id: r.id,
  title: r.snapshot?.title ?? r.id,
  date: r.snapshot?.date ?? "",
  gemeinde: details.get(r.id)?.gemeinde ?? "",
  teaser: details.get(r.id)?.teaser ?? "",
  savedAt: r.savedAt,
  follow: r.follow,
  active: r.active,
  region: r.snapshot?.region,
  status: r.snapshot?.status,
});

/* Laden je Konto und Kontostand (Anmelden, Abmelden, Änderung in einem anderen Tab) */
let loadedFor = "";
let loading = 0;
async function reload() {
  const ticket = ++loading;
  try {
    const d = await api<{ articles?: ServerArticle[] }>("/api/me/articles");
    if (ticket !== loading) return;
    ready = true;
    put((d.articles ?? []).map(fromServer));
  } catch {
    if (ticket !== loading) return;
    ready = true;
    emit();
  }
}
function sync() {
  const me = getMe();
  if (!me.ready) return;
  const key = me.user ? `${me.user.id}:${me.rev}` : "-";
  if (key === loadedFor) return;
  loadedFor = key;
  if (!me.user) {
    loading++;
    ready = true;
    details.clear();
    put(EMPTY);
    return;
  }
  void reload();
}
if (typeof window !== "undefined") onMe(sync);

/** Meldung zu einem gescheiterten Speichern; null, wenn stattdessen der Hinweis zur Grenze offen ist */
function failure(e: unknown): string | null {
  if (e instanceof AccountApiError) {
    if (e.status === 409 && openLimitGate(e.data.limit)) return null;
    if (e.status === 404) return "Diesen Vorgang gibt es nicht mehr.";
    if (e.status === 401) return "Bitte melden Sie sich an.";
    return e.message;
  }
  return "Das hat nicht geklappt. Bitte erneut versuchen.";
}

async function add(a: Omit<SavedArticle, "savedAt">, follow: boolean): Promise<string | null> {
  if (!getMe().user) return "Bitte melden Sie sich an.";
  details.set(a.id, { gemeinde: a.gemeinde, teaser: a.teaser });
  put([{ ...a, savedAt: new Date().toISOString(), follow, active: true }, ...list.filter((x) => x.id !== a.id)]);
  try {
    const r = await api<{ snapshot?: ServerArticle["snapshot"] }>("/api/me/articles", { method: "POST", body: { id: a.id, follow } });
    const s = r.snapshot;
    /* Zusammengeführte Vorgänge: der Server speichert den aktuellen Vorgang */
    if (s) put(list.map((x) => (x.id === a.id ? { ...x, id: s.id, title: s.title || x.title, date: s.date || x.date, region: s.region, status: s.status } : x)));
    touchAccount();
    return null;
  } catch (e) {
    put(list.filter((x) => x.id !== a.id));
    return failure(e);
  }
}

/** Speichern bzw. entfernen; liefert eine Meldung bei einem Fehler (null: erledigt oder Hinweis zur Grenze offen) */
export function toggleSavedArticle(a: Omit<SavedArticle, "savedAt">): Promise<string | null> {
  return list.some((x) => x.id === a.id) ? removeSavedArticle(a.id) : add(a, false);
}

/** Vorgang folgen bzw. entfolgen; folgen speichert den Artikel mit (Benachrichtigung in Thema 1 nur vorgemerkt) */
export async function toggleFollow(a: Omit<SavedArticle, "savedAt" | "follow">): Promise<string | null> {
  const hit = list.find((x) => x.id === a.id);
  if (!hit) return add(a, true);
  const follow = !hit.follow;
  put(list.map((x) => (x.id === a.id ? { ...x, follow } : x)));
  try {
    await api("/api/me/articles", { method: "PATCH", body: { id: a.id, follow } });
    touchAccount();
    return null;
  } catch (e) {
    put(list.map((x) => (x.id === a.id ? { ...x, follow: hit.follow } : x)));
    return failure(e);
  }
}

/** Entfernt den Artikel (sofort in der Anzeige, bei Fehler wieder da) */
export async function removeSavedArticle(id: string): Promise<string | null> {
  const index = list.findIndex((x) => x.id === id);
  if (index < 0) return null;
  const hit = list[index];
  put(list.filter((x) => x.id !== id));
  try {
    await api("/api/me/articles", { method: "DELETE", body: { id } });
    touchAccount();
    return null;
  } catch (e) {
    put([...list.slice(0, index), hit, ...list.slice(index)]);
    return failure(e);
  }
}

/** „Rückgängig“: entfernten Artikel erneut speichern, an seiner Stelle (nach Speicherdatum) */
export async function restoreSavedArticle(a: SavedArticle): Promise<string | null> {
  const err = await add(a, !!a.follow);
  if (!err) put([...list.filter((x) => x.id !== a.id), a].sort((x, y) => (y.savedAt || "").localeCompare(x.savedAt || "")));
  return err;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
export function useSavedArticles(): SavedArticle[] {
  return useSyncExternalStore(subscribe, () => list, () => EMPTY);
}
/** true, sobald die Liste des Kontos geladen ist (oder feststeht, dass niemand angemeldet ist) */
export function useSavedArticlesReady(): boolean {
  return useSyncExternalStore(subscribe, () => ready, () => false);
}
