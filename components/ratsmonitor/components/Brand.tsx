import Link from "next/link";
import { IconBrand } from "./icons";

/** Logo und Name; führt zur Übersicht */
export function Brand({ onClick, asLink = true }: { onClick?: () => void; asLink?: boolean }) {
  const inner = (
    <>
      <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[9px] bg-teal-600 text-white">
        <IconBrand size={20} />
      </span>
      <span>
        <span className="block text-base font-bold leading-[1.15] tracking-[-.01em]">Ratsmonitor</span>
        <span className="block text-xs leading-[1.2] text-slate-500">Politik vor Ort verstehen</span>
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
