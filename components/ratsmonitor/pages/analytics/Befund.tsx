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

/** Keine Ergebnisse für die ganze Auswertung (überall gleich): ein Satz, was fehlt, ein Tipp der Seite und darunter Knöpfe, die genau
    die gesetzten Filter lösen (Ort, Umkreis, Begriff, Thema, Zeitraum, Stand); ohne gesetzte Filter Beispiele mit Treffern.
    ohne: Filterarten, die die Seite nicht nutzt (Werte: Begriff und Thema); extra: eigene Knöpfe zuerst (Atlas: Unterthema) */
export function Leer({ children, tipp, ohne = [], extra = [], beispiele = true }: { children: ReactNode; tipp?: ReactNode; ohne?: ("q" | "thema")[]; extra?: [string, () => void][]; beispiele?: boolean }) {
  const search = useSearch();
  const { state } = search;
  const aktionen: [string, () => void][] = [
    ...extra,
    ...(state.area ? [["Ganz Deutschland zeigen", () => search.clearArea()] as [string, () => void]] : []),
    ...(state.radius ? [["Umkreis entfernen", () => search.clearRadius()] as [string, () => void]] : []),
    ...(state.q.trim() && !ohne.includes("q") ? [["Suchbegriff entfernen", () => search.applySearch("")] as [string, () => void]] : []),
    ...(state.thema && !ohne.includes("thema") ? [["Alle Themen zeigen", () => search.setThema("")] as [string, () => void]] : []),
    ...(state.von || state.bis || state.monat ? [["Zeitraum entfernen", () => search.setZeitraum("", "")] as [string, () => void]] : []),
    ...(state.status ? [["Alle Stände zeigen", () => search.setStatus("")] as [string, () => void]] : []),
  ];
  return (
    <div role="status" className="mt-6 max-w-[760px] border-l-2 border-slate-300 py-1 pl-4">
      <p className="m-0 text-[18px] font-semibold leading-snug text-slate-900">{children}</p>
      {tipp && <p className="m-0 mt-1 text-[14px] text-slate-500">{tipp}</p>}
      {aktionen.length > 0 ? <p className="m-0 mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[14px] font-medium text-teal-700 print:hidden">
        {aktionen.map(([text, run]) => <button key={text} type="button" onClick={run} className="hover:underline">{text} →</button>)}
      </p> : beispiele && <LeerBeispiele />}
    </div>
  );
}

/** Weiter statt Sackgasse ohne gesetzte Filter: ein Beispiel mit Treffern anklicken (alle gegen die Daten geprüft) */
const BEISPIELE = ["Solarpark", "Wärmeplanung", "Hebesatz"];
function LeerBeispiele() {
  const search = useSearch();
  return (
    <p className="m-0 mt-3 flex flex-wrap items-center gap-2 text-[14px] text-slate-500 print:hidden">
      <span>Zum Beispiel:</span>
      {BEISPIELE.map((b) => <button key={b} type="button" onClick={() => { search.resetAll(); search.applySearch(b); }} className="inline-flex h-8 items-center rounded-full border border-slate-200 bg-white px-3 text-slate-700 hover:border-slate-400">{b}</button>)}
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
