import type { ReactNode } from "react";

const n = (v: number) => v.toLocaleString("de-DE");

/** Datum der letzten 7 Tage (bis heute): für „neu“ in Listen und „+N in den letzten 7 Tagen“ */
export const weekAgo = () => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); };
export const isNew = (iso: string) => { const d = String(iso || "").slice(0, 10), today = new Date().toISOString().slice(0, 10); return d >= weekAgo() && d <= today; };
/** Kleines „neu“ in Petrol (Sitzung der letzten 7 Tage) */
export const NeuMark = ({ date }: { date: string }) => (isNew(date) ? <span className="mr-1.5 font-semibold text-teal-700">neu</span> : null);

/**
 * Antwort als große Kennzahlen (Atlas, Signale): Zahl groß in Petrol, Bedeutung klein darunter; daneben, wie viele Vorgänge
 * in den letzten 7 Tagen beraten wurden. Darunter in einer Zeile, worauf sich die Zahlen beziehen.
 */
export function Kennzahlen({ items, week, children }: { items: { value: string; label: string }[]; week?: number | null; children?: ReactNode }) {
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-end gap-x-10 gap-y-3">
        {items.map((k) => (
          <div key={k.label}>
            <p className="m-0 text-[44px] font-semibold leading-none tabular-nums text-teal-700">{k.value}</p>
            <p className="m-0 mt-1 text-[14px] text-slate-500">{k.label}</p>
          </div>
        ))}
        {week ? <p className="m-0 mb-6 rounded-full bg-teal-50 px-3 py-1 text-[14px] font-medium text-teal-800">+{n(week)} in den letzten 7 Tagen</p> : null}
      </div>
      {children && <p className="m-0 mt-3 text-[16px] text-slate-700">{children}</p>}
    </div>
  );
}
