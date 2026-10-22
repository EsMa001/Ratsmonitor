import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Kopf einer Liste auf plenara.X: Symbol in Petrol, darüber klein was die Liste ist, Titel, rechts die Zahl */
export function ListenKopf({ icon, eyebrow, title, count }: { icon?: ReactNode; eyebrow: string; title: ReactNode; count?: string }) {
  return (
    <div className="flex items-center gap-3">
      {icon && <span aria-hidden="true" className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-teal-50 text-teal-700">{icon}</span>}
      <div className="min-w-0">
        <p className="m-0 text-[12px] font-medium uppercase tracking-wide text-slate-500">{eyebrow}</p>
        <h2 className="m-0 truncate text-[20px] font-semibold leading-tight">{title}</h2>
      </div>
      {count && <span className="ml-auto flex-none text-[14px] tabular-nums text-slate-500">{count}</span>}
    </div>
  );
}

/** Reiter einer plenara.X-Seite: Symbol und Name, Petrol-Linie unter dem gewählten (Fraktionen, Ortsvergleich) */
export function Reiter<K extends string>({ items, value, onPick, label }: { items: [K, string, LucideIcon][]; value: K; onPick: (k: K) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-x-6 border-b border-slate-200">
      {items.map(([k, l, I]) => <button key={k} type="button" role="tab" aria-selected={value === k} onClick={() => onPick(k)}
        className={`-mb-px inline-flex items-center gap-2 border-b-2 pb-2.5 text-[14px] ${value === k ? "border-teal-700 font-semibold text-slate-900" : "border-transparent text-slate-500 hover:text-teal-700"}`}>
        <I size={16} strokeWidth={1.6} className={value === k ? "text-teal-700" : ""} aria-hidden="true" />{l}</button>)}
    </div>
  );
}
