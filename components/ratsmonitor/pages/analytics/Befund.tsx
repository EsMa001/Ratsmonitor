import { type ReactNode } from "react";
import { useSearchResults } from "../../state/search";
import { prettyTerm } from "../../lib/terms";

const heute = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getFullYear()).slice(2)}`; };

/** Stand der Zahlen: unter dem Befund jeder Auswertung (Methodik über das Seitensymbol im Kopf) */
function AnalyseLeiste() {
  const { text } = useSearchResults();
  return (
    <>
    <p className="m-0 mt-2 hidden text-[14px] text-slate-500 print:block">{text.trim() ? `Suchbegriff „${prettyTerm(text.trim())}“ · ` : ""}Berechnet am {heute()} aus den Ratsinformationssystemen der Kommunen · plenara.X</p>
    <div className="mt-3 max-sm:mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[14px] print:hidden">
      <span className="text-slate-500">Stand {heute()}</span>
    </div>
    </>
  );
}

/** Der Befund einer Auswertung in einem Satz, vor den Zahlen */
export function Befund({ children, tight = false }: { children: ReactNode; tight?: boolean }) {
  return (
    <div className={tight ? "mt-4" : "mt-6"}>
      {/* Eine Größe für alle plenara.X-Seiten (wie Trends und Fakten) */}
      <p className={`m-0 text-[18px] max-sm:text-[16px] font-semibold leading-snug text-slate-900 ${tight ? "" : "max-w-[900px]"}`}>{children}</p>
      <AnalyseLeiste />
    </div>
  );
}

/** Suchbegriff in Anführungszeichen, ohne Begriff „im ganzen Bestand“ */
export const zuThema = (q: string) => (q.trim() ? `bei „${prettyTerm(q.trim())}“` : "im ganzen Bestand");

/** Keine Ergebnisse für die ganze Auswertung: ein Satz, was fehlt, und darunter, was man tun kann (überall gleich) */
export function Leer({ children, tipp = "Suchbegriff kürzen, „Alle Themen“ wählen oder den Ort entfernen." }: { children: ReactNode; tipp?: ReactNode }) {
  return (
    <div role="status" className="mt-6 max-w-[760px] border-l-2 border-slate-300 py-1 pl-4">
      <p className="m-0 text-[18px] font-semibold leading-snug text-slate-900">{children}</p>
      {tipp && <p className="m-0 mt-1 text-[14px] text-slate-500">{tipp}</p>}
    </div>
  );
}

/** Fehler beim Laden oder Rechnen: gleiche Form wie Leer, mit roter Linie */
export function Fehler({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="mt-4 max-w-[760px] border-l-2 border-amber-500 py-1 pl-4">
      <p className="m-0 text-[16px] font-medium text-slate-900">{children}</p>
      <p className="m-0 mt-1 text-[14px] text-slate-500">Bitte gleich noch einmal versuchen; Suche und Filter bleiben erhalten.</p>
    </div>
  );
}
