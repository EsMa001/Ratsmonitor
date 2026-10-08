import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { useSearchResults } from "../../state/search";
import { useToast } from "../../state/toast";
import { prettyTerm } from "../../lib/terms";

const heute = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getFullYear()).slice(2)}`; };

/** Link kopieren, Drucken und Herkunft der Zahlen: unter dem Befund jeder Auswertung */
function AnalyseLeiste() {
  const { text } = useSearchResults();
  const toast = useToast();
  /* Beim Drucken (auch mit Strg+P) alle eingeklappten Blöcke zeigen und danach wieder einklappen */
  useEffect(() => {
    let zu: HTMLDetailsElement[] = [];
    const vor = () => { zu = [...document.querySelectorAll<HTMLDetailsElement>("main details:not([open])")]; zu.forEach((d) => (d.open = true)); };
    const nach = () => { zu.forEach((d) => (d.open = false)); zu = []; };
    window.addEventListener("beforeprint", vor);
    window.addEventListener("afterprint", nach);
    return () => { window.removeEventListener("beforeprint", vor); window.removeEventListener("afterprint", nach); };
  }, []);
  const kopieren = () => {
    const u = new URL(window.location.href);
    if (text.trim()) u.searchParams.set("thema", text.trim());
    navigator.clipboard?.writeText(u.toString()).then(() => toast("Link kopiert.")).catch(() => toast("Der Link konnte nicht kopiert werden."));
  };
  return (
    <>
    <p className="m-0 mt-2 hidden text-[14px] text-slate-500 print:block">{text.trim() ? `Suchbegriff „${prettyTerm(text.trim())}“ · ` : ""}Berechnet am {heute()} aus den Ratsinformationssystemen der Kommunen · plenara.X</p>
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[14px] print:hidden">
      <button type="button" onClick={kopieren} className="font-medium text-teal-600">Link kopieren</button>
      <button type="button" onClick={() => window.print()} className="font-medium text-teal-600">Drucken oder als PDF</button>
      <span className="text-slate-500">Berechnet am {heute()} aus den Ratsinformationssystemen der Kommunen · <Link href="/analytics/ueber#methodik" className="text-teal-600">Methodik</Link></span>
    </div>
    </>
  );
}

/** Der Befund einer Auswertung in einem Satz, vor den Zahlen */
export function Befund({ children }: { children: ReactNode }) {
  return (
    <div className="mt-8">
      <p className="m-0 max-w-[860px] text-[22px] font-medium leading-snug text-slate-900">{children}</p>
      <AnalyseLeiste />
    </div>
  );
}

/** Suchbegriff in Anführungszeichen, ohne Begriff „im ganzen Bestand“ */
export const zuThema = (q: string) => (q.trim() ? `bei „${prettyTerm(q.trim())}“` : "im ganzen Bestand");
