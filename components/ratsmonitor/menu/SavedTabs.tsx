import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTier } from "../lib/tier";

const TABS: [string, string][] = [["/konto/suchen", "Suchen"], ["/konto/artikel", "Artikel"], ["/konto/kalender", "Kalender"]];

/** Umschalter oben auf den drei Gespeichert-Seiten (nur Handy) */
export function SavedTabs() {
  const p = usePathname();
  const { limits } = useTier();
  /* Kalender nur für Stufen mit Kalender (heute Enterprise); wer schon dort ist, behält den Umschalter */
  const tabs = TABS.filter(([href]) => href !== "/konto/kalender" || limits.calendar || p === href);
  return (
    <nav aria-label="Gespeichert" className="sticky top-[58px] z-[1000] flex border-b border-slate-200 bg-white sm:hidden">
      {tabs.map(([href, label]) => (
        <Link key={href} href={href} aria-current={p === href ? "page" : undefined}
          className={`flex min-h-[44px] flex-1 items-center justify-center text-[14px] no-underline ${p === href ? "border-b-2 border-teal-600 font-semibold text-teal-700" : "text-slate-500"}`}>{label}</Link>
      ))}
    </nav>
  );
}
