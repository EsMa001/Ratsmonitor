import type { ReactNode } from "react";

/**
 * Eine Zeile einer Rangliste auf den plenara.X-Seiten (Stärkste Verbindungen, Häufigste Knoten, Wichtigste Übergänge):
 * Rang, Name (mit kleinem Zusatz oder zweiter Zeile), Wert, Pfeil; darunter optional ein dünner Balken. Eine Stelle für Abstände,
 * Schriftgrößen und Fokus, statt je Seite eigenes Markup. onClick: die Zeile ist ein Knopf (Auswahl, Aufklappen).
 */
export function ListRow({ nr, title, tag, sub, value, valueSub, bar, onClick, expanded, arrow = true, wrap = false, children }: {
  nr?: number; title: ReactNode; /** Name darf umbrechen statt mit „…“ abgeschnitten zu werden */ wrap?: boolean; /** kleiner grauer Zusatz hinter dem Namen (Art) */ tag?: string; /** zweite Zeile unter dem Namen */ sub?: ReactNode;
  value?: ReactNode; /** graue Zeile unter dem Wert */ valueSub?: ReactNode; /** Balken in Prozent (0 bis 100) */ bar?: number; onClick?: () => void; expanded?: boolean; /** Pfeil rechts (bei Zeilen, die aufklappen, nicht nötig) */ arrow?: boolean; /** unter der Zeile (aufgeklappte Liste) */ children?: ReactNode;
}) {
  const inner = (
    <>
      {nr !== undefined && <span className="text-[14px] tabular-nums text-slate-500">{nr}</span>}
      <span className="min-w-0">
        <span className={`block text-[16px] text-slate-900 ${wrap ? "" : "truncate"}`}>{title}{tag && <span className="ml-2 text-[12px] text-slate-500">{tag}</span>}</span>
        {sub && <span className="block truncate text-[16px] text-slate-500">{sub}</span>}
        {bar !== undefined && <span aria-hidden="true" className="mt-1.5 block h-[3px] rounded-full bg-slate-100"><span className="block h-full rounded-full bg-teal-600" style={{ width: `${Math.max(3, Math.min(100, bar))}%` }} /></span>}
      </span>
      {value !== undefined && <span className="text-right text-[14px] tabular-nums text-slate-500">{value}{valueSub && <span className="block text-slate-500">{valueSub}</span>}</span>}
      {onClick && arrow && <span className="text-[16px] text-teal-700 transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>}
    </>
  );
  const grid = `grid w-full items-center gap-x-3 py-3 text-left ${nr !== undefined ? (arrow ? "grid-cols-[28px_minmax(0,1fr)_auto_auto]" : "grid-cols-[28px_minmax(0,1fr)_auto]") : (arrow ? "grid-cols-[minmax(0,1fr)_auto_auto]" : "grid-cols-[minmax(0,1fr)_auto]")}`;
  return (
    <li className="border-b border-slate-200">
      {onClick
        ? <button type="button" onClick={onClick} aria-expanded={expanded} className={`group ${grid} cursor-pointer hover:bg-slate-50`}>{inner}</button>
        : <div className={grid}>{inner}</div>}
      {children}
    </li>
  );
}
