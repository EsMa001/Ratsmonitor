import Link from "next/link";
import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { tick } from "../lib/haptic";

/** Schalter mit mehreren Stellungen (wie am iPhone): grauer Rahmen, die gewählte Stelle liegt auf einem weißen Streifen, der gleitet */
export function Segmented({ label, names, active, onPick }: { label: string; names: string[]; active: string; onPick: (n: string) => void }) {
  /* pos: Stellung als Kommazahl, solange der Finger zieht (der Streifen folgt dem Finger ohne Stufen) */
  const [pos, setPos] = useState<number | null>(null);
  const over = pos === null ? null : names[Math.round(pos)];
  const i = pos ?? Math.max(0, names.indexOf(active));
  /* Mit dem Finger über den Schalter ziehen wählt die Stellung unter dem Finger */
  const drag = useRef<{ x: number; on: boolean } | null>(null);
  const moved = useRef(false);
  const at = (e: PointerEvent<HTMLDivElement>) => { const r = e.currentTarget.getBoundingClientRect(), w = (r.width - 8) / names.length; return Math.min(names.length - 1, Math.max(0, (e.clientX - r.left - 4) / w - 0.5)); };
  return (
    <div role="tablist" aria-label={label} className="relative mt-2 grid touch-pan-y rounded-xl bg-slate-100 p-1"
      onPointerDown={(e) => { if (e.pointerType === "touch") { drag.current = { x: e.clientX, on: false }; moved.current = false; } }}
      onPointerMove={(e) => {
        const d = drag.current; if (!d) return;
        if (!d.on && Math.abs(e.clientX - d.x) > 8) { d.on = true; moved.current = true; e.currentTarget.setPointerCapture(e.pointerId); }
        if (d.on) setPos(at(e));
      }}
      onPointerUp={() => { const n = over; drag.current = null; setPos(null); if (n !== null && n !== active) { tick(); onPick(n); } }} onPointerCancel={() => { drag.current = null; setPos(null); }}
      onClickCapture={(e) => { if (moved.current) { e.stopPropagation(); e.preventDefault(); moved.current = false; } }} style={{ gridTemplateColumns: `repeat(${names.length}, minmax(0, 1fr))` }}>
      <span aria-hidden="true" className={`absolute inset-y-1 left-1 rounded-[10px] bg-white shadow-sm motion-reduce:transition-none ${pos === null ? "transition-transform duration-[260ms] ease-[cubic-bezier(.3,.7,.3,1)]" : ""}`} style={{ width: `calc((100% - 8px) / ${names.length})`, transform: `translateX(${i * 100}%)` }} />
      {names.map((n) => (
        <button key={n} type="button" role="tab" aria-selected={n === active} onClick={() => onPick(n)}
          className={`relative z-10 h-9 rounded-[10px] text-[14px] font-medium transition-colors ${n === (over ?? active) ? "text-slate-900" : "text-slate-500"}`}>{n}</button>
      ))}
    </div>
  );
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
