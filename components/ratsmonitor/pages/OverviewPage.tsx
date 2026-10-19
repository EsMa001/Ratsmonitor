import { flushSync } from "react-dom";
import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPanel } from "../components/map/MapPanel";
import { SearchFilterPanel } from "../components/SearchFilterPanel";
import { ResultsPanel } from "../components/results/ResultsPanel";
import { useAccount } from "../state/account";
import { overviewScroll } from "../state/nav";
import { useSearch, useSearchResults } from "../state/search";
import { hasFilters } from "../lib/savedSearch";
import { useSheetStage, setSheetStage, usePeekHidden, setPeekHidden } from "../lib/sheetStage";
import { useFiltersOpen } from "../lib/filtersOpen";
import { isPhone } from "../lib/usePhone";

/**
 * Übersicht mit Karte und Ergebnisliste. Bleibt beim Wechsel auf Detail- und Kontoseiten
 * eingehängt (nur ausgeblendet), damit Kartenausschnitt und Zustand erhalten bleiben.
 */
export function OverviewPage({ active }: { active: boolean }) {
  const wasActive = useRef(active);
  const stage = useSheetStage();
  /* Handy: nach einer Suche zeigt das kleine Blatt schon die ersten Treffer (Vorschau), damit man sieht, dass sie geklappt hat */
  const { snapshot, total } = useSearchResults();
  const peekHidden = usePeekHidden();
  const peek = total > 0 && !peekHidden;
  const mainRef = useRef<HTMLElement>(null);
  /* Neue Suche oder Blatt „voll“: die Vorschau ist wieder da */
  const snapKey = JSON.stringify(snapshot);
  /* Mit Suche oder Filter beginnt das kleine Blatt mit Vorschau, ohne bleibt es zuerst minimal (große Karte); mittelgroß gibt es in beiden Fällen */
  useEffect(() => { setPeekHidden(!hasFilters(snapshot)); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapKey]);
  useEffect(() => { if (stage === "voll") setPeekHidden(false); }, [stage]);
  /* Handy: Wischen mit dem Finger auf dem Blatt. Nach unten: voll → klein, klein → minimal (ohne Vorschau). Nach oben: minimal → klein, klein → voll.
     Im vollen Blatt zählt nur ein Zug nach unten, wenn die Liste ganz oben steht (sonst scrollt sie). */
  const canPeek = total > 0;
  const pull = useRef<{ y: number; top: number; t: number; range: number; k: number; peekT: number; mode: "" | "stage" | "peek"; drag: number } | null>(null);
  const flatOf = (e: React.TouchEvent) => (e.currentTarget as HTMLElement).parentElement as HTMLElement;
  const setVars = (flat: HTMLElement, d: number, k: number, lf: number) => { flat.style.setProperty("--drag", `${d}px`); flat.style.setProperty("--sb", `${d * k}px`); flat.style.setProperty("--lf", `${lf}px`); };
  const clearVars = (flat: HTMLElement) => { for (const v of ["--drag", "--sb", "--lf"]) flat.style.removeProperty(v); };
  const sheetTouch = {
    onTouchStart: (e: React.TouchEvent) => {
      if (!isPhone()) return;
      const m = mainRef.current, flat = flatOf(e);
      const klein = parseFloat(getComputedStyle(flat).getPropertyValue("--klein")) || 63;
      const range = m ? m.offsetHeight - klein : 0;
      /* Weg der Suchleiste zwischen kleinem und vollem Blatt (liegt unten auf der Karte, mit Vorschau um deren Höhe höher, bzw. oben im Streifen) */
      const sec = flat.querySelector(":scope>section") as HTMLElement | null;
      const sbd = Math.max(0, (sec?.offsetHeight ?? 0) - 184);
      pull.current = { y: e.touches[0].clientY, top: m?.scrollTop ?? 0, t: Date.now(), range, drag: 0, mode: "", peekT: 221 - 63, k: range > 0 ? Math.max(0, sbd - (klein - 63)) / range : 0 };
    },
    /* Das Blatt folgt dem Finger (klein → voll nach oben, voll → klein nach unten, Vorschau ↔ minimal); gewählt wird beim Loslassen */
    onTouchMove: (e: React.TouchEvent) => {
      const s = pull.current; if (!s || s.range <= 0) return;
      const dy = e.touches[0].clientY - s.y;
      if (!s.mode) {
        if (Math.abs(dy) < 6) return;
        if (stage === "klein" && dy < 0) s.mode = peekHidden && canPeek ? "peek" : "stage";
        else if (stage === "klein" && dy > 0 && peek) s.mode = "peek";
        else if (stage === "voll" && dy > 0 && s.top <= 0) s.mode = "stage";
        else return;
      }
      const flat = flatOf(e);
      if (s.mode === "stage") {
        s.drag = stage === "klein" ? Math.max(dy, -s.range) : Math.min(dy, s.range);
        if (stage === "klein" ? s.drag > 0 : s.drag < 0) s.drag = 0;
        flat.setAttribute("data-drag", "1");
        setVars(flat, s.drag, s.k, 0);
      } else {
        /* Vorschau ↔ minimal: Blatt, Suchleiste, Kartenknöpfe und Quellenangabe laufen zusammen */
        s.drag = peek ? Math.max(0, Math.min(dy, s.peekT)) : Math.min(0, Math.max(dy, -s.peekT));
        flat.setAttribute("data-drag", "1");
        setVars(flat, s.drag, 1, s.drag);
      }
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = pull.current; pull.current = null;
      if (!s || !isPhone()) return;
      const flat = flatOf(e);
      const dy = e.changedTouches[0].clientY - s.y;
      if (s.mode) {
        /* Stufe gleich beim Loslassen setzen (alles läuft zusammen los); das Blatt startet dort, wo der Finger es verlassen hat, und gleitet in die Ruhelage */
        const fast = Date.now() - s.t < 260 && Math.abs(dy) > 20;
        const go = Math.abs(s.drag) >= 44 || fast;
        let from = s.drag, k = s.k, lf = 0;
        if (s.mode === "stage") from = stage === "klein" ? (go ? s.range + s.drag : s.drag) : (go ? s.drag - s.range : s.drag);
        else { k = 1; from = go ? (peek ? s.drag - s.peekT : s.drag + s.peekT) : s.drag; lf = from; }
        flat.setAttribute("data-drag", "1");
        setVars(flat, from, k, lf);
        flushSync(() => {
          if (!go) return;
          if (s.mode === "stage") setSheetStage(stage === "klein" ? "voll" : "klein");
          else setPeekHidden(peek);
        });
        void flat.offsetHeight;
        flat.removeAttribute("data-drag");
        setVars(flat, 0, 0, 0);
        window.setTimeout(() => clearVars(flat), 400);
        return;
      }
      if (Math.abs(dy) < 44) return;
      if (dy > 0) {
        if (stage === "voll") { if (s.top <= 0) setSheetStage("klein"); }
        else if (peek) setPeekHidden(true);
      } else if (stage === "klein") {
        if (peekHidden) setPeekHidden(false); else setSheetStage("voll");
      }
    },
    onTouchCancel: (e: React.TouchEvent) => { pull.current = null; const flat = flatOf(e); clearVars(flat); flat.removeAttribute("data-drag"); },
  };
  /* Handy: die Filter öffnen sich auf der Karte; dafür braucht sie ihre volle Höhe */
  const filtersOpen = useFiltersOpen();
  useEffect(() => { if (filtersOpen && isPhone()) setSheetStage("klein"); }, [filtersOpen]);
  /* Handy: beim Einklappen läuft die Liste weich nach oben, damit am Ende die ersten Treffer als Vorschau stehen */
  useEffect(() => { if (stage === "klein") mainRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }, [stage]);
  /* Handy: wer ins Suchfeld tippt, braucht die Karte für Vorschläge und Ergebnis */
  useEffect(() => {
    if (!active) return;
    const on = (e: FocusEvent) => { if (isPhone() && e.target instanceof HTMLInputElement && e.target.closest(".rm-flat>section")) setSheetStage("klein"); };
    document.addEventListener("focusin", on);
    return () => document.removeEventListener("focusin", on);
  }, [active]);
  const search = useSearch();
  const { saved, ready } = useAccount();
  /* Links auf gespeicherte Suchen (E-Mails): /?suche=<id> öffnet sie mit allen Einstellungen. App.tsx leitet / nach /suche um;
     gelesen wird erst hier, sobald die Übersicht zu sehen ist. Danach schreibt SearchProvider die Suche in die Adresse.
     Alle übrigen Parameter (?q=, ?ort=, …) liest SearchProvider selbst (lib/searchUrl.ts). */
  const params = useSearchParams();
  const router = useRouter();
  const linkId = active ? params.get("suche") : null;
  const handled = useRef("");
  useEffect(() => {
    if (!linkId) {
      handled.current = "";
      return;
    }
    if (handled.current === linkId || !ready) return;
    const sv = saved.find((x) => x.id === linkId);
    if (sv && !search.applySaved(sv)) return;
    handled.current = linkId;
    router.replace("/suche", { scroll: false });
  }, [linkId, saved, ready, search, router]);

  useEffect(() => {
    if (active && !wasActive.current) {
      const s = overviewScroll.current;
      overviewScroll.current = null;
      requestAnimationFrame(() => {
        window.scrollTo(0, s ? s.y : 0);
        /* Handy: die Liste scrollt im Blatt (main), nicht im Fenster */
        if (isPhone() && mainRef.current) mainRef.current.scrollTop = s ? s.list : 0;
        else if (s && overviewScroll.listEl) {
          overviewScroll.listEl.scrollTop = s.list;
          const link = s.id ? overviewScroll.listEl.querySelector<HTMLAnchorElement>(`a[href="/beschluss/${s.id}"]`) : null;
          link?.focus({ preventScroll: true });
        }
      });
    }
    wasActive.current = active;
  }, [active]);

  return (
    <div hidden={!active} className="rm-flat" data-stage={stage} data-peek={peek ? "1" : undefined}>
      <MapPanel active={active} />
      <main ref={mainRef} {...sheetTouch} id={active ? "inhalt" : undefined} className="mx-auto flex max-w-page max-sm:max-w-none flex-col gap-[12px] pb-0 pt-0">
        {active && <h1 className="sr-only">Kommunalpolitik entdecken: öffentliche Vorgänge, Beratungen und Beschlüsse</h1>}
        <SearchFilterPanel />
        <ResultsPanel />
      </main>
    </div>
  );
}
