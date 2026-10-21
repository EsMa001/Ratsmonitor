import { LABELS } from "@/shared/labels.mjs";
import type { SearchState, StatusId } from "../types";
import { STATUS } from "./constants";

/*
 * Die Suche in der Adresse (/suche?q=…&ort=…): lesbar, kurz, nur was vom Standard abweicht. Geschrieben und gelesen von
 * SearchProvider (state/search.tsx). Beispiel: /suche?q=Kita&ort=05515&km=10&thema=bildung&von=@d30&status=approved
 *
 *   q        Suchtext, wie er im Feld steht (ein dort erkannter Ort bleibt Teil des Texts)
 *   ort      erster Ortsfilter (AGS); ortq=1: der Ort stammt aus dem Suchtext
 *   umfang   „mit“: inklusive Kreis bzw. Gemeinden (Standard: nur das Gebiet)
 *   ebene    „kreis“: Kreisebene der Karte (Standard: Gemeinden)
 *   km       Umkreis um den Ort
 *   mehr     weitere Orte: AGS:nur|mit, durch Komma getrennt
 *   thema    Kennung des Themas (bildung, bauen …)
 *   monat, von, bis, status, sort (alt, relevanz)
 *   zukunft=1, formalien=1 (Formalien zeigen), alle=1 (alle Begriffe), genau=1 (ganze Wörter)
 */

const THEMA_ID = new Map<string, string>(LABELS.map((l: { id: string; name: string }) => [l.name, l.id]));
const THEMA_NAME = new Map<string, string>(LABELS.map((l: { id: string; name: string }) => [l.id, l.name]));
const STATUS_IDS = new Set<string>(STATUS.map((s) => s.id));
const AGS = /^\d{2}(\d{3}(\d{3})?)?$/;
const DAY = /^(\d{4}-\d{2}-\d{2}|@[a-z]\d{1,3})$/;
const SORT_OUT: Record<string, string> = { asc: "alt", relevance: "relevanz" };
const SORT_IN: Record<string, SearchState["sort"]> = { alt: "asc", relevanz: "relevance" };

/** @ (Zeitraum-Kürzel), Komma und Doppelpunkt (weitere Orte) sind in der Adresse erlaubt: lesbar lassen. Gilt für das
 *  Schreiben und für den Vergleich mit der aktuellen Adresse (sonst hielte der Abgleich beide Schreibweisen für verschieden). */
export const readableQuery = (q: string) => q.replace(/%40/g, "@").replace(/%2C/g, ",").replace(/%3A/g, ":");

/** Alle Schlüssel, die zur Suche gehören (andere Parameter der Adresse bleiben unberührt) */
const SEARCH_URL_KEYS = ["q", "ort", "ortq", "umfang", "ebene", "km", "mehr", "thema", "monat", "von", "bis", "status", "sort", "zukunft", "formalien", "alle", "genau"];

/** Suchstand → Teil der Adresse (feste Reihenfolge, damit gleiche Suchen dieselbe Adresse haben) */
export function searchToUrl(s: SearchState): string {
  const p = new URLSearchParams();
  if (s.q.trim()) p.set("q", s.q.trim());
  if (s.area) {
    p.set("ort", s.area);
    if (s.areaSrc === "search") p.set("ortq", "1");
    if (s.scope === "with") p.set("umfang", "mit");
  }
  if (s.level === "district") p.set("ebene", "kreis");
  if (s.radius && s.radius.ags === s.area) p.set("km", String(s.radius.km));
  if (s.morePlaces?.length && !s.radius) p.set("mehr", s.morePlaces.map((m) => `${m.ags}:${m.scope === "with" ? "mit" : "nur"}`).join(","));
  if (s.thema) p.set("thema", THEMA_ID.get(s.thema) ?? s.thema);
  if (s.monat) p.set("monat", s.monat);
  if (s.von) p.set("von", s.von);
  if (s.bis) p.set("bis", s.bis);
  if (s.status) p.set("status", s.status);
  if (s.sort !== "desc") p.set("sort", SORT_OUT[s.sort] ?? s.sort);
  if (s.future) p.set("zukunft", "1");
  if (!s.noformal) p.set("formalien", "1");
  if (s.allterms) p.set("alle", "1");
  if (s.exact) p.set("genau", "1");
  return readableQuery(p.toString());
}

/** Nur der Suchtext (Links aus E-Mails: /?q=…): wird wie eine Eingabe im Feld übernommen, mit Ortserkennung */
export const onlyText = (p: URLSearchParams) => !!p.get("q") && SEARCH_URL_KEYS.every((k) => k === "q" || !p.has(k));

/**
 * Teil der Adresse → Suchstand, ausgehend von base (Standardsuche). Unbekannte oder ungültige Werte fallen weg.
 * null, solange für einen Umkreis die Karte (Mittelpunkt des Orts) noch fehlt.
 */
export function searchFromUrl(p: URLSearchParams, base: SearchState, center: (ags: string) => { x: number; y: number } | null | undefined): SearchState | null {
  const ort = p.get("ort") ?? "";
  const area = AGS.test(ort) ? ort : "";
  const km = Number(p.get("km"));
  let radius: SearchState["radius"] = null;
  if (area.length >= 5 && km > 0 && km <= 500) {
    const c = center(area);
    if (!c) return null;
    radius = { ags: area, x: c.x, y: c.y, km };
  }
  const more = (p.get("mehr") ?? "").split(",").map((x) => x.split(":")).filter(([ags]) => AGS.test(ags ?? "") && ags !== area)
    .map(([ags, sc]) => ({ ags, scope: (sc === "mit" ? "with" : "only") as "only" | "with" }));
  const day = (k: string) => (DAY.test(p.get(k) ?? "") ? p.get(k)! : "");
  const status = p.get("status") ?? "";
  const monat = p.get("monat") ?? "";
  return {
    ...base,
    q: (p.get("q") ?? "").slice(0, 300),
    area,
    areaSrc: area ? (p.get("ortq") === "1" ? "search" : "ui") : "",
    scope: area && p.get("umfang") === "mit" ? "with" : "only",
    level: p.get("ebene") === "kreis" ? "district" : "city",
    radius,
    morePlaces: radius ? [] : more,
    placeScopes: Object.fromEntries(more.map((m) => [m.ags, m.scope])),
    placeOverrides: {},
    placeIgnored: {},
    thema: THEMA_NAME.get(p.get("thema") ?? "") ?? "",
    monat: /^\d{4}-\d{2}$/.test(monat) ? monat : "",
    von: day("von"),
    bis: day("bis"),
    status: STATUS_IDS.has(status) ? (status as StatusId) : "",
    sort: SORT_IN[p.get("sort") ?? ""] ?? "desc",
    future: p.get("zukunft") === "1",
    noformal: p.get("formalien") !== "1",
    allterms: p.get("alle") === "1",
    exact: p.get("genau") === "1",
  };
}
