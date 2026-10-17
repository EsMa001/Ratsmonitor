/** Datum wie in den Trefferlisten der Suche (ArticleCard): Tag groß, Monat in Petrol, Jahr klein, Linie rechts */
const MON = ["JAN", "FEB", "MÄR", "APR", "MAI", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEZ"];

export function DateBadge({ iso }: { iso?: string | null }) {
  const ok = !!iso && /^\d{4}-\d{2}-\d{2}/.test(iso);
  return (
    <span aria-hidden="true" className="flex w-[44px] flex-col items-center self-start border-r border-slate-200 pr-2.5 pt-0.5 text-center sm:w-[52px] sm:pr-3">
      <span className="text-[22px] font-semibold leading-none tracking-[-.02em]">{ok ? Number(iso.slice(8, 10)) : "—"}</span>
      {ok && <span className="mt-1 text-[12px] font-semibold uppercase tracking-[.06em] text-teal-700">{MON[Number(iso.slice(5, 7)) - 1]}</span>}
      {ok && <span className="text-[12px] text-slate-500">{iso.slice(2, 4)}</span>}
    </span>
  );
}
