import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { useSearchResults } from "../../state/search";
import { useToast } from "../../state/toast";
import { prettyTerm } from "../../lib/terms";

const heute = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getFullYear()).slice(2)}`; };

/** Link kopieren, Drucken und Herkunft der Zahlen: unter dem Befund jeder Auswertung */
function AnalyseLeiste({ link = true }: { link?: boolean }) {
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
    /* Der Atlas nutzt ?thema= für eines der 10 Themen und liest den Suchbegriff aus ?q=; die übrigen Analysen lesen ihn aus ?thema= */
    if (text.trim()) u.searchParams.set(u.pathname === "/analytics/atlas" ? "q" : "thema", text.trim());
    navigator.clipboard?.writeText(u.toString()).then(() => toast("Link kopiert.")).catch(() => toast("Der Link konnte nicht kopiert werden."));
  };
  return (
    <>
    <p className="m-0 mt-2 hidden text-[14px] text-slate-500 print:block">{text.trim() ? `Suchbegriff „${prettyTerm(text.trim())}“ · ` : ""}Berechnet am {heute()} aus den Ratsinformationssystemen der Kommunen · plenara.X</p>
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[14px] print:hidden">
      {link && <button type="button" onClick={kopieren} className="font-medium text-teal-700">Link kopieren</button>}
      <span className="text-slate-500">Berechnet am {heute()} aus den Ratsinformationssystemen der Kommunen · <Link href="/analytics/methodik" className="text-teal-700">Methodik</Link></span>
    </div>
    </>
  );
}

/** Der Befund einer Auswertung in einem Satz, vor den Zahlen */
/** link: „Link kopieren“ zeigen (der Atlas verzichtet darauf) */
export function Befund({ children, link = true, tight = false }: { children: ReactNode; link?: boolean; tight?: boolean }) {
  return (
    <div className={tight ? "mt-4" : "mt-6"}>
      {/* Eine Größe für alle plenara.X-Seiten (wie Trends und Fakten) */}
      <p className={`m-0 text-[20px] font-semibold leading-snug text-slate-900 ${tight ? "" : "max-w-[900px]"}`}>{children}</p>
      <AnalyseLeiste link={link} />
    </div>
  );
}

/** Suchbegriff in Anführungszeichen, ohne Begriff „im ganzen Bestand“ */
export const zuThema = (q: string) => (q.trim() ? `bei „${prettyTerm(q.trim())}“` : "im ganzen Bestand");
