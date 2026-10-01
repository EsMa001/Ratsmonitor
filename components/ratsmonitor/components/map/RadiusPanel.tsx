import { useEffect, useState } from "react";
import { plural } from "../../lib/text";
import { useData } from "../../state/data";
import { useSearch, useSearchResults } from "../../state/search";
import { IconX } from "../icons";

/* Regler quadratisch skaliert: feine Schritte im Nahbereich, bis 500 km am Ende */
const kmFromPos = (p: number) => Math.round(500 * Math.pow(p / 1000, 2));
const posFromKm = (km: number) => Math.round(Math.sqrt(km / 500) * 1000);

export function RadiusPanel() {
  const { geo } = useData();
  const search = useSearch();
  const r = search.state.radius!;
  const { total, kommunenInRadius } = useSearchResults();
  const n = total;
  /* Reglerposition lokal halten: kleine Schritte ändern den gerundeten km-Wert nicht sofort */
  const [pos, setPos] = useState(() => posFromKm(r.km));
  useEffect(() => {
    setPos((p) => (kmFromPos(p) === r.km ? p : posFromKm(r.km)));
  }, [r.km]);

  return (
    <div
      role="group"
      aria-label="Umkreis"
      className="pointer-events-auto absolute bottom-[58px] left-3 right-3 rounded-xl border border-slate-200 bg-white/[.97] px-3.5 pb-2.5 pt-3 shadow-pop sm:bottom-[34px] sm:left-auto sm:right-6 sm:w-[330px]"
    >
      <div className="flex items-center justify-between gap-2 text-[13px] text-slate-600">
        <span className="inline-flex items-center gap-2">
          <i aria-hidden="true" className="h-3.5 w-3.5 flex-none rounded-full border-2 border-dashed border-amber-500 bg-amber-500/10" />
          <span>
            Umkreis um <b className="text-slate-900">{geo?.info(r.ags).name}</b>
          </span>
        </span>
        <button
          type="button"
          aria-label="Umkreis aufheben"
          onClick={search.clearRadius}
          className="grid h-7 w-7 flex-none place-items-center rounded-[7px] text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <IconX />
        </button>
      </div>
      <div className="mt-1.5 flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={1000}
          step={1}
          value={pos}
          aria-label="Radius in Kilometern Luftlinie"
          aria-valuetext={`${r.km} Kilometer`}
          onChange={(e) => {
            const p = +e.target.value;
            setPos(p);
            search.setRadiusKm(kmFromPos(p));
          }}
          onPointerUp={() => search.mapRef.current?.fitCircle(search.state.radius ?? r, true)}
          onKeyUp={() => search.mapRef.current?.fitCircle(search.state.radius ?? r, true)}
          className="h-7 min-w-0 flex-1 cursor-pointer accent-amber-500"
        />
        <output className="min-w-[70px] text-right text-lg font-bold tabular-nums text-amber-700">{r.km} km</output>
      </div>
      <div aria-hidden="true" className="relative ml-2 mr-[82px] h-3.5 text-[10.5px] text-slate-500">
        <span className="absolute left-0 top-0">0</span>
        <span className="absolute left-[31.6%] top-0 -translate-x-1/2">50</span>
        <span className="absolute left-[63.2%] top-0 -translate-x-1/2">200</span>
        <span className="absolute right-0 top-0 whitespace-nowrap">500 km</span>
      </div>
      <div className="mt-1.5 text-[12.5px] text-slate-500">
        {kommunenInRadius} {plural(kommunenInRadius, "Kommune", "Kommunen")} ganz oder teilweise im Umkreis, {n} {plural(n, "Eintrag", "Einträge")}
      </div>
    </div>
  );
}
