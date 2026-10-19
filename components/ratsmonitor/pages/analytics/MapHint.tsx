import { useEffect, useState } from "react";

/**
 * Kurzer Hinweis als Milchglas mitten auf der Karte, jedes Mal wenn die Seite aufgeht (z. B. zu den Werten). Er bleibt stehen, bis
 * man ihn mit „OK“ bestätigt.
 */
export function MapHint({ children }: { id?: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const a = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(a);
  }, []);
  if (!show) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center px-3 print:hidden">
      <div role="status" className="rm-legend pointer-events-auto flex w-[min(92%,420px)] animate-[fadeIn_.4s_ease-out] items-center gap-3 rounded-3xl py-3 pl-5 pr-3 text-[14px] leading-snug text-slate-800">
        <p className="m-0 min-w-0 flex-1">{children}</p>
        <button type="button" onClick={() => setShow(false)} className="inline-flex h-9 min-w-[64px] flex-none items-center justify-center rounded-full border border-teal-700/25 bg-white/50 px-5 text-[14px] font-medium text-teal-800 transition-colors hover:bg-white/90">OK</button>
      </div>
    </div>
  );
}
