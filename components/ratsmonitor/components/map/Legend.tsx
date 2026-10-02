/** Legende der Treffer; mit Suche oder Filter in drei linearen Stufen bis zum Höchstwert */
export function Legend({ graded, max, t1, t2 }: { graded: boolean; max: number; t1: number; t2: number }) {
  const swatch = "inline-block h-3 w-3 rounded-[3px] border border-slate-900/[.18] sm:h-3.5 sm:w-3.5";
  const steps = [
    { label: "Keine Treffer", cls: "bg-white bg-[repeating-linear-gradient(135deg,#fff_0_3px,#c3c9d1_3px_4px)]" },
    ...(graded && max > 0
      ? [
          { label: `Wenige (bis ${t1})`, cls: "bg-map-s1" },
          { label: `Mittel (bis ${t2})`, cls: "bg-map-s2" },
          { label: `Viele (bis ${max})`, cls: "bg-map-s3" },
        ]
      : [{ label: "Treffer", cls: "bg-map-s3" }]),
  ];
  return (
    <div
      aria-label="Legende"
      className="pointer-events-auto absolute bottom-2.5 left-3 right-3 rounded-[10px] border border-slate-200 bg-white/95 px-2 py-[5px] text-[11px] text-slate-600 shadow-xs sm:bottom-4 sm:left-6 sm:right-auto sm:px-3 sm:py-2 sm:text-xs"
    >
      <div className="mb-[5px] hidden font-semibold text-slate-900 sm:block">Treffer</div>
      <div className="flex flex-wrap items-center gap-x-[9px] gap-y-1 sm:gap-x-3 sm:gap-y-1.5">
        {steps.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-[5px] whitespace-nowrap">
            <i className={`${swatch} ${s.cls}`} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
