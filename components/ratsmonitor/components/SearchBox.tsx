import { regionSuggest } from "../lib/place";
import { useEffect, useRef, useState } from "react";
import { PlaceIndex, type PlaceEntry } from "../lib/place";
import { norm } from "../lib/text";
import { hasScope } from "../lib/savedSearch";
import { isReplacement } from "../lib/searchLogic";
import { useData } from "../state/data";
import { useAppNav } from "../state/nav";
import { useSearch, useSearchResults } from "../state/search";
import { useAccount } from "../state/account";
import { addRecent, clearRecent, readRecent } from "../lib/recentSearches";
import { IconCheck, IconHeart, IconPin, IconSearch, IconX } from "./icons";

type Row =
  | { kind: "head"; label: string; action?: { label: string; run: () => void } }
  | { kind: "item"; entry: PlaceEntry; sel: boolean; pick: () => void; scope?: "only" | "with" }
  | { kind: "text"; label: string; silent?: boolean; pick: () => void }
  | { kind: "query"; label: string; pick: () => void }
  | { kind: "recent"; label: string; saved?: boolean; pick: () => void; prefetch?: () => void }
  | { kind: "scope"; label: string; sub: string; sel: boolean; pick: () => void };

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
export function SearchBox({ glass = false, listMax, listUp = false, onSubmit, stay = false, keepFocus = false }: { glass?: boolean; listMax?: number; listUp?: boolean; onSubmit?: () => void; stay?: boolean; /** Enter übernimmt Orte, der Cursor bleibt im Feld (z. B. für den zweiten Ort im Gebietsvergleich) */ keepFocus?: boolean } = {}) {
  const { geo, place } = useData();
  const search = useSearch();
  const { state } = search;
  const { pq, placeActive, liveHits, pending, searching, showRing } = useSearchResults();
  const { view, goOverview } = useAppNav();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  /* Bestätigte Suche (base) bleibt als Chips unter der Leiste; das Feld zeigt nur, was neu dazukommt */
  const [focused, setFocused] = useState(false);
  const [base, setBase] = useState("");
  const { saved } = useAccount();
  const [recent, setRecent] = useState<string[]>([]);
  /* Bestätigte Suche merken (nach dem Anwenden, daher kurz verzögert) */
  const qRef = useRef(state.q);
  qRef.current = state.q;
  useEffect(() => {
    const on = () => window.setTimeout(() => addRecent(qRef.current), 80);
    window.addEventListener("rm:search-confirmed", on);
    return () => window.removeEventListener("rm:search-confirmed", on);
  }, []);
  /* Neue Suche läuft: der abgeschickte Text bleibt im Feld stehen, bis auch der Chip erscheint */
  const [hold, setHold] = useState("");
  /* Ladering erst nach Bestätigen (Enter oder Auswahl aus der Liste), nicht schon beim Tippen */
  const [awaiting, setAwaiting] = useState(false);
  const draftRef = useRef("");
  const pickText = useRef("");
  useEffect(() => {
    const on = () => {
      setHold(pickText.current || draftRef.current);
      pickText.current = "";
      setAwaiting(true);
      setArmed(true);
    };
    window.addEventListener("rm:search-confirmed", on);
    return () => window.removeEventListener("rm:search-confirmed", on);
  }, []);
  useEffect(() => {
    if (!pending && (hold || awaiting)) {
      setHold("");
      setAwaiting(false);
    }
  }, [pending, hold, awaiting]);
  /* Ring: nur nach Bestätigen (Enter oder Auswahl), erst wenn die Suche über 0,5 s dauert (Provider: showRing) und bis auch
     die genaue Trefferzahl da ist. Beim bloßen Tippen bleibt er aus. */
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (armed && !searching) setArmed(false);
  }, [armed, searching]);
  const ring = armed && showRing;
  const draft = !focused ? "" : base && state.q.startsWith(base) ? state.q.slice(base.length).replace(/^[,;|]?\s*/, "") : state.q;
  draftRef.current = draft;
  const shownDraft = pending && hold && (!focused || !draft) ? hold : draft;
  const join = (d: string) => (base && state.q.startsWith(base) ? (d ? `${base.replace(/[,;|]\s*$/, "")}, ${d}` : base) : d);

  const apply = (value: string, extra?: Parameters<typeof search.applySearch>[1]) => {
    search.applySearch(value, extra);
    setActive(-1);
    if (view !== "overview" && !stay) goOverview();
  };

  /* Varianten eines Orts: kreisfreie Städte und Länder nur einmal */
  const variants = (ags: string): ("only" | "with")[] => (hasScope(ags, geo) ? ["only", "with"] : ["only"]);
  const scopeName = (ags: string, scope?: "only" | "with") => {
    const nm = geo!.info(ags).name;
    if (scope !== "with") return nm;
    return ags.length === 5 ? `${nm} & Gemeinden` : `${nm} & ${geo!.info(ags.slice(0, 5)).name}`;
  };

  const rows = ((): Row[] => {
    /* Leere Suche, Feld im Fokus: zuletzt gesucht und gespeicherte Suchen */
    if (open && focused && !state.q.trim()) {
      const out: Row[] = [];
      const closeAndBlur = () => {
        setOpen(false);
        inputRef.current?.blur();
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
              pickText.current = q;
              apply(q);
              search.commitPlaces();
              closeAndBlur();
            },
          });
      }
      if (saved.length) {
        out.push({ kind: "head", label: "Gespeicherte Suchen" });
        for (const sv of saved.slice(0, 5))
          out.push({
            kind: "recent",
            label: sv.name,
            saved: true,
            prefetch: () => search.prefetchSaved(sv),
            pick: () => {
              pickText.current = sv.text || sv.q || sv.name;
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
          inputRef.current?.blur();
        },
      });
    return out;
  })();

  const picks = rows.filter((r): r is Exclude<Row, { kind: "head" }> => r.kind !== "head");
  const showList = open && rows.length > 0;
  const placeOn = state.areaSrc === "search" && !!state.area;

  /* Schmale Bildschirme: kürzerer Platzhalter, damit er nicht abgeschnitten wird */
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 480px)");
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  /* Strg+K bzw. ⌘K setzt den Cursor in die Suche */
  const [mac, setMac] = useState(false);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }
      /* Umschalt+Esc: Suche und alle Filter zurücksetzen, überall auf der Seite */
      if (e.key === "Escape" && e.shiftKey && !document.querySelector("dialog[open]")) {
        e.preventDefault();
        search.resetAll();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

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
      <label htmlFor="q" className="sr-only">
        Beschlüsse und Artikel durchsuchen
      </label>
      <input
        ref={inputRef}
        id="q"
        type="search"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        enterKeyHint="search"
        spellCheck={false}
        placeholder={narrow ? "Thema oder Ort" : "Thema, Ort oder Region suchen"}
        role="combobox"
        aria-expanded={showList}
        aria-controls="search-assist"
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `sa-${active}` : undefined}
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
          id="search-assist"
          role="listbox"
          aria-label="Erkannte Orte und Vorschläge"
          onMouseDown={(e) => e.preventDefault()}
          style={{ maxHeight: listMax ?? 380 }}
          className={`popover scroll-thin absolute left-0 right-0 z-[1200] min-w-[280px] max-sm:min-w-0 overflow-y-auto p-1.5 ${glass ? "rm-glass rm-glass-pop !rounded-[28px] !p-2.5" : stay ? "!rounded-[28px] !p-2.5" : ""} ${listUp ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]"}`}
        >
          {rows.map((r, i) => {
            if (r.kind === "head")
              return (
                <div key={"h" + i} className="flex items-center justify-between gap-3 px-2 pb-1 pt-1.5 text-[12px] font-semibold uppercase tracking-[.04em] text-slate-500">
                  <span>{r.label}</span>
                  {r.action && (
                    <button type="button" onClick={r.action.run} className="text-[12px] font-medium normal-case tracking-normal text-teal-600 hover:underline">
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
                  id={`sa-${idx}`}
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
                  id={`sa-${idx}`}
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
                  id={`sa-${idx}`}
                  type="button"
                  role="option"
                  aria-selected={idx === active}
                  onMouseEnter={() => r.prefetch?.()}
                  onTouchStart={() => r.prefetch?.()}
                  onClick={() => { r.pick(); confirmed(); dropKeyboard(); onSubmit?.(); }}
                  className={`grid min-h-10 w-full grid-cols-[18px_minmax(0,1fr)] items-center gap-2 rounded-lg px-2 py-1.5 text-left max-sm:min-h-11 ${idx === active ? "bg-slate-100" : "hover:bg-slate-100"}`}
                >
                  {r.saved ? <IconHeart size={16} className="text-slate-500" /> : <IconSearch size={16} className="text-slate-500" />}
                  <span className="block truncate text-[14px] font-medium">{r.label}</span>
                </button>
              );
            if (r.kind === "text")
              return (
                <button
                  key={"t" + i}
                  id={`sa-${idx}`}
                  type="button"
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
                id={`sa-${idx}`}
                type="button"
                role="option"
                aria-selected={r.sel}
                onClick={() => { r.pick(); confirmed(); dropKeyboard(); }}
                className={`grid min-h-10 w-full grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2 py-1.5 text-left ${
                  r.sel ? "bg-teal-50" : idx === active ? "bg-slate-100" : "hover:bg-slate-100"
                }`}
              >
                {r.sel ? <IconCheck className="text-teal-600" /> : <IconPin className="text-slate-500" />}
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
