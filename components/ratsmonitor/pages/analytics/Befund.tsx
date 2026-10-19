import { type ReactNode } from "react";
import { useSearch, useSearchResults } from "../../state/search";
import { prettyTerm } from "../../lib/terms";

const heute = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getFullYear()).slice(2)}`; };

/** Stand der Zahlen: unter dem Befund jeder Auswertung (Methodik über das Seitensymbol im Kopf) */
function AnalyseLeiste() {
  const { text } = useSearchResults();
  return (
    <>
    <p className="m-0 mt-2 hidden text-[14px] text-slate-500 print:block">{text.trim() ? `Suchbegriff „${prettyTerm(text.trim())}“ · ` : ""}Berechnet am {heute()} aus den Ratsinformationssystemen der Kommunen · plenara.X</p>
    <div className="mt-1.5 max-sm:mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[14px] print:hidden">
      <span className="text-slate-500">Stand {heute()}</span>
    </div>
    </>
  );
}

/** Der Befund einer Auswertung in einem Satz, vor den Zahlen */
export function Befund({ children, tight = false, noPhone = false }: { children: ReactNode; tight?: boolean; /** Handy: Satz und Stand weglassen */ noPhone?: boolean }) {
  return (
    <div className={`${tight ? "mt-3" : "mt-4"}${noPhone ? " max-sm:hidden" : ""}`}>
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
      <LeerBeispiele />
    </div>
  );
}

/** Weiter statt Sackgasse: Auswahl zurücksetzen oder ein Beispiel mit Treffern anklicken (alle gegen die Daten geprüft) */
const BEISPIELE = ["Solarpark", "Wärmeplanung", "Hebesatz"];
function LeerBeispiele() {
  const search = useSearch();
  return (
    <p className="m-0 mt-3 flex flex-wrap items-center gap-2 text-[14px] text-slate-500 print:hidden">
      <span>Zum Beispiel:</span>
      {BEISPIELE.map((b) => <button key={b} type="button" onClick={() => { search.resetAll(); search.applySearch(b); }} className="inline-flex h-8 items-center rounded-full border border-slate-200 bg-white px-3 text-slate-700 hover:border-slate-400">{b}</button>)}
      <button type="button" onClick={() => search.resetAll()} className="inline-flex h-8 items-center px-1 font-medium text-teal-700 hover:underline">Auswahl zurücksetzen</button>
    </p>
  );
}

/** Fehler beim Laden oder Rechnen: gleiche Form wie Leer, mit roter Linie */
export function Fehler({ children, onNochmal }: { children: ReactNode; /** Knopf „Noch einmal“: rechnet mit derselben Auswahl neu */ onNochmal?: () => void }) {
  return (
    <div role="alert" className="mt-4 max-w-[760px] border-l-2 border-amber-500 py-1 pl-4">
      <p className="m-0 text-[16px] font-medium text-slate-900">{children}</p>
      <p className="m-0 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-slate-500">
        Deine Auswahl bleibt erhalten.
        {onNochmal && <button type="button" onClick={onNochmal} className="inline-flex h-8 items-center rounded-full border border-teal-700 px-3 font-medium text-teal-700 hover:bg-teal-50">Noch einmal</button>}
      </p>
    </div>
  );
}
