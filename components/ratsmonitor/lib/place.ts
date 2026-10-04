import type { MapData } from "../types";
import { isCovered } from "./constants";
import type { GeoModel } from "./geo/geoModel";
import { norm } from "./text";

type Kind = "land" | "kfs" | "krs" | "stadt" | "gem" | "gfr";

export interface PlaceEntry {
  ags: string;
  name: string;
  kind: Kind;
  n: string;
}

export interface PlaceHit {
  place: PlaceEntry;
  alts: PlaceEntry[];
  /** normalisierte Suchphrase des Orts */
  key: string;
  /** Ortsname so, wie er eingegeben wurde */
  phraseRaw: string;
}

export interface ParseResult {
  place: PlaceEntry | null;
  alts: PlaceEntry[];
  /** Eingabe ohne den ersten erkannten Ortsnamen */
  rest: string;
  /** normalisierte Suchphrase des Orts */
  key: string;
  /** Ortsname so, wie er eingegeben wurde */
  phraseRaw: string;
  /** Weitere erkannte Orte (mehrere Orte parallel, z. B. „Billerbeck, Coesfeld, Kita“) */
  extra?: PlaceHit[];
  /** Eingabe ohne alle erkannten Ortsnamen: der eigentliche Suchtext */
  restAll?: string;
}

export interface SuggestResult {
  items: PlaceEntry[];
  start: number;
  toks: string[];
}

const KIND_SCORE: Record<Kind, number> = { land: 100, kfs: 90, stadt: 60, gem: 50, krs: 40, gfr: 5 };

/** Einzelwörter, die nie allein als Ort gelten (häufige Namensbestandteile und Fachbegriffe) */
const STOP = new Set(
  "berg wald bach see hof stein burg rain heide moor ried tal feld linden eichen dorf horn kirchen weiler hausen haus stadt kreis land markt brunn born ort holz hain rot lage wiesen buch eich ahorn wiese zell kita rat schule bahn brucke brueck mitte nord sud ost west neustadt altstadt insel hafen park weil mark grund wasser ende ober unter mittel klein gross neu alt bad sankt".split(
    " ",
  ),
);

const ALIAS: Record<string, string> = {
  nrw: "05", nds: "03", ni: "03", bw: "08", rlp: "07", mv: "13", mvp: "13", sh: "01", bayern: "09", hessen: "06", sachsen: "14",
  berlin: "11", hamburg: "02", bremen: "04", saarland: "10", thueringen: "16", thuringen: "16",
};

const clean = (tok: string) => tok.replace(/^[„"'(«»|]+|[“"'),.;:!?«»|]+$/g, "");

/** Wörter der Eingabe; Trennzeichen ohne Leerzeichen („Billerbeck,Kita“) trennen ebenfalls */
const splitToks = (raw: string) => raw.replace(/([,;|])(?=\S)/g, "$1 ").split(/\s+/).filter(Boolean);

/** Übrig gebliebene Trennzeichen und Bindewörter („oder“, „und“) am Rand entfernen */
function tidy(t: string): string {
  let s = t.replace(/\s+/g, " ").replace(/\b(oder|und)(?:\s+(?:oder|und))+\b/gi, "$1").trim();
  for (let prev = ""; s !== prev; ) {
    prev = s;
    s = s.replace(/^(?:[,;|]\s*|(?:oder|und)\s+)/i, "").replace(/(?:\s*[,;|]|\s+(?:oder|und))$/i, "").trim();
  }
  return s;
}

function bases(name: string): string[] {
  const b1 = name.replace(/\s*\(.*?\)\s*$/, "").trim();
  const out: string[] = [];
  for (const x of [name, b1, b1.replace(/\s+(am|an der|an dem|im|in der|in|ob der|bei|vor der)\s.+$/i, "").trim(), b1.replace(/,.*$/, "").trim()])
    if (x && !out.includes(x)) out.push(x);
  return out;
}

/**
 * Ortserkennung für die Suchleiste: findet Kommunen, Kreise und Bundesländer in der Eingabe
 * (längste Wortfolge gewinnt, bis zu fünf Wörter) und bewertet gleichnamige Treffer.
 */
export class PlaceIndex {
  private byKey = new Map<string, { e: PlaceEntry; alias: boolean }[]>();
  private entries: PlaceEntry[] = [];
  private geo: GeoModel;

  constructor(data: MapData, geo: GeoModel) {
    this.geo = geo;
    const add = (key: string, e: PlaceEntry | undefined, alias: boolean) => {
      if (!key || key.length < 3 || !e) return;
      let a = this.byKey.get(key);
      if (!a) this.byKey.set(key, (a = []));
      if (!a.some((x) => x.e === e)) a.push({ e, alias });
    };
    const mk = (ags: string, name: string, kind: Kind): PlaceEntry => {
      const e = { ags, name, kind, n: norm(name) };
      this.entries.push(e);
      return e;
    };
    const landE = new Map<string, PlaceEntry>();
    data.land.a.forEach((a, i) => {
      const e = mk(a, data.land.n[i], "land");
      landE.set(a, e);
      bases(e.name).forEach((n, j) => add(norm(n), e, j > 0));
    });
    Object.entries(ALIAS).forEach(([k, a]) => add(k, landE.get(a), false));
    const kfs = new Set<string>();
    data.krs.a.forEach((a, i) => {
      const b = data.krs.b?.[i] ?? 0;
      const isKfs = b >= 2;
      if (isKfs) kfs.add(a);
      const e = mk(a, data.krs.n[i], isKfs ? "kfs" : "krs");
      bases(e.name).forEach((n, j) => {
        add(norm(n), e, j > 0);
        if (isKfs) add(norm("stadt " + n), e, false);
        else for (const p of ["kreis ", "landkreis ", "lk ", "kr "]) add(norm(p + n), e, false);
      });
    });
    data.gem.a.forEach((a, i) => {
      if (kfs.has(a.slice(0, 5))) return; // kreisfreie Stadt ist bereits als Kreis erfasst
      const bez = data.gem.b?.[i] ?? 0;
      const e = mk(a, data.gem.n[i], bez === 1 ? "stadt" : bez === 2 ? "gfr" : "gem");
      bases(e.name).forEach((n, j) => {
        add(norm(n), e, j > 0);
        add(norm((bez === 1 ? "stadt " : "gemeinde ") + n), e, false);
      });
    });
  }

  private score(e: PlaceEntry, rawLower: string, alias: boolean): number {
    let s = KIND_SCORE[e.kind];
    if (alias) s -= 30;
    if (rawLower && e.name.toLowerCase() === rawLower) s += 25;
    /* Angebundene Länder zuerst: gleichnamige Orte dort sind gemeint */
    if (e.ags.startsWith("05") || e.ags.startsWith("03")) s += 15;
    return s + Math.min(10, Math.log10(1 + this.geo.areaSize(e.ags)) * 3);
  }

  /** Erster Ort plus alle weiteren Orte der Eingabe; restAll ist der reine Suchtext */
  parse(q: string, overrides: Record<string, string>, ignored: Record<string, true>): ParseResult {
    const first = this.parseOne(q, overrides, ignored);
    if (!first.place) return { ...first, extra: [], restAll: tidy(first.rest) };
    const extra: PlaceHit[] = [];
    const seen = new Set([first.place.ags]);
    let rest = first.rest;
    for (let i = 0; i < 8; i++) {
      const next = this.parseOne(rest, overrides, ignored);
      if (!next.place) break;
      rest = next.rest;
      if (seen.has(next.place.ags)) continue;
      seen.add(next.place.ags);
      extra.push({ place: next.place, alts: next.alts, key: next.key, phraseRaw: next.phraseRaw });
    }
    return { ...first, extra, restAll: tidy(rest) };
  }

  private parseOne(q: string, overrides: Record<string, string>, ignored: Record<string, true>): ParseResult {
    const raw = (q || "").trim();
    const none: ParseResult = { place: null, alts: [], rest: raw, key: "", phraseRaw: "" };
    if (!raw) return none;
    const toks = splitToks(raw);
    for (let len = Math.min(5, toks.length); len >= 1; len--) {
      for (let st = 0; st + len <= toks.length; st++) {
        const phraseRaw = toks.slice(st, st + len).map(clean).join(" ").trim();
        const key = norm(phraseRaw);
        if (key.length < 3 || ignored[key] || (len === 1 && STOP.has(key))) continue;
        const list = this.byKey.get(key);
        if (!list) continue;
        const rl = phraseRaw.toLowerCase();
        const ranked = list
          .map((x) => ({ e: x.e, s: this.score(x.e, rl, x.alias) }))
          .sort((a, b) => b.s - a.s)
          .map((x) => x.e);
        const ov = overrides[key];
        if (ov) {
          const i = ranked.findIndex((e) => e.ags === ov);
          if (i > 0) ranked.unshift(ranked.splice(i, 1)[0]);
        }
        return { place: ranked[0], alts: ranked.slice(1, 6), rest: toks.slice(0, st).concat(toks.slice(st + len)).join(" "), key, phraseRaw };
      }
    }
    return none;
  }

  /** Vorschläge für das zuletzt getippte Wort, solange es noch kein vollständiger Ortsname ist */
  suggest(q: string, exclude = ""): SuggestResult {
    const toks = splitToks((q || "").trim());
    for (let len = Math.min(3, toks.length); len >= 1; len--) {
      const st = toks.length - len;
      const p = norm(toks.slice(st).map(clean).join(" "));
      if (p.length < 3) continue;
      const hits = this.entries.filter((e) => e.n.startsWith(p) && (!exclude || e.ags !== exclude));
      if (!hits.length) continue;
      hits.sort(
        (a, b) =>
          Number(b.n === p) - Number(a.n === p) || this.score(b, "", false) - this.score(a, "", false) || a.name.localeCompare(b.name, "de"),
      );
      return { items: hits.slice(0, 6), start: st, toks };
    }
    return { items: [], start: 0, toks };
  }

  static clean = clean;
}

/** Text der Suche ohne die als Gebiet übernommenen Orte */
export function textPart(q: string, area: string, areaSrc: string, pq: ParseResult): string {
  return pq.place && areaSrc === "search" && area === pq.place.ags ? (pq.restAll ?? pq.rest) : q;
}

/** Entfernt einen Ortsnamen aus der Eingabe (z. B. beim Löschen seines Filter-Chips) */
export function removePhrase(q: string, phraseRaw: string): string {
  const toks = splitToks(q);
  const target = norm(phraseRaw);
  for (let len = Math.min(5, toks.length); len >= 1; len--)
    for (let st = 0; st + len <= toks.length; st++)
      if (norm(toks.slice(st, st + len).map(clean).join(" ")) === target) {
        const before = toks.slice(0, st), after = toks.slice(st + len);
        /* Trennzeichen des entfernten Worts erhalten, damit Alternativen getrennt bleiben */
        const sep = /[,;|]$/.exec(toks[st + len - 1])?.[0];
        if (sep && before.length && after.length && !/[,;|]$/.test(before[before.length - 1])) before[before.length - 1] += sep;
        return tidy(before.concat(after).join(" "));
      }
  return q;
}
