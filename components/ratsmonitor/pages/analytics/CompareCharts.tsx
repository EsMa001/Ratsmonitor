/** Farben der Orte (bis vier): Akzentfarbe, Schwarz, Grau, helle Akzentfarbe */
export const PLACE_COLORS = ["#0d9488", "#0f172a", "#94a3b8", "#5eead4"];

export interface CMonth { m: string; n: number }
const mfmt = (m: string) => `${m.slice(5, 7)}/${m.slice(2, 4)}`;

/** Verlauf je Monat: eine Linie je Ort. Werte auf die Monate der gesamten Auswahl ausgerichtet; Monate ohne Einträge zählen 0 */
export function CompareLines({ months, series }: { months: string[]; series: { color: string; name: string; values: number[] }[] }) {
  if (months.length < 2) return <p className="text-[14px] text-slate-500">Zu wenige Monate für einen Verlauf.</p>;
  const W = 1000, H = 220, max = Math.max(1e-9, ...series.flatMap((s) => s.values));
  const x = (i: number) => (i / (months.length - 1)) * W;
  const y = (v: number) => H - 6 - (v / max) * (H - 16);
  const fmtV = (v: number) => (v >= 10 ? Math.round(v).toLocaleString("de-DE") : v.toLocaleString("de-DE", { maximumFractionDigits: 1 }));
  return (
    <figure className="m-0">
      <div className="relative ml-12" style={{ height: H }}>
        {[0, 0.5, 1].map((g) => (
          <div key={g} className="absolute inset-x-0 border-t border-slate-200" style={{ top: `${(y(max * g) / H) * 100}%` }}>
            <span className="absolute -left-12 w-10 -translate-y-1/2 whitespace-nowrap text-right text-[12px] text-slate-500">{fmtV(max * g)}</span>
          </div>
        ))}
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" role="img" aria-label="Einträge je Monat und Ort">
          {series.map((s) => (
            <polyline key={s.name} points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke={s.color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
      </div>
      <figcaption className="ml-12 mt-1 flex justify-between text-[12px] text-slate-500"><span>{mfmt(months[0])}</span><span>{mfmt(months[months.length - 1])}</span></figcaption>
    </figure>
  );
}

/** Ein Themenfeld: je Ort ein dünner Balken (Anteil unter den eingeordneten Einträgen), dazu eine Marke für alle Gebiete */
export function TopicRow({ name, shares, base, max, onPick }: { name: string; shares: number[]; base: number; max: number; onPick?: () => void }) {
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)] gap-2 border-b border-slate-200 py-3 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-center sm:gap-6">
      {onPick ? (
        <button type="button" onClick={onPick} title={`Nur „${name}“ vergleichen`} className="group flex min-w-0 items-center gap-1.5 text-left text-[16px] text-slate-900 hover:text-teal-600">
          <span className="truncate group-hover:underline">{name}</span>
          <span aria-hidden="true" className="shrink-0 text-teal-600 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100">→</span>
        </button>
      ) : (
        <span className="truncate text-[16px] text-slate-900">{name}</span>
      )}
      <span className="relative block">
        {shares.map((v, i) => (
          <span key={i} className="mb-1 flex items-center gap-2 last:mb-0">
            <span className="relative block h-[6px] flex-1 rounded-full bg-slate-100"><span className="absolute left-0 top-0 block h-full rounded-full" style={{ width: pct(v), background: PLACE_COLORS[i] }} /></span>
            <span className="w-[52px] text-right text-[12px] tabular-nums text-slate-500">{v.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %</span>
          </span>
        ))}
        <span className="pointer-events-none absolute -bottom-0.5 -top-0.5 w-px bg-slate-900/70" style={{ left: `calc((100% - 60px) * ${Math.min(1, base / max)})` }} title={`Alle Gebiete: ${base.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`} />
      </span>
    </li>
  );
}
