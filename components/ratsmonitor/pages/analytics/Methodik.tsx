"use client";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MethodikText } from "./AnalyticsAbout";
import type { AnalyseId } from "../../info/branchen-enterprise";

/* Methodik einheitlich unten auf jeder plenara.X-Seite, über der Kachel „Fragen oder Anregungen?“: die Erklärtexte der Seite
   (AnalyticsAbout) und die Anmerkungen zur jeweiligen Auswertung (MethodikNote). Das Symbol im Kopfband springt hierher (#methodik). */
const METHODIK_VON: Record<string, [AnalyseId, string][]> = {
  atlas: [["atlas", "Themenatlas"]], vergleich: [["vergleich", "Vergleich"]], signale: [["signale", "Projekte"]], fakten: [["fakten", "Werte"]],
  trends: [["trends", "Verlauf"], ["diffusion", "Ausbreitung"]], beschluesse: [["beschluesse", "Beschlusslage"]], fraktionen: [["fraktionen", "Fraktionen"]],
  gremien: [["gremien", "Gremien"]], graph: [["graph", "Themennetz"]], news: [["news", "Nachrichten"]], ausschreibungen: [["ausschreibungen", "Ausschreibungen"]],
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
      {/* eine Schrift (14 px, normal), nur drei Zeilen, der Rest hinter „Weiterlesen“ */}
      <div className={`text-[14px] leading-5 [&_*]:!text-[14px] [&_*]:!font-normal [&_*]:!leading-5 print:!max-h-none ${more ? "" : "max-h-[68px] overflow-hidden"}`}>
        <div ref={setSlot} className="mt-2 max-w-[900px] space-y-2 text-[14px] text-slate-600 empty:hidden" />
        <div className="max-w-[900px]"><MethodikText ids={ids} offen /></div>
      </div>
      <button type="button" aria-expanded={more} onClick={() => setMore(!more)} className="mt-1 inline-flex min-h-[36px] items-center text-[14px] font-medium text-teal-700 hover:underline max-sm:min-h-[44px] print:hidden">{more ? "Weniger" : "Weiterlesen"}</button>
    </section>
  );
}

/** Anmerkung einer Auswertung (Grundlage, Zählweise, Stand): erscheint im Methodik-Block unten */
export function MethodikNote({ children }: { children: ReactNode }) {
  const el = useSlot();
  return el ? createPortal(<p className="m-0">{children}</p>, el) : null;
}
