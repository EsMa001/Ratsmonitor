import { useEffect, useState } from "react";
import { hasScope } from "../lib/savedSearch";
import { plural } from "../lib/text";
import { useData } from "../state/data";
import { useSearch, useSearchResults } from "../state/search";
import { IconPin } from "./icons";

/* Regler quadratisch skaliert: feine Schritte im Nahbereich, bis 500 km am Ende */
const kmFromPos = (p: number) => Math.round(500 * Math.pow(p / 1000, 2));
const posFromKm = (km: number) => Math.round(Math.sqrt(km / 500) * 1000);

/** Gewähltes Gebiet in einer Zeile: Umfang (nur/inklusive) und Umkreis; 0 km = nur das Gebiet selbst */
export function AreaBar() {
  const { geo } = useData();
  const search = useSearch();
  const { state } = search;
  const km = state.radius?.km ?? 0;
  const { total, kommunenInRadius, loading } = useSearchResults();
  /* Reglerposition lokal halten: kleine Schritte ändern den gerundeten km-Wert nicht sofort */
  const [pos, setPos] = useState(() => posFromKm(km));
  useEffect(() => {
    setPos((p) => (kmFromPos(p) === km ? p : posFromKm(km)));
  }, [km]);
  /* Nach dem Loslassen den ganzen Kreis auf der Karte zeigen */
  const fit = () => {
    const r = search.state.radius;
    if (r) search.mapRef.current?.fitCircle(r, true);
  };
  if (!geo) return null;
  const name = geo.info(state.area).name;
  /* Umfang wirkt nicht im Umkreis (dort zählen alle Gebiete im Kreis); er bleibt aber stehen, damit der Regler nicht springt */
  const scoped = hasScope(state.area, geo);
  const scopes = [
    ["only", state.area.length === 5 ? "nur Kreisebene" : "nur Gemeinde"],
    ["with", state.area.length === 5 ? "inkl. Gemeinden" : `inkl. ${geo.info(state.area.slice(0, 5)).name}`],
  ] as const;

  return (
    <div role="group" aria-label={`Gebiet ${name}`} className="flex flex-col gap-1 text-[14px]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-slate-900">
          <IconPin size={16} className="flex-none text-teal-600" />
          {name}
        </span>
        {scoped && (
          <div role="group" aria-label="Gebietsumfang" title={km ? "Im Umkreis werden alle Gebiete im Kreis durchsucht" : undefined} className={`flex items-center gap-4 ${km ? "opacity-40" : ""}`}>
            {scopes.map(([v, label]) => (
              <button key={v} type="button" disabled={!!km} aria-pressed={state.scope === v} onClick={() => search.setScope(v)} className={`whitespace-nowrap py-1 text-[14px] disabled:cursor-not-allowed ${state.scope === v ? "border-b-2 border-teal-600 text-teal-600" : "border-b-2 border-transparent text-slate-500 hover:text-slate-900"}`}>
                {label}
              </button>
            ))}
          </div>
        )}
        <div className="flex min-w-[220px] flex-1 items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 text-slate-500">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d1665a" strokeWidth="1.5" strokeLinecap="round" className="flex-none">
              <circle cx="12" cy="12" r="9" strokeDasharray="3 2.6" />
              <path d="M12 12h9" />
              <circle cx="12" cy="12" r="1.8" fill="#d1665a" stroke="none" />
            </svg>
            Umkreis
          </span>
          <input
            type="range"
            min={0}
            max={1000}
            step={1}
            value={pos}
            aria-label={`Umkreis um ${name} in Kilometern Luftlinie`}
            aria-valuetext={km ? `${km} Kilometer` : "kein Umkreis"}
            onChange={(e) => {
              const p = +e.target.value;
              setPos(p);
              search.setRadiusKm(kmFromPos(p));
            }}
            onPointerUp={fit}
            onKeyUp={fit}
            className="h-7 min-w-0 flex-1 cursor-pointer accent-[#d1665a]"
          />
          <output className={`min-w-[52px] text-right text-[14px] font-bold tabular-nums ${km ? "text-[#b4493e]" : "text-slate-400"}`}>{km ? `${km} km` : "aus"}</output>
        </div>
      </div>
      {km > 0 && (
        <div aria-live="polite" className="text-[12px] text-slate-500">
          {kommunenInRadius} {plural(kommunenInRadius, "Kommune", "Kommunen")} ganz oder teilweise im Umkreis{loading ? "" : `, ${total} ${plural(total, "Eintrag", "Einträge")}`}
        </div>
      )}
    </div>
  );
}
