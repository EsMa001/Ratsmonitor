import Link from "next/link";

/** Logo und Name; führt zur Übersicht */
export function Brand({ onClick, asLink = true }: { onClick?: () => void; asLink?: boolean }) {
  const inner = (
    <>
      <span className="relative grid h-9 w-9 flex-none place-items-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-700 text-white shadow-[0_4px_12px_rgba(13,148,136,.35)]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2.5a7 7 0 0 0-7 7c0 5.2 7 12 7 12s7-6.8 7-12a7 7 0 0 0-7-7z" fill="currentColor" opacity=".25" />
          <path d="M8.5 12.5v-3M12 12.5v-5M15.5 12.5v-2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </span>
      <span className="text-[19px] font-extrabold leading-none tracking-[-.03em]">
        Rats<span className="text-teal-600">monitor</span>
      </span>
    </>
  );
  if (!asLink) return <div className="flex items-center gap-2.5 text-slate-900">{inner}</div>;
  return (
    <Link
      href="/"
      aria-label="Ratsmonitor, zur Übersicht"
      onClick={(e) => {
        if (onClick) {
          e.preventDefault();
          onClick();
        }
      }}
      className="flex items-center gap-2.5 text-slate-900 no-underline [grid-area:brand]"
    >
      {inner}
    </Link>
  );
}
