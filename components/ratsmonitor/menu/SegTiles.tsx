import Link from "next/link";
import { useRef, type PointerEvent, type ReactNode } from "react";
import { Lock } from "lucide-react";

/** Schalter mit mehreren Stellungen (wie am iPhone): grauer Rahmen, die gewählte Stelle liegt auf einem weißen Streifen, der gleitet */
export function Segmented({ label, names, active, onPick }: { label: string; names: string[]; active: string; onPick: (n: string) => void }) {
  const i = Math.max(0, names.indexOf(active));
  /* Mit dem Finger über den Schalter ziehen wählt die Stellung unter dem Finger */
  const drag = useRef<{ x: number; on: boolean } | null>(null);
  const moved = useRef(false);
  const at = (e: PointerEvent<HTMLDivElement>) => { const r = e.currentTarget.getBoundingClientRect(); return names[Math.min(names.length - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * names.length)))]; };
  return (
    <div role="tablist" aria-label={label} className="relative mt-2 grid touch-pan-y rounded-xl bg-slate-100 p-1"
      onPointerDown={(e) => { if (e.pointerType === "touch") { drag.current = { x: e.clientX, on: false }; moved.current = false; } }}
      onPointerMove={(e) => {
        const d = drag.current; if (!d) return;
        if (!d.on && Math.abs(e.clientX - d.x) > 8) { d.on = true; moved.current = true; e.currentTarget.setPointerCapture(e.pointerId); }
        if (d.on) { const n = at(e); if (n !== active) onPick(n); }
      }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
      onClickCapture={(e) => { if (moved.current) { e.stopPropagation(); e.preventDefault(); moved.current = false; } }} style={{ gridTemplateColumns: `repeat(${names.length}, minmax(0, 1fr))` }}>
      <span aria-hidden="true" className="absolute inset-y-1 left-1 rounded-[10px] bg-white shadow-sm transition-transform duration-200 motion-reduce:transition-none" style={{ width: `calc((100% - 8px) / ${names.length})`, transform: `translateX(${i * 100}%)` }} />
      {names.map((n) => (
        <button key={n} type="button" role="tab" aria-selected={n === active} onClick={() => onPick(n)}
          className={`relative z-10 h-9 rounded-[10px] text-[14px] font-medium transition-colors ${n === active ? "text-slate-900" : "text-slate-500"}`}>{n}</button>
      ))}
    </div>
  );
}

/** Kachel im Blatt: Symbol oben links, Name und kurze Frage unten; die aktuelle Seite petrolfarben, optional mit Schloss */
export function Tile({ href, icon, label, hint, on = false, locked = false, onClick }: { href: string; icon: ReactNode; label: string; hint?: string; on?: boolean; locked?: boolean; onClick?: () => void }) {
  return (
    <Link href={href} onClick={onClick} aria-current={on ? "page" : undefined}
      className={`relative flex h-[84px] flex-col justify-between rounded-2xl border p-3 no-underline ${on ? "border-teal-600 bg-teal-50 text-teal-800" : "border-slate-200 bg-white text-slate-900"}`}>
      {icon}
      <span className="block min-w-0">
        <span className={`block font-semibold leading-tight [overflow-wrap:anywhere] ${label.length > 14 ? "text-[14px]" : "text-[16px]"} ${hint ? "truncate" : "line-clamp-2"}`}>{label}</span>
        {hint && <span className="block truncate text-[12px] text-slate-500">{hint}</span>}
      </span>
      {locked && <Lock size={14} className="absolute right-3 top-3 text-slate-400" aria-label="gesperrt" />}
    </Link>
  );
}
