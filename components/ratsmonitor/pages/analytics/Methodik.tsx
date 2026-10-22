"use client";
import { useSyncExternalStore, type ReactNode } from "react";
import { useMethodikHost } from "../../lib/methodikHost";
import { createPortal } from "react-dom";
import { MethodikText } from "./AnalyticsAbout";
import type { AnalyseId } from "../../info/branchen-enterprise";

/* Methodik einheitlich unten auf jeder plenara.X-Seite, in der Kachel „Fragen oder Anregungen?“: die Erklärtexte der Seite
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

/** Methodik der Seite (AnalyticsPages): vollständig in der grauen Kachel „Fragen oder Anregungen?“ der Fußzeile (#rm-methodik, Footer.tsx) */
export function MethodikUnten({ seite }: { seite: string }) {
  const ids = METHODIK_VON[seite];
  const host = useMethodikHost();
  if (!ids || !host) return null;
  return createPortal(
    <section id="methodik" aria-labelledby="methodik-h" className="scroll-mt-24 print:break-before-page">
      <h2 id="methodik-h" className="m-0 text-[18px] font-semibold text-slate-900">Methodik</h2>
      {/* eine Schrift (14 px, normal); ! gegen die Grundstile für Überschriften und fette Klassen (app/styles/base.css) */}
      <div className="mt-1 line-clamp-3 text-[12px] leading-[18px] text-slate-600 [&_*]:!inline [&_*]:!text-[12px] [&_*]:!font-normal [&_*]:!leading-[18px] [&_p]:after:content-['_']">
        <div ref={setSlot} className="empty:hidden" />
        <div><MethodikText ids={ids} kurz /></div>
      </div>
    </section>, host);
}

/** Anmerkung einer Auswertung (Grundlage, Zählweise, Stand): erscheint im Methodik-Block unten */
export function MethodikNote({ children }: { children: ReactNode }) {
  const el = useSlot();
  return el ? createPortal(<p className="m-0">{children}</p>, el) : null;
}
