import type { SearchState } from "../types";
import type { ParseResult, PlaceHit } from "./place";

/** Ortserkennung mit den Einstellungen des Zustands (Ersatz-Alternativen, ignorierte Phrasen) */
export type Parse = (q: string, s: SearchState) => ParseResult;
type Scope = "only" | "with";

/** Ortsfilter steht fest (aus Karte, Gebietsfilter oder übernommen) und hängt nicht mehr am Suchtext */
export const isCommitted = (s: SearchState) => !!s.area && s.areaSrc !== "search";

/**
 * Neuer Suchtext. Ist noch kein fester Ortsfilter gesetzt, wird der erste erkannte Ort live als Gebiet
 * übernommen; ein fester Ortsfilter bleibt stehen, neu getippte Orte gelten dann zusätzlich.
 * focus: Gebiet, auf das die Karte schwenken soll ("" = Deutschland), undefined = nicht schwenken.
 */
export function applySearchState(s: SearchState, value: string, parse: Parse): { next: SearchState; focus?: string } {
  const pq = parse(value, s);
  const committed = isCommitted(s);
  const next: SearchState = { ...s, q: value, level: !committed && pq.place?.ags.length === 8 ? "city" : s.level };
  if (pq.place) {
    if (!committed && (s.area !== pq.place.ags || s.areaSrc !== "search")) {
      next.area = pq.place.ags;
      next.areaSrc = "search";
      return { next, focus: pq.place.ags };
    }
  } else if (s.areaSrc === "search") {
    next.area = "";
    next.areaSrc = "";
    return { next, focus: "" };
  }
  return { next };
}

/**
 * Erkannte Orte als feste Filter übernehmen und aus dem Text entfernen, damit das Feld frei
 * für den nächsten Begriff ist. sep: Eingabe endete mit einem Trennzeichen (weiterschreiben).
 */
export function commitPlacesState(s: SearchState, sep: boolean, parse: Parse): SearchState | null {
  const pq = parse(s.q, s);
  if (!pq.place) return null;
  const hits = [pq.place, ...(pq.extra ?? []).map((h) => h.place)];
  let { area, areaSrc, scope, level } = s;
  const more = [...(s.morePlaces ?? [])];
  for (const p of hits) {
    if (p.ags === area) {
      areaSrc = "ui";
      continue;
    }
    if (!area) {
      area = p.ags;
      areaSrc = "ui";
      scope = s.placeScopes?.[p.ags] ?? s.scope;
      if (p.ags.length === 8) level = "city";
      continue;
    }
    if (!more.some((m) => m.ags === p.ags)) more.push({ ags: p.ags, scope: s.placeScopes?.[p.ags] ?? "only" });
  }
  const rest = pq.restAll ?? "";
  return { ...s, area, areaSrc, scope, level, morePlaces: more, q: sep && rest ? rest + ", " : rest };
}

/**
 * Wurde Text ersetzt statt nur gelöscht? (z. B. alles markiert und neuen Begriff getippt)
 * Dann sollen bisher erkannte Orte als Filter erhalten bleiben; reines Löschen entfernt sie.
 */
export function isReplacement(prev: string, next: string): boolean {
  let p = 0;
  while (p < prev.length && p < next.length && prev[p] === next[p]) p++;
  let s = 0;
  while (s < prev.length - p && s < next.length - p && prev[prev.length - 1 - s] === next[next.length - 1 - s]) s++;
  const removed = prev.length - p - s;
  const inserted = next.length - p - s;
  return removed > 1 && inserted > 0;
}

/** Ersten Ortsfilter entfernen; der nächste weitere Ort rückt nach */
export function clearAreaState(s: SearchState, parse: Parse): SearchState {
  const [next, ...rest] = s.morePlaces ?? [];
  const pq = s.areaSrc === "search" ? parse(s.q, s) : null;
  return { ...s, ...(pq?.place ? { q: pq.rest } : {}), area: next?.ags ?? "", areaSrc: next ? "ui" : "", scope: next?.scope ?? s.scope, morePlaces: rest };
}

/** Aus Zustand und Ortserkennung: wirksame Ortsfilter und der eigentliche Suchtext */
export function deriveFilters(s: SearchState, pq: ParseResult, hasScope: (ags: string) => boolean) {
  const placeActive = !!(pq.place && s.areaSrc === "search" && s.area === pq.place.ags);
  const committed = isCommitted(s);
  const parsed: PlaceHit[] = pq.place ? [{ place: pq.place, alts: pq.alts, key: pq.key, phraseRaw: pq.phraseRaw }, ...(pq.extra ?? [])] : [];
  /* Live-Orte zählen, wenn der erste Ort aus dem Text stammt oder schon ein fester Ortsfilter besteht */
  const liveHits = placeActive || committed ? parsed : [];
  const text = placeActive || (committed && parsed.length) ? (pq.restAll ?? pq.rest) : s.q;
  const scopeOf = (ags: string): Scope => (hasScope(ags) ? s.placeScopes?.[ags] ?? "only" : "only");
  const more: { ags: string; scope: Scope }[] = [];
  for (const m of [...(s.morePlaces ?? []), ...liveHits.map((h) => ({ ags: h.place.ags, scope: scopeOf(h.place.ags) }))])
    if (m.ags !== s.area && !more.some((x) => x.ags === m.ags)) more.push(m);
  return { placeActive, liveHits, text, more };
}
