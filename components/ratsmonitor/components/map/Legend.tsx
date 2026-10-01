const STEPS = [
  { label: "0", cls: "bg-map-zero" },
  { label: "1–25", cls: "bg-map-s1" },
  { label: "26–100", cls: "bg-map-s2" },
  { label: "101–500", cls: "bg-map-s3" },
  { label: "über 500", cls: "bg-map-s4" },
];

/** Farblegende der passenden Einträge als Overlay auf der Karte */
export function Legend() {
  const swatch = "inline-block h-3 w-3 rounded-[3px] border border-slate-900/[.18] sm:h-3.5 sm:w-3.5";
  return (
    <div
      aria-label="Legende"
      className="pointer-events-auto absolute bottom-2.5 left-3 right-3 rounded-[10px] border border-slate-200 bg-white/95 px-2 py-[5px] text-[11px] text-slate-600 shadow-xs sm:bottom-4 sm:left-6 sm:right-auto sm:px-3 sm:py-2 sm:text-xs"
    >
      <div className="mb-[5px] hidden font-semibold text-slate-900 sm:block">Passende Einträge</div>
      <div className="flex flex-wrap items-center gap-x-[9px] gap-y-1 sm:gap-x-3 sm:gap-y-1.5">
        <span className="inline-flex items-center gap-[5px] whitespace-nowrap">
          <i className={`${swatch} bg-white bg-[repeating-linear-gradient(135deg,#fff_0_3px,#c3c9d1_3px_4px)]`} />
          kein Bestand
        </span>
        {STEPS.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-[5px] whitespace-nowrap">
            <i className={`${swatch} ${s.cls}`} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
