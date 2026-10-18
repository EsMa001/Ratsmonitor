import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSwipe } from "../lib/useSwipe";
import { useTier } from "../lib/tier";

export const SAVED_TABS: [string, string][] = [["/konto/suchen", "Suchen"], ["/konto/artikel", "Artikel"], ["/konto/kalender", "Kalender"]];

/** Wischen nach links/rechts wechselt zwischen Folgen, Artikel und (mit Kalender) Kalender; Handler für den Rahmen der Seite */
export function useSavedSwipe() {
  const p = usePathname();
  const router = useRouter();
  const { limits } = useTier();
  const order = SAVED_TABS.map(([h]) => h).filter((h) => h !== "/konto/kalender" || limits.calendar);
  return useSwipe((dir) => {
    const i = order.indexOf(p), to = order[i - dir];
    if (i >= 0 && to) router.push(to);
  }).handlers;
}

/** Umschalter oben auf den drei Gespeichert-Seiten (nur Handy) */
export function SavedTabs() {
  const p = usePathname();
  const { limits } = useTier();
  /* Kalender nur für Stufen mit Kalender (heute Enterprise); wer schon dort ist, behält den Umschalter */
  const tabs = SAVED_TABS.filter(([href]) => href !== "/konto/kalender" || limits.calendar || p === href);
  return (
    <nav aria-label="Gespeichert" className="sticky top-[var(--rm-head,58px)] z-[1000] transition-[top] duration-200 flex border-b border-slate-200 bg-white sm:hidden">
      {tabs.map(([href, label]) => (
        <Link key={href} href={href} aria-current={p === href ? "page" : undefined}
          className={`flex min-h-[44px] flex-1 items-center justify-center text-[14px] no-underline ${p === href ? "border-b-2 border-teal-600 font-semibold text-teal-700" : "text-slate-500"}`}>{label}</Link>
      ))}
    </nav>
  );
}
