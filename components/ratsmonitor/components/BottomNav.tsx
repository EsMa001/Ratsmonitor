import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, House, Search, Sparkles, User, type LucideIcon } from "lucide-react";
import { useMe } from "../lib/account";
import { isAnalyticsPath } from "../lib/routes";

/** Untere Leiste auf dem Handy (unter 640 px) wie in einer App: fünf feste Ziele (Start, Suche mit Karte und Treffern, Gespeichert, plenara.X, Konto), das aktive in Petrol.
 *  Höhe und sicherer Rand unten stehen in `--rm-tabbar` (app/ratsmonitor.css), damit Seiten darüber enden. */
export function BottomNav() {
  const p = usePathname();
  const me = useMe();
  const tabs: { href: string; label: string; Icon: LucideIcon; on: boolean }[] = [
    { href: "/", label: "Start", Icon: House, on: p === "/" },
    { href: "/suche", label: "Suche", Icon: Search, on: p === "/suche" || p.startsWith("/beschluss/") },
    { href: "/konto/suchen", label: "Gespeichert", Icon: Heart, on: p === "/konto/suchen" || p === "/konto/artikel" || p === "/konto/kalender" },
    { href: "/analytics/atlas", label: "plenara.X", Icon: Sparkles, on: isAnalyticsPath(p) },
    { href: me.user ? "/konto/profil" : "/anmelden", label: "Konto", Icon: User, on: p === "/konto/profil" || p.startsWith("/anmelden") },
  ];
  return (
    <nav aria-label="App-Navigation" className="rm-tabbar fixed inset-x-0 bottom-0 z-[1100] border-t border-slate-200 bg-white sm:hidden print:hidden">
      <ul className="m-0 grid list-none grid-cols-5 p-0">
        {tabs.map(({ href, label, Icon, on }) => (
          <li key={label}>
            <Link href={href} aria-current={on ? "page" : undefined}
              className={`flex h-[56px] flex-col items-center justify-center gap-0.5 text-[12px] no-underline [-webkit-tap-highlight-color:transparent] active:bg-slate-50 ${on ? "font-semibold text-teal-700" : "text-slate-500"}`}>
              <Icon size={22} strokeWidth={on ? 2 : 1.6} aria-hidden="true" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
