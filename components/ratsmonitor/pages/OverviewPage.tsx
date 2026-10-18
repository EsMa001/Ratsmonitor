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
  const peek = hasFilters(snapshot) && total > 0 && !peekHidden;
  const mainRef = useRef<HTMLElement>(null);
  /* Neue Suche oder Blatt „voll“: die Vorschau ist wieder da */
  const snapKey = JSON.stringify(snapshot);
  useEffect(() => { setPeekHidden(false); }, [snapKey]);
  useEffect(() => { if (stage === "voll") setPeekHidden(false); }, [stage]);
  /* Handy: Wischen mit dem Finger auf dem Blatt. Nach unten: voll → klein, klein → minimal (ohne Vorschau). Nach oben: minimal → klein, klein → voll.
     Im vollen Blatt zählt nur ein Zug nach unten, wenn die Liste ganz oben steht (sonst scrollt sie). */
  const pull = useRef<{ y: number; top: number; t: number; range: number; drag: number } | null>(null);
  const flatOf = (e: React.TouchEvent) => (e.currentTarget as HTMLElement).parentElement as HTMLElement;
  const sheetTouch = {
    onTouchStart: (e: React.TouchEvent) => {
      if (!isPhone()) return;
      const m = mainRef.current, flat = flatOf(e);
      const range = m ? m.offsetHeight - (parseFloat(getComputedStyle(flat).getPropertyValue("--klein")) || 63) : 0;
      pull.current = { y: e.touches[0].clientY, top: m?.scrollTop ?? 0, t: Date.now(), range, drag: 0 };
    },
    /* Das Blatt folgt dem Finger (klein → voll nach oben, voll → klein nach unten); gewählt wird beim Loslassen */
    onTouchMove: (e: React.TouchEvent) => {
      const s = pull.current; if (!s || s.range <= 0) return;
      const dy = e.touches[0].clientY - s.y;
      const d = stage === "klein" ? (dy < 0 ? Math.max(dy, -s.range) : 0) : (dy > 0 && s.top <= 0 ? Math.min(dy, s.range) : 0);
      if (Math.abs(d) < 6 && !s.drag) return;
      s.drag = d;
      const flat = flatOf(e);
      flat.setAttribute("data-drag", "1");
      flat.style.setProperty("--drag", `${d}px`);
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = pull.current; pull.current = null;
      if (!s || !isPhone()) return;
      const flat = flatOf(e);
      const dy = e.changedTouches[0].clientY - s.y;
      if (s.drag) {
        /* Stufe gleich beim Loslassen setzen (Suchleiste und Blatt laufen zusammen los); das Blatt startet dort, wo der Finger es verlassen hat, und gleitet in die Ruhelage */
        const fast = Date.now() - s.t < 260 && Math.abs(dy) > 20;
        const go = Math.abs(s.drag) >= 44 || fast;
        const from = stage === "klein" ? (go ? s.range + s.drag : s.drag) : (go ? s.drag - s.range : s.drag);
        flat.setAttribute("data-drag", "1");
        flat.style.setProperty("--drag", `${from}px`);
        flushSync(() => { if (go) setSheetStage(stage === "klein" ? "voll" : "klein"); });
        void flat.offsetHeight;
        flat.removeAttribute("data-drag");
        flat.style.setProperty("--drag", "0px");
        window.setTimeout(() => flat.style.removeProperty("--drag"), 400);
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
    onTouchCancel: (e: React.TouchEvent) => { pull.current = null; const flat = flatOf(e); flat.style.removeProperty("--drag"); flat.removeAttribute("data-drag"); },
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
