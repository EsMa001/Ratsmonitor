import { useEffect, useId, useRef, useState } from "react";
import { useClient } from "../lib/useClient";
import { usePhone, useTinyPhone } from "../lib/usePhone";
import { isReplacement } from "../lib/searchLogic";
import { useData } from "../state/data";
import { useAppNav } from "../state/nav";
import { useSearch, useSearchResults } from "../state/search";
import { useAccount } from "../state/account";
import { addRecent, readRecent } from "../lib/recentSearches";
import { buildRows, takePickedText, type Row } from "./suggestRows";
import { IconCheck, IconStar, IconPin, IconSearch, IconX } from "./icons";

/** Suchfeld mit Ortserkennung und Vorschlagsliste.
 *  glass: Milchglas-Pille (auf der Karte); listMax/listUp: Vorschlagsliste begrenzen bzw. nach oben öffnen,
 *  damit sie nicht über die Karte hinausragt; onSubmit: Suche mit Enter bestätigt */
/** Meldet „Suche bestätigt“ (Enter oder Vorschlag gewählt) – z. B. damit die Suchleiste auf dem Handy nach unten wandert */
const confirmed = () => window.dispatchEvent(new Event("rm:search-confirmed"));
/** Handy (Touch): nach Auswahl eines Vorschlags Feld verlassen, damit die Tastatur verschwindet */
const dropKeyboard = () => {
  if (!window.matchMedia("(pointer: coarse)").matches) return;
  requestAnimationFrame(() => (document.activeElement as HTMLElement | null)?.blur());
};

/** stay: auf der aktuellen Seite bleiben (plenara.X), statt nach einer Suche zur Startseite zu springen */
/* Suchfelder tragen data-search statt einer festen ID: Die Übersicht bleibt versteckt eingebunden, auf Analyse-Seiten gibt
   es dann zwei Felder. Kürzel, Verlauf und Fokus gelten nur für das sichtbare. */
export const isSearchInput = (el: EventTarget | null) => el instanceof HTMLInputElement && el.dataset.search === "q";
const shown = (el: HTMLElement | null) => !!el && el.getClientRects().length > 0;
/** Cursor in das sichtbare Suchfeld setzen */
export function focusSearch() {
  [...document.querySelectorAll<HTMLInputElement>('input[data-search="q"]')].find(shown)?.focus();
}


export function SearchBox({ glass = false, listMax, listUp = false, onSubmit, stay = false, keepFocus = false, placesOnly = false }: { /** Nur Orte und Regionen (plenara.X Werte): keine Suchbegriffe, kein Verlauf */ placesOnly?: boolean; glass?: boolean; listMax?: number; listUp?: boolean; onSubmit?: () => void; stay?: boolean; /** Enter übernimmt Orte, der Cursor bleibt im Feld (z. B. für den zweiten Ort im Ortsvergleich) */ keepFocus?: boolean } = {}) {
  const { geo, place } = useData();
  const search = useSearch();
  const { state } = search;
  const { pq, placeActive, liveHits, pending, searching, showRing } = useSearchResults();
  const { view, goOverview } = useAppNav();
  const inputRef = useRef<HTMLInputElement>(null);
  const uid = useId();
  const ids = { q: uid + "q", list: uid + "list", opt: (i: number) => `${uid}o${i}` };
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  /* Bestätigte Suche (base) bleibt als Chips unter der Leiste; das Feld zeigt nur, was neu dazukommt */
  const [focused, setFocused] = useState(false);
  const [base, setBase] = useState("");
  const { saved } = useAccount();
  const [recent, setRecent] = useState<string[]>([]);
  /* Bestätigte Suche merken (nach dem Anwenden, daher kurz verzögert) */
  const qRef = useRef(state.q);
  useEffect(() => {
    qRef.current = state.q;
  });
  useEffect(() => {
    const on = () => shown(inputRef.current) && window.setTimeout(() => addRecent(qRef.current), 80);
    window.addEventListener("rm:search-confirmed", on);
    return () => window.removeEventListener("rm:search-confirmed", on);
  }, []);
  /* Neue Suche läuft: der abgeschickte Text bleibt im Feld stehen, bis auch der Chip erscheint */
  const [hold, setHold] = useState("");
  /* Ladering erst nach Bestätigen (Enter oder Auswahl aus der Liste), nicht schon beim Tippen */
  const [awaiting, setAwaiting] = useState(false);
  /* Ring: nur nach Bestätigen (Enter oder Auswahl), erst wenn die Suche über 0,5 s dauert (Provider: showRing) und bis auch
     die genaue Trefferzahl da ist. Beim bloßen Tippen bleibt er aus. */
  const [armed, setArmed] = useState(false);
  if (armed && !searching) setArmed(false);
  const draftRef = useRef("");

  useEffect(() => {
    const on = () => {
      setHold(takePickedText() || draftRef.current);
      setAwaiting(true);
      setArmed(true);
    };
    window.addEventListener("rm:search-confirmed", on);
    return () => window.removeEventListener("rm:search-confirmed", on);
  }, []);
  if (!pending && (hold || awaiting)) {
    setHold("");
    setAwaiting(false);
  }
  const ring = armed && showRing;
  const draft = !focused ? "" : base && state.q.startsWith(base) ? state.q.slice(base.length).replace(/^[,;|]?\s*/, "") : state.q;
  useEffect(() => {
    draftRef.current = draft;
  });
  const shownDraft = pending && hold && (!focused || !draft) ? hold : draft;
  const join = (d: string) => (base && state.q.startsWith(base) ? (d ? `${base.replace(/[,;|]\s*$/, "")}, ${d}` : base) : d);

  const apply = (value: string, extra?: Parameters<typeof search.applySearch>[1]) => {
    search.applySearch(value, extra);
    setActive(-1);
    if (view !== "overview" && !stay) goOverview();
  };

  const scopeName = (ags: string, scope?: "only" | "with") => {
    const nm = geo!.info(ags).name;
    if (scope !== "with") return nm;
    return ags.length === 5 ? `${nm} & Gemeinden` : `${nm} & ${geo!.info(ags.slice(0, 5)).name}`;
  };

  /* Feld verlassen aus den Zeilen der Liste (über die ID statt über den Ref: die Zeilen entstehen beim Rendern) */
  const blurField = () => document.getElementById(ids.q)?.blur();
  const rows0 = buildRows({ open, focused, state, recent, saved, search, view, stay, goOverview, setOpen, setRecent, apply, blurField, place, geo, pq, placeActive, liveHits, draft });
  /* Nur Orte: ohne „Nach … suchen“, Verlauf und gespeicherte Suchen (deren Überschriften fallen mit weg) */
  const rows = !placesOnly ? rows0 : rows0.filter((r, i) => r.kind === "head" ? rows0[i + 1] && !["query", "recent"].includes(rows0[i + 1].kind) : !["query", "recent"].includes(r.kind));

  const picks = rows.filter((r): r is Exclude<Row, { kind: "head" }> => r.kind !== "head");
  const showList = open && rows.length > 0;
  /* „Ort erkannt“ nur, solange der erkannte Ort im Feld steht; danach zeigt ihn der Chip darüber */
  const placeOn = state.areaSrc === "search" && !!state.area && !!shownDraft;

  /* Handy: kürzerer Platzhalter, damit er nicht abgeschnitten wird */
  const narrow = usePhone();
  const tiny = useTinyPhone();
  /* Strg+K bzw. ⌘K setzt den Cursor in die Suche */
  const mac = useClient(() => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent), false);
  /* Umschalt+Esc nutzt die aktuelle Fassung (die Aktionen ändern sich mit Karte und Ortsliste) */
  const { resetAll } = search;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!shown(inputRef.current)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }
      /* Umschalt+Esc: Suche und alle Filter zurücksetzen, überall auf der Seite */
      if (e.key === "Escape" && e.shiftKey && !document.querySelector("dialog[open]")) {
        e.preventDefault();
        resetAll();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [resetAll]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const n = picks.length;
    if (e.key === "ArrowDown" && showList && n) {
      e.preventDefault();
      setActive((i) => (i + 1) % n);
    } else if (e.key === "ArrowUp" && showList && n) {
      e.preventDefault();
      setActive((i) => (i - 1 + n) % n);
    } else if (e.key === "Enter") {
      e.preventDefault();
      /* Nur einen ausdrücklich markierten Vorschlag übernehmen; sonst erkannte Orte als Filter festhalten */
      if (showList && n && active >= 0 && picks[active]) picks[active].pick();
      else {
        search.commitPlaces();
        /* Nur Orte: übrig gebliebener Text ist kein Suchbegriff */
        if (placesOnly) search.applySearch("");
        setOpen(false);
        if (!keepFocus) inputRef.current?.blur();
      }
      confirmed();
      onSubmit?.();
    } else if (e.key === "Escape" && !e.shiftKey) {
      if (showList) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      } else if (draft) {
        e.preventDefault();
        apply(join(""));
      } else {
        /* Esc ohne Eingabe: Suche verlassen */
        inputRef.current?.blur();
      }
    }
  };

  /* Mit Pfeiltasten markierter Vorschlag: Suche schon vorab starten */
  const activePick = active >= 0 ? picks[active] : undefined;
  useEffect(() => {
    if (activePick && "prefetch" in activePick) activePick.prefetch?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open]);

  let pickIndex = -1;
  return (
    <div className="relative z-[4] min-w-0">
      {/* Glas nur um das Feld: die Vorschlagsliste liegt daneben, damit ihre eigene Unschärfe die Karte dahinter sieht (verschachtelt wäre sie flach) */}
      <div className={`relative ${glass ? "rm-glass rounded-full" : ""}`}>
      {/* Läuft eine Suche, steht an Stelle der Lupe ein kleiner Ladering */}
      {ring ? (
        <span role="status" aria-label="Suche läuft" className="rm-spinner pointer-events-none absolute left-3.5 top-1/2 -mt-[9px]" />
      ) : (
        <IconSearch size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
      )}
      <label htmlFor={ids.q} className="sr-only">
        Beschlüsse und Artikel durchsuchen
      </label>
      <input
        ref={inputRef}
        id={ids.q}
        data-search="q"
        type="search"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        enterKeyHint="search"
        spellCheck={false}
        placeholder={placesOnly ? (narrow ? "Ort suchen" : "Ort oder Region suchen") : tiny ? "Thema, Ort" : narrow ? "Thema oder Ort" : "Thema, Ort oder Region suchen"}
        role="combobox"
        aria-expanded={showList}
        aria-controls={ids.list}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? ids.opt(active) : undefined}
        value={shownDraft}
        onChange={(e) => {
          setOpen(true);
          const value = join(e.target.value.replace(/^\s+/, ""));
          /* Erkannten Ort überschrieben (statt gelöscht): Ort bleibt als Filter erhalten */
          if (liveHits.length && isReplacement(state.q, value)) search.commitPlaces();
          apply(value);
          /* Komma nach einem Ort: Ort wird fester Filter, weiterschreiben mit dem nächsten Begriff */
          if (/[,;|]\s*$/.test(value)) search.commitPlaces(true);
        }}
        onFocus={() => {
          setBase(state.q);
          setFocused(true);
          setRecent(readRecent());
          setOpen(true);
        }}
        onBlur={() => {
          setFocused(false);
          setOpen(false);
          setActive(-1);
          search.commitPlaces();
        }}
        onKeyDown={onKeyDown}
        className={`h-11 w-full border border-transparent bg-transparent pl-[42px] max-sm:h-12 ${glass ? "rounded-full" : "rounded-xl"} text-[16px] outline-none transition-[border-color,box-shadow,background-color] placeholder:text-slate-400 ${
          placeOn ? "pr-[128px]" : "pr-11"
        }`}
      />
      {placeOn && (
        <span className="pointer-events-none absolute right-11 top-1/2 inline-flex h-6 -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-teal-50 px-2 text-[12px] font-semibold text-teal-700">
          <IconPin size={12} />
          Ort erkannt
        </span>
      )}
      {!focused && !placeOn && (
        <span aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 text-[12px] text-slate-500 sm:block">
          {mac ? "⌘K" : "Strg K"}
        </span>
      )}
      {draft ? (
        <button
          type="button"
          aria-label="Eingabe leeren (Esc)" title="Eingabe leeren (Esc)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            apply(join(""));
            inputRef.current?.focus();
          }}
          className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <IconX />
        </button>
      ) : null}
      </div>
      {showList && (
        <div
          id={ids.list}
          role="listbox"
          aria-label="Erkannte Orte und Vorschläge"
          onMouseDown={(e) => e.preventDefault()}
          style={{ maxHeight: listMax ?? 380 }}
          className={`popover scroll-thin absolute left-0 right-0 z-[1200] min-w-[280px] max-sm:min-w-0 overflow-y-auto ${glass ? "rm-glass rm-glass-pop rounded-[28px] p-2.5" : stay ? "rounded-[28px] p-2.5" : "p-1.5"} ${listUp ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]"}`}
        >
          {rows.map((r, i) => {
            if (r.kind === "head")
              return (
                /* Zwischenüberschrift: keine Auswahl (presentation), damit die Liste nur aus Einträgen besteht */
                <div key={"h" + i} role="presentation" className="flex items-center justify-between gap-3 px-2 pb-1 pt-1.5 text-[12px] font-semibold uppercase tracking-[.04em] text-slate-500">
                  <span>{r.label}</span>
                  {r.action && (
                    <button type="button" onClick={r.action.run} className="text-[12px] font-medium normal-case tracking-normal text-teal-700 hover:underline">
                      {r.action.label}
                    </button>
                  )}
                </div>
              );
            pickIndex++;
            const idx = pickIndex;
            if (r.kind === "scope")
              return (
                <button
                  key={"s" + i}
                  id={ids.opt(idx)}
                  type="button"
                  role="option"
                  aria-selected={r.sel}
                  onClick={() => { r.pick(); confirmed(); dropKeyboard(); }}
                  className={`grid min-h-10 w-full grid-cols-[18px_minmax(0,1fr)] items-center gap-2 rounded-lg px-2 py-1.5 text-left ${r.sel ? "bg-teal-50" : idx === active ? "bg-slate-100" : "hover:bg-slate-100"}`}
                >
                  <span className={`h-3.5 w-3.5 rounded-full border-2 ${r.sel ? "border-teal-600 bg-teal-600 shadow-[inset_0_0_0_2px_white]" : "border-slate-400"}`} />
                  <span className="min-w-0">
                    <span className={`block truncate text-[14px] ${r.sel ? "font-semibold text-teal-700" : "font-medium"}`}>{r.label}</span>
                    <span className="block text-[12px] text-slate-500">{r.sub}</span>
                  </span>
                </button>
              );
            if (r.kind === "query")
              return (
                <button
                  key={"q" + i}
                  id={ids.opt(idx)}
                  type="button"
                  role="option"
                  aria-selected={idx === active}
                  onClick={() => { r.pick(); confirmed(); dropKeyboard(); onSubmit?.(); }}
                  className={`grid min-h-10 w-full grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2 py-1.5 text-left max-sm:min-h-11 ${idx === active ? "bg-slate-100" : "hover:bg-slate-100"}`}
                >
                  <IconSearch size={16} className="text-slate-500" />
                  <span className="block truncate text-[14px] font-medium">Nach „{r.label}“ suchen</span>
                  <span aria-hidden="true" className="text-[12px] text-slate-500 max-sm:hidden">Enter</span>
                </button>
              );
            if (r.kind === "recent")
              return (
                <button
                  key={"r" + i}
                  id={ids.opt(idx)}
                  type="button"
                  role="option"
                  aria-selected={idx === active}
                  onMouseEnter={() => r.prefetch?.()}
                  onTouchStart={() => r.prefetch?.()}
                  onClick={() => { r.pick(); confirmed(); dropKeyboard(); onSubmit?.(); }}
                  className={`grid min-h-10 w-full grid-cols-[18px_minmax(0,1fr)] items-center gap-2 rounded-lg px-2 py-1.5 text-left max-sm:min-h-11 ${idx === active ? "bg-slate-100" : "hover:bg-slate-100"}`}
                >
                  {r.saved ? <IconStar size={16} className="text-slate-500" /> : <IconSearch size={16} className="text-slate-500" />}
                  <span className="block truncate text-[14px] font-medium">{r.label}</span>
                </button>
              );
            if (r.kind === "text")
              return (
                <button
                  key={"t" + i}
                  id={ids.opt(idx)}
                  type="button"
                  role="option"
                  aria-selected={idx === active}
                  onClick={() => { r.pick(); if (!r.silent) { confirmed(); dropKeyboard(); } }}
                  className={`mt-1 w-full border-0 border-t border-slate-200 bg-transparent px-2 pb-[5px] pt-[9px] text-left text-[12px] text-slate-500 hover:text-slate-900 hover:underline hover:underline-offset-2 ${
                    idx === active ? "text-slate-900 underline underline-offset-2" : ""
                  }`}
                >
                  {r.label}
                </button>
              );
            const inf = geo!.info(r.entry.ags);
            return (
              <button
                key={r.entry.ags + (r.scope ?? "") + i}
                id={ids.opt(idx)}
                type="button"
                role="option"
                aria-selected={r.sel}
                onClick={() => { r.pick(); confirmed(); dropKeyboard(); }}
                className={`grid min-h-10 w-full grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2 py-1.5 text-left ${
                  r.sel ? "bg-teal-50" : idx === active ? "bg-slate-100" : "hover:bg-slate-100"
                }`}
              >
                {r.sel ? <IconCheck className="text-teal-700" /> : <IconPin className="text-slate-500" />}
                <span className="min-w-0">
                  <span className={`block truncate text-[14px] ${r.sel ? "font-semibold text-teal-700" : "font-medium"}`}>{scopeName(r.entry.ags, r.scope)}</span>
                  <span className="block text-[12px] text-slate-500">{r.scope === "with" ? (r.entry.ags.length === 5 ? "Kreis und alle Städte und Gemeinden im Kreis" : "Gemeinde und Beschlüsse ihres Kreises") : inf.meta}</span>
                </span>
                <span />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
