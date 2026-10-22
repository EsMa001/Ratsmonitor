import type { ReactNode } from "react";

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
