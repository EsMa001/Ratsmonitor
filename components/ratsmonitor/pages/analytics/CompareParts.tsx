import { useState } from "react";
import { PlaceEntry } from "../../lib/place";
import { PLACE_COLORS } from "./CompareCharts";
import { useCountUp } from "../../lib/bandFigure";

/* Bausteine des Ortsvergleichs: Ergebnisformen, Voreinstellungen, Hinweise zur Datenlage und die Gegenüberstellung */
export interface Share { id: string; n: number; share: number }
export interface Place {
  ags: string; scope: string; population: number | null; total: number; sampled: number; capped: boolean; perThousand: number | null;
  topics: { n: number; list: Share[] }; status: { n: number; list: Share[] };
  committees: { name: string; n: number }[]; months: { m: string; n: number }[];
  typical: { term: string; n: number; share: number; base: number; ratio: number; z: number }[];
}
export interface Result {
  q: string; places: Place[]; months: string[];
  common: { term: string; shares: number[] }[];
  base: { total: number; sampled: number; topics: { n: number; list: Share[] }; status: { n: number; list: Share[] } };
}

/* Voreinstellung und Schnellwahl: Ortspaare mit gut gefülltem Datenbestand (ohne Thema) */
export const ORT = { koeln: { ags: "05315", name: "Köln" }, dortmund: { ags: "05913", name: "Dortmund" }, duesseldorf: { ags: "05111", name: "Düsseldorf" } };
export const asPlace = (o: { ags: string; name: string }): PlaceEntry => ({ ags: o.ags, name: o.name, kind: "stadt", n: o.name.toLowerCase() });
export const n = (v: number) => v.toLocaleString("de-DE");
/* Wörter des Sitzungsbetriebs (Anfragen, Geschäftsordnung, Rollen), die eher die Schreibweise eines Ratsinformationssystems als die Themen eines Ortes zeigen */
const SITZUNGSWORT = /^(eingang|eingäng|anregung|beantwort|mündlich|absatz|gemeindeordnung|landes$|land$|geschäftsordnung|regularien|mitunterzeichn|mitwirkungsverbot|nachtrag|hinweis|angelegenheit|benennung|unbesetzt|anhörung|verpflichtung|mitglied|entscheidung|empfehlung|gruppe|ratsmitglied|berichterstatter|entgegennahme|einführung|stadtbezirk|bezirksvertretung|fraktion|unbeantwortet|ausschussmitglied|sitzung|niederschrift|tagesordnung|aktenzeichen|bürgereingabe|schriftlich|überweisung|sachstand|umsetzung|bereich$|straße|strasse|bitte$|volt$|anfrage|vorlage|bericht|beschluss|antrag)/;
export const inhaltlich = (term: string, orte: string[] = []) => !SITZUNGSWORT.test(term) && !orte.some((o) => o.length >= 4 && term.toLowerCase().startsWith(o.slice(0, Math.max(4, o.length - 1)))) && !/(fraktion|gruppe)/.test(term) && !/^(partei|wähler|früher|freie$)/.test(term);

/** Was beim Vergleich der Datenlage zu beachten ist: wenig Themenzuordnung, kaum erfasster Beschlussstatus */
export function datenlage(p: Place): string[] {
  const out: string[] = [];
  const sampled = p.sampled || p.total;
  if (p.total === 0) out.push("keine Vorgänge");
  else if (p.total < 30) out.push(`nur ${p.total} ${p.total === 1 ? "Vorgang" : "Vorgänge"}, zu wenige für einen Vergleich`);
  if (sampled >= 30) {
    if (p.topics.n === 0) out.push("keinem Thema zugeordnet");
    else if (p.topics.n / sampled < 0.25) out.push(`nur ${Math.round((p.topics.n / sampled) * 100)} % einem Thema zugeordnet`);
    const share = (id: string) => p.status.list.find((x) => x.id === id)?.share ?? 0;
    if (share("approved") + share("rejected") < 1 && share("recommended") + share("consulting") + share("postponed") > 0) out.push("kaum Beschlüsse mit Ausgang erfasst");
  }
  return out;
}

/** Erklärtext: am Handy eine Zeile, Antippen zeigt ihn ganz */
export function Hinweis({ className = "", children }: { className?: string; children: React.ReactNode }) {
  const [auf, setAuf] = useState(false);
  return <p onClick={() => setAuf(!auf)} className={`${className} text-[14px] text-slate-500 ${auf ? "" : "max-sm:line-clamp-1"}`}>{children}</p>;
}

/** Zahl, die kurz hochzählt */
function DuellZahl({ v }: { v: string }) { return <>{useCountUp(v)}</>; }

/** Gegenüberstellung: beide Orte groß einander gegenüber (je 1.000 Einwohner), dazwischen das Verhältnis; die Balken fahren ein */
export function Duell({ a, b, na, nb }: { a: Place; b: Place; na: string; nb: string }) {
  const x = a.perThousand ?? 0, y = b.perThousand ?? 0, max = Math.max(x, y, 0.0001);
  const hi = x >= y, r = Math.round((Math.max(x, y) / Math.max(0.0001, Math.min(x, y))) * 10) / 10;
  const side = (name: string, v: number, i: number, p: Place) => (
    <div className={`min-w-0 ${i === 1 ? "text-right sm:text-left" : ""}`}>
      <p className="m-0 flex items-center gap-2 text-[16px] font-semibold max-sm:text-[14px]" style={{ justifyContent: i === 1 ? undefined : undefined }}><i className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: PLACE_COLORS[i] }} /><span className="truncate">{name}</span></p>
      <p className="m-0 mt-1 text-[44px] font-semibold leading-none tabular-nums max-sm:text-[32px]" style={{ color: PLACE_COLORS[i] }}><DuellZahl v={v.toLocaleString("de-DE", { maximumFractionDigits: 1 })} /></p>
      <p className="m-0 mt-1 text-[14px] text-slate-500"><span className="max-sm:hidden">Vorgänge </span><span className="sm:hidden">pro</span><span className="max-sm:hidden">je</span> 1.000 Einwohner<span className="max-sm:hidden">{p.population ? ` · ${p.population.toLocaleString("de-DE")} Einwohner` : ""}</span></p>
      <span className="mt-2 block h-[8px] overflow-hidden rounded-full bg-slate-100"><span className="rm-bar block h-full origin-left rounded-full" style={{ width: `${(v / max) * 100}%`, background: PLACE_COLORS[i], animationDelay: `${i * 120}ms` }} /></span>
    </div>
  );
  return (
    <div className="mt-5 grid grid-cols-2 items-center gap-x-6 gap-y-2 sm:grid-cols-[1fr_auto_1fr] sm:gap-x-10 print:hidden">
      {side(na, x, 0, a)}
      <div className="col-span-2 order-last text-center max-sm:hidden sm:order-none sm:col-span-1">
        <span className="inline-flex flex-col items-center rounded-full border border-slate-200 px-4 py-1.5 text-[14px] text-slate-600"><b className="text-[18px] font-semibold tabular-nums text-slate-900">{r <= 1.1 ? "≈ gleich" : `${r.toLocaleString("de-DE")}×`}</b>{r <= 1.1 ? "" : `${hi ? na : nb} mehr`}</span>
      </div>
      {side(nb, y, 1, b)}
    </div>
  );
}
