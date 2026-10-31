import { useEffect, useRef, useState } from "react";
import { ApiError, errorText, fetchJson } from "../../lib/fetchJson";
import { DOCS_PATH } from "../../lib/routes";
import { isoDay } from "../../lib/text";

/* Dokumentsuche (Pro): Abfrage in der Adresse (/dokumente?q=…&ort=…&zeit=…&art=…&sort=datum&seite=2) und Abruf von
   /api/dokumente (Backend server/integrations/doc-search.mjs). */
export type DocSnippet = { page: number; before: string; hit: string; after: string };
export type DocHit = {
  id: string; topicId: string; title: string; topicTitle: string; gemeinde: string; ags: string; gremium: string; date: string;
  art: string; url: string; docIndex: number; pages: number; hits: number; snippets: DocSnippet[];
};
export type DocResult = { total: number; capped: boolean; pagesFound: number; page: number; pageSize: number; revision: string; documents: DocHit[] };
export type DocQuery = { q: string; ort: string; zeit: string; art: string; sort: "relevance" | "desc"; seite: number };

/** Dokumentarten des Filters (DOC_ARTS im Backend) */
export const ARTS: { value: string; label: string }[] = [
  { value: "vorlage", label: "Vorlage oder Antrag" },
  { value: "beschluss", label: "Beschluss" },
  { value: "niederschrift", label: "Niederschrift" },
  { value: "einladung", label: "Einladung" },
  { value: "anlage", label: "Anlage" },
  { value: "sonstige", label: "Sonstiges" },
];
export const ART_LABEL: Record<string, string> = Object.fromEntries(ARTS.map((a) => [a.value, a.label]));
/** Zeiträume als Kürzel in der Adresse */
export const ZEITEN: { value: string; label: string }[] = [
  { value: "", label: "Alle Jahre" },
  { value: "3m", label: "Letzte 3 Monate" },
  { value: "12m", label: "Letzte 12 Monate" },
  { value: "jahr", label: "Dieses Jahr" },
  { value: "vorjahr", label: "Letztes Jahr" },
];
/** Höchste Seite der Liste (PAGE_MAX im Backend) */
export const PAGE_MAX = 50;

/** Zeitraum-Kürzel → von/bis (Sitzungstag) */
function range(zeit: string, today = new Date()): { from?: string; to?: string } {
  const y = today.getFullYear();
  const back = (months: number) => isoDay(new Date(y, today.getMonth() - months, today.getDate()));
  if (zeit === "3m") return { from: back(3) };
  if (zeit === "12m") return { from: back(12) };
  if (zeit === "jahr") return { from: `${y}-01-01` };
  if (zeit === "vorjahr") return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
  return {};
}

/** Adresse → Abfrage; Unbekanntes fällt auf den Standard */
export function readDocQuery(p: URLSearchParams): DocQuery {
  const ort = p.get("ort") ?? "";
  const zeit = p.get("zeit") ?? "";
  const art = p.get("art") ?? "";
  const seite = Number(p.get("seite") ?? 1);
  return {
    q: (p.get("q") ?? "").slice(0, 200),
    ort: /^(\d{2}|\d{5}|\d{8,9})$/.test(ort) ? ort : "",
    zeit: ZEITEN.some((z) => z.value === zeit) ? zeit : "",
    art: ART_LABEL[art] ? art : "",
    sort: p.get("sort") === "datum" ? "desc" : "relevance",
    seite: Number.isInteger(seite) && seite >= 1 && seite <= PAGE_MAX ? seite : 1,
  };
}

/** Abfrage → Adresse der Seite (nur was vom Standard abweicht) */
export function docsHref(q: Partial<DocQuery>): string {
  const p = new URLSearchParams();
  if (q.q?.trim()) p.set("q", q.q.trim());
  if (q.ort) p.set("ort", q.ort);
  if (q.zeit) p.set("zeit", q.zeit);
  if (q.art) p.set("art", q.art);
  if (q.sort === "desc") p.set("sort", "datum");
  if (q.seite && q.seite > 1) p.set("seite", String(q.seite));
  const s = p.toString();
  return DOCS_PATH + (s ? `?${s}` : "");
}

/** Abfrage → Adresse der Route; ein Kreis (5 Stellen) zählt mit seinen Gemeinden, eine Gemeinde nur selbst */
function apiUrl(q: DocQuery): string {
  const p = new URLSearchParams({ q: q.q.trim() });
  if (q.ort) {
    p.set("area", q.ort);
    p.set("scope", q.ort.length === 5 ? "with" : "only");
  }
  const { from, to } = range(q.zeit);
  if (from) p.set("from", from);
  if (to) p.set("to", to);
  if (q.art) p.set("art", q.art);
  if (q.sort === "desc") p.set("sort", "desc");
  if (q.seite > 1) p.set("page", String(q.seite));
  return `/api/dokumente?${p}`;
}

type State = { key: string; result?: DocResult; error?: string; status?: number };
/**
 * Ergebnis je Abfrage (null: nicht abfragen, etwa ohne Pro). Blättern schickt den Stand der ersten Seite mit (revision); hat
 * sich der Index dazwischen geändert (409), fragt es ohne Stand neu. Das Ergebnis liegt je Abfrage, gesetzt erst nach der
 * Antwort (kein setState im Effekt selbst); loading, solange zur aktuellen Abfrage keins vorliegt.
 */
export function useDocSearch(q: DocQuery | null) {
  const key = q && q.q.trim() ? apiUrl(q) : "";
  const filter = q && q.q.trim() ? apiUrl({ ...q, seite: 1 }) : "";
  const [state, setState] = useState<State>({ key: "" });
  const revision = useRef<{ filter: string; revision: string } | null>(null);
  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    const known = revision.current?.filter === filter && key !== filter ? revision.current.revision : "";
    const load = (rev: string) => fetchJson<DocResult>(rev ? `${key}&revision=${rev}` : key, { signal: ctrl.signal }, "Die Dokumentsuche konnte nicht geladen werden.");
    load(known)
      .catch((e: unknown) => (e instanceof ApiError && e.status === 409 ? load("") : Promise.reject(e)))
      .then((result) => {
        revision.current = { filter, revision: result.revision };
        setState({ key, result });
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        setState({ key, error: errorText(e, "Die Dokumentsuche konnte nicht geladen werden."), status: e instanceof ApiError ? e.status : 0 });
      });
    return () => ctrl.abort();
  }, [key, filter]);
  const current = state.key === key ? state : null;
  return { result: current?.result ?? null, error: current?.error ?? "", status: current?.status ?? 0, loading: !!key && !current };
}
