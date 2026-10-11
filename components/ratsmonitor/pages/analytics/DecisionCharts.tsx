import type { ReactNode } from "react";
/** Farben der Entscheidungen: beschlossen Akzentfarbe, vertagt Grau, abgelehnt Schwarz */
export const DEC_COLORS = { approved: "#0d9488", postponed: "#94a3b8", rejected: "#0f172a" };
/** differs: Quote weicht deutlich vom Gesamtwert ab (false = im üblichen Rahmen, fehlt = keine Prüfung); recommended: Empfehlungen (Ausschüsse) */
export interface Cut { id: string; name: string; decided: number; approved: number; rejected: number; postponed: number; rate: number | null; differs?: boolean; recommended?: number }
export interface Month { m: string; approved: number; rejected: number; postponed: number; rate: number | null }
const nf = (v: number) => v.toLocaleString("de-DE");
const mlabel = (m: string) => `${m.slice(5, 7)}/${m.slice(2, 4)}`;

/** Monatssäulen der Entscheidungen (beschlossen, vertagt, abgelehnt) mit der Beschlussquote als Linie */
export function MonthColumns({ months }: { months: Month[] }) {
  if (!months.length) return null;
  const W = 1000, H = 240, max = Math.max(...months.map((m) => m.approved + m.rejected + m.postponed), 1);
  const slot = W / months.length, bw = Math.min(46, slot * 0.58);
  const y = (v: number) => H - 4 - (v / max) * (H - 18);
  const rates = months.map((m, i) => (m.rate === null ? null : [i * slot + slot / 2, 8 + (1 - m.rate / 100) * (H - 22)] as [number, number]));
  const pts = rates.filter(Boolean) as [number, number][];
  return (
    <figure className="m-0">
      <div className="relative ml-12 mr-12" style={{ height: H }}>
        {[0, 0.5, 1].map((g) => (
          <div key={g} className="absolute inset-x-0 border-t border-slate-200" style={{ top: `${(y(max * g) / H) * 100}%` }}>
            <span className="absolute -left-12 w-10 -translate-y-1/2 whitespace-nowrap text-right text-[12px] text-slate-500">{nf(Math.round(max * g))}</span>
            <span className="absolute -right-12 w-10 -translate-y-1/2 whitespace-nowrap text-[12px] text-slate-500">{g === 0 ? "0 %" : g === 0.5 ? "50 %" : "100 %"}</span>
          </div>
        ))}
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" role="img" aria-label="Entscheidungen je Monat und Beschlussquote">
          {months.map((m, i) => {
            const x0 = i * slot + (slot - bw) / 2;
            const hA = (m.approved / max) * (H - 18), hP = (m.postponed / max) * (H - 18), hR = (m.rejected / max) * (H - 18);
            return (
              <g key={m.m}>
                <rect x={x0} y={H - 4 - hA} width={bw} height={hA} fill={DEC_COLORS.approved} fillOpacity=".85" />
                <rect x={x0} y={H - 4 - hA - hP} width={bw} height={hP} fill={DEC_COLORS.postponed} />
                <rect x={x0} y={H - 4 - hA - hP - hR} width={bw} height={hR} fill={DEC_COLORS.rejected} />
              </g>
            );
          })}
          {pts.length > 1 && <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="#0f172a" strokeWidth="2" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />}
        </svg>
      </div>
      <figcaption className="ml-12 mr-12 mt-1 flex justify-between text-[12px] text-slate-500"><span>{mlabel(months[0].m)}</span><span>Säulen: Entscheidungen · gestrichelt: Beschlussquote</span><span>{mlabel(months[months.length - 1].m)}</span></figcaption>
    </figure>
  );
}

/** Eine Zeile je Gruppe: Anteil beschlossen, vertagt und abgelehnt als gestapelter Balken; onToggle öffnet die Liste der Vorgänge (drill, unter der Zeile) */
export function DecisionRow({ cut, onToggle, expanded, drill }: { cut: Cut; onToggle?: () => void; expanded?: boolean; drill?: ReactNode }) {
  const d = Math.max(1, cut.decided), pc = (v: number) => `${(v / d) * 100}%`;
  const cls = `grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 text-left sm:grid-cols-[220px_minmax(0,1fr)_150px] ${onToggle ? (expanded ? "bg-teal-50/60" : "hover:bg-slate-50") : ""}`;
  const body = (
    <>
      <span className="truncate text-[16px] text-slate-900">{cut.name}</span>
      <span className="order-3 col-span-2 flex h-[8px] overflow-hidden rounded-full bg-slate-100 sm:order-none sm:col-span-1" role="img" aria-label={`${cut.name}: ${cut.rate ?? 0} % beschlossen`}>
        <span style={{ width: pc(cut.approved), background: DEC_COLORS.approved }} title={`beschlossen: ${nf(cut.approved)}`} />
        <span style={{ width: pc(cut.postponed), background: DEC_COLORS.postponed }} title={`vertagt: ${nf(cut.postponed)}`} />
        <span style={{ width: pc(cut.rejected), background: DEC_COLORS.rejected }} title={`abgelehnt: ${nf(cut.rejected)}`} />
      </span>
      <span className="text-right text-[14px] tabular-nums">{cut.rate === null && cut.recommended ? <span className="text-slate-500">{nf(cut.recommended)} empfohlen</span> : <b className={`font-semibold ${cut.differs === false ? "text-slate-400" : "text-slate-900"}`} title={cut.differs === false ? "im üblichen Rahmen (keine deutliche Abweichung vom Gesamtwert)" : undefined}>{cut.rate === null ? "–" : `${cut.rate.toLocaleString("de-DE")} %`}</b>}<span className="ml-2 text-slate-500">{nf(cut.decided)}</span></span>
    </>
  );
  return (
    <li className="border-b border-slate-200">
      {onToggle ? <button type="button" onClick={onToggle} aria-expanded={expanded} className={cls}>{body}</button> : <div className={cls}>{body}</div>}
      {drill}
    </li>
  );
}
