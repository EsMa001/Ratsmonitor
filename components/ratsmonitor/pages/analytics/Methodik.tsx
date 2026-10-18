"use client";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MethodikText } from "./AnalyticsAbout";
import type { AnalyseId } from "../../info/branchen-enterprise";

/* Methodik einheitlich unten auf jeder plenara.X-Seite, über der Kachel „Fragen oder Anregungen?“: die Erklärtexte der Seite
   (AnalyticsAbout) und die Anmerkungen zur jeweiligen Auswertung (MethodikNote). Das Symbol im Kopfband springt hierher (#methodik). */
export const METHODIK_VON: Record<string, [AnalyseId, string][]> = {
  atlas: [["atlas", "Atlas"]], vergleich: [["vergleich", "Vergleich"]], signale: [["signale", "Signale"]], fakten: [["fakten", "Fakten"]],
  trends: [["trends", "Verlauf"], ["diffusion", "Ausbreitung"]], beschluesse: [["beschluesse", "Ausgang"]], fraktionen: [["fraktionen", "Fraktionen"]],
  gremien: [["gremien", "Gremien"]], graph: [["graph", "Themennetz"]], news: [["news", "Aktuelles"]], ausschreibungen: [["ausschreibungen", "Ausschreibungen"]],
};
/* Ablage der Anmerkungen: der Block meldet sein Element, die Anmerkungen hängen sich dort ein */
let slot: HTMLElement | null = null;
const subs = new Set<() => void>();
const setSlot = (el: HTMLElement | null) => { if (slot === el) return; slot = el; subs.forEach((f) => f()); };
const useSlot = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => slot, () => null);

/** Block am Seitenende (AnalyticsPages) */
export function MethodikUnten({ seite }: { seite: string }) {
  const ids = METHODIK_VON[seite];
  const [more, setMore] = useState(false);
  if (!ids) return null;
  return (
    <section id="methodik" aria-labelledby="methodik-h" className="mx-[max(1vw,16px)] mt-12 max-sm:mt-3 scroll-mt-24 border-t border-slate-200 pt-6 print:break-before-page">
      <h2 id="methodik-h" className="m-0 text-[18px] font-semibold text-slate-900">Methodik</h2>
      {/* Handy: eine Schrift (14 px, normal), nur drei Zeilen, der Rest hinter „Weiterlesen“ */}
      <div className={`max-sm:text-[14px] max-sm:leading-5 max-sm:[&_*]:!text-[14px] max-sm:[&_*]:!font-normal max-sm:[&_*]:!leading-5 ${more ? "" : "max-sm:max-h-[68px] max-sm:overflow-hidden"}`}>
        <div ref={setSlot} className="mt-2 max-w-[900px] space-y-2 text-[14px] text-slate-600 empty:hidden" />
        <div className="max-w-[900px]"><MethodikText ids={ids} /></div>
      </div>
      <button type="button" aria-expanded={more} onClick={() => setMore(!more)} className="mt-1 text-[14px] font-medium text-teal-700 hover:underline sm:hidden">{more ? "Weniger" : "Weiterlesen"}</button>
    </section>
  );
}

/** Anmerkung einer Auswertung (Grundlage, Zählweise, Stand): erscheint im Methodik-Block unten */
export function MethodikNote({ children }: { children: ReactNode }) {
  const el = useSlot();
  return el ? createPortal(<p className="m-0">{children}</p>, el) : null;
}
