import Link from "next/link";
import { Segmented as Segmented_ } from "../components/Segmented";
import type { ReactNode } from "react";
import { Lock } from "lucide-react";

/** Schalter in den Blättern: derselbe Schalter wie auf den Seiten (components/Segmented.tsx), über die ganze Breite */
export function Segmented({ label, names, active, onPick }: { label: string; names: string[]; active: string; onPick: (n: string) => void }) {
  return <Segmented_ fill className="mt-2" label={label} options={names.map((n) => [n, n] as [string, string])} value={active} onPick={onPick} />;
}

/** Kachel im Blatt: Symbol oben links, Name und kurze Frage unten; die aktuelle Seite petrolfarben, optional mit Schloss */
export function Tile({ href, icon, label, hint, on = false, locked = false, onClick }: { href: string; icon: ReactNode; label: string; hint?: string; on?: boolean; locked?: boolean; onClick?: () => void }) {
  return (
    <Link href={href} onClick={onClick} aria-current={on ? "page" : undefined}
      className={`relative flex min-h-[52px] items-center gap-2 rounded-2xl border px-2.5 py-2 no-underline ${on ? "border-teal-600 bg-teal-50 text-teal-800" : "border-slate-200 bg-white text-slate-900"}`}>
      <span className="shrink-0 [&>svg]:h-[18px] [&>svg]:w-[18px]">{icon}</span>
      <span className="block min-w-0 flex-1">
        <span className={`block truncate font-semibold leading-tight tracking-tight ${label.length > 12 ? "text-[14px]" : "text-[16px]"} ${label.length > 16 ? "max-[380px]:text-[12px]" : ""}`}>{label}</span>
        {hint && <span className="block truncate text-[12px] text-slate-500">{hint}</span>}
      </span>
      {locked && <Lock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label="gesperrt" />}
    </Link>
  );
}

/** Kachel als Knopf (Auswahl im Blatt): gleiche Bauart wie Tile, die gewählte petrolfarben, rechts die Zahl */
export function PickTile({ icon, label, count, on, onClick }: { icon: ReactNode; label: string; count?: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={`flex min-h-[52px] w-full items-center gap-2 rounded-2xl border px-2.5 py-2 text-left ${on ? "border-teal-600 bg-teal-50 text-teal-800" : "border-slate-200 bg-white text-slate-900"}`}>
      <span className="shrink-0 [&>svg]:h-[18px] [&>svg]:w-[18px]">{icon}</span>
      <span className="block min-w-0 flex-1">
        <span lang="de" className="line-clamp-2 block text-[14px] font-semibold leading-tight tracking-tight hyphens-auto">{label}</span>
        {count && <span className="block text-[12px] text-slate-500">{count}</span>}
      </span>
    </button>
  );
}
