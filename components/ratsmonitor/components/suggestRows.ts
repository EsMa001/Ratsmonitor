import { regionSuggest, PlaceIndex, type PlaceEntry } from "../lib/place";
import { norm } from "../lib/text";
import { hasScope } from "../lib/savedSearch";
import type { SavedSearch } from "../types";
import { clearRecent } from "../lib/recentSearches";
import type { useData } from "../state/data";
import type { useSearch, useSearchResults } from "../state/search";

/* Zeilen der Vorschlagsliste unter dem Suchfeld: was bei leerer Suche, bei erkanntem Ort und bei Tippen erscheint.
   Reine Funktion der Eingaben (kein eigener Zustand); der Aufrufer (SearchBox) hält Zustand und Anzeige. */

export type Row =
  | { kind: "head"; label: string; action?: { label: string; run: () => void } }
  | { kind: "item"; entry: PlaceEntry; sel: boolean; pick: () => void; scope?: "only" | "with" }
  | { kind: "text"; label: string; silent?: boolean; pick: () => void }
  | { kind: "query"; label: string; pick: () => void }
  | { kind: "recent"; label: string; saved?: boolean; pick: () => void; prefetch?: () => void }
  | { kind: "scope"; label: string; sub: string; sel: boolean; pick: () => void };


/* Text der zuletzt gewählten Zeile (Verlauf, gespeicherte Suche): bleibt im Feld stehen, bis der Chip erscheint. Gesetzt
   im Klick, gelesen beim Bestätigen derselben Suche; nur das sichtbare Feld wählt, deshalb genügt eine Stelle. */
let pickedText = "";
const notePick = (text: string) => {
  pickedText = text;
};
/** Gewählten Text einmal abholen (die Zeile setzt ihn beim Klick, das Feld liest ihn beim Bestätigen) */
export const takePickedText = () => {
  const t = pickedText;
  pickedText = "";
  return t;
};

type Search = ReturnType<typeof useSearch>;
type Results = ReturnType<typeof useSearchResults>;
type Data = ReturnType<typeof useData>;

export interface RowContext {
  open: boolean;
  focused: boolean;
  state: Search["state"];
  recent: string[];
  saved: SavedSearch[];
  search: Search;
  view: string;
  stay: boolean;
  goOverview: () => void;
  setOpen: (v: boolean) => void;
  setRecent: (v: string[]) => void;
  apply: (value: string, extra?: Parameters<Search["applySearch"]>[1]) => void;
  blurField: () => void;
  place: Data["place"];
  geo: Data["geo"];
  pq: Results["pq"];
  placeActive: Results["placeActive"];
  liveHits: Results["liveHits"];
  draft: string;
}

export function buildRows(c: RowContext): Row[] {
  const { open, focused, state, recent, saved, search, view, stay, goOverview, setOpen, setRecent, apply, blurField, place, geo, pq, placeActive, liveHits, draft } = c;
  /* Varianten eines Orts: kreisfreie Städte und Länder nur einmal */
  const variants = (ags: string): ("only" | "with")[] => (hasScope(ags, geo) ? ["only", "with"] : ["only"]);
    /* Leere Suche, Feld im Fokus: zuletzt gesucht und gespeicherte Suchen */
    if (open && focused && !state.q.trim()) {
      const out: Row[] = [];
      const closeAndBlur = () => {
        setOpen(false);
        blurField();
      };
      if (recent.length) {
        /* „Verlauf löschen“ steht in derselben Zeile rechts */
        out.push({ kind: "head", label: "Zuletzt gesucht", action: { label: "Verlauf löschen", run: () => { clearRecent(); setRecent([]); } } });
        for (const q of recent)
          out.push({
            kind: "recent",
            label: q,
            prefetch: () => search.prefetchText(q),
            pick: () => {
              notePick(q);
              apply(q);
              search.commitPlaces();
              closeAndBlur();
            },
          });
      }
      if (saved.length) {
        out.push({ kind: "head", label: "Meine Suchen" });
        for (const sv of saved.slice(0, 5))
          out.push({
            kind: "recent",
            label: sv.name,
            saved: true,
            prefetch: () => search.prefetchSaved(sv),
            pick: () => {
              notePick(sv.text || sv.q || sv.name);
              if (search.applySaved(sv)) {
                if (view !== "overview" && !stay) goOverview();
                closeAndBlur();
              }
            },
          });
      }
      return out;
    }
    if (!open || !state.q.trim() || !place || !geo) return [];
    const out: Row[] = [];
    if (placeActive && pq.place) {
      /* Eine flache Liste: erst Städte/Gemeinden, dann Kreise, dann die Kombinationen.
         Bei einer Kreisstadt also: Stadt, Kreis, Stadt & Kreis */
      const cur = pq.place;
      const all = [cur, ...pq.alts].sort((x, y) => y.ags.length - x.ags.length);
      const choose = (e: PlaceEntry, scope: "only" | "with") => {
        if (e.ags !== cur.ags) {
          const ign = { ...state.placeIgnored };
          delete ign[pq.key];
          apply(state.q, { placeOverrides: { ...state.placeOverrides, [pq.key]: e.ags }, placeIgnored: ign, scope });
        }
        search.setScope(scope);
        search.commitPlaces();
        setOpen(false);
      };
      const combos = all.filter((e) => hasScope(e.ags, geo) && !(e.ags.length === 5 && all.some((o) => o.ags.length === 8 && o.ags.startsWith(e.ags))));
      if (liveHits.length > 1) out.push({ kind: "head", label: "Erkannter Ort" });
      for (const [e, scope] of [...all.map((e) => [e, "only"] as const), ...combos.map((e) => [e, "with"] as const)])
        out.push({ kind: "item", entry: e, scope, sel: e.ags === state.area && (scope === state.scope || !hasScope(e.ags, geo)), pick: () => choose(e, scope) });
    }
    /* Weitere im Text erkannte Orte (zusätzlich zu einem bestehenden Ortsfilter), jeweils mit eigenem Umfang */
    for (const h of liveHits.filter((x) => x.place.ags !== state.area)) {
      out.push({ kind: "head", label: "Weiterer Ort" });
      const cur = state.placeScopes?.[h.place.ags] ?? "only";
      for (const scope of variants(h.place.ags))
        out.push({
          kind: "item",
          entry: h.place,
          scope,
          sel: scope === cur || !hasScope(h.place.ags, geo),
          pick: () => {
            search.setPlaceScope(h.place.ags, scope);
            search.commitPlaces();
            setOpen(false);
          },
        });
    }
    const sg = place.suggest(state.q, placeActive && pq.place ? pq.place.ags : "");
    const lastTok = norm(sg.toks.length ? PlaceIndex.clean(sg.toks[sg.toks.length - 1]) : "");
    /* Keine Vorschläge für ein Wort, das schon zu einem erkannten Ort gehört */
    const recognized = liveHits.map((h) => h.key);
    /* Regionen (z. B. „Münsterland“) als eigene Vorschläge */
    const regs = lastTok ? regionSuggest(lastTok) : [];
    if (regs.length) {
      out.push({ kind: "head", label: "Regionen" });
      for (const name of regs)
        out.push({
          kind: "text",
          label: name,
          pick: () => {
            apply(sg.toks.slice(0, sg.toks.length - 1).concat([name]).join(" "));
            search.commitPlaces();
            setOpen(false);
          },
        });
    }
    if (sg.items.length && !(lastTok && recognized.some((k) => k.split(" ").includes(lastTok)))) {
      out.push({ kind: "head", label: "Orte" });
      for (const e of sg.items)
        for (const scope of variants(e.ags))
        out.push({
          kind: "item",
          entry: e,
          scope,
          sel: false,
          pick: () => {
            const h = geo.get(e.ags);
            const phrase = !h ? e.name : e.ags.length === 5 && !h.kreisfrei ? h.name : h.short ?? h.name;
            const k = norm(phrase);
            const ign = { ...state.placeIgnored };
            delete ign[k];
            const next = sg.toks.slice(0, sg.start).concat([phrase]).join(" ");
            const overrides = { ...state.placeOverrides, [k]: e.ags };
            /* Gibt es schon einen anderen Ort (fest oder im Text), wird der Vorschlag ein weiterer Ort mit eigenem Umfang */
            const primary = place.parse(next, overrides, ign).place;
            const fixed = !!state.area && state.areaSrc !== "search" && state.area !== e.ags;
            if (fixed || (primary && primary.ags !== e.ags)) {
              apply(next, { placeOverrides: overrides, placeIgnored: ign });
              search.setPlaceScope(e.ags, scope);
            } else {
              apply(next, { placeOverrides: overrides, placeIgnored: ign, scope });
              search.setScope(scope);
            }
            /* Gewählter Ort wird fester Filter, das Feld ist frei für den nächsten Begriff */
            search.commitPlaces();
            setOpen(false);
          },
        });
    }
    /* Erste Zeile „Nach … suchen“: der eingetippte Text wird als Suchbegriff verwendet, auch wenn er wie ein Ort heißt
       (Orte wählt man in den Zeilen darunter; Enter ohne Auswahl übernimmt erkannte Orte weiterhin als Filter) */
    if (draft.trim())
      out.unshift({
        kind: "query",
        label: draft.trim(),
        pick: () => {
          /* Erkannte Orte im Text (auch der schon live übernommene) nicht als Ort, sondern als Suchbegriff nehmen */
          const keys = [pq.key, ...(pq.extra ?? []).map((h) => h.key)].filter(Boolean);
          if (keys.length) apply(state.q, { placeIgnored: { ...state.placeIgnored, ...Object.fromEntries(keys.map((k) => [k, true as const])) } });
          search.commitPlaces();
          setOpen(false);
          blurField();
        },
      });
    return out;
}
