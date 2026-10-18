import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { Bookmark, Ellipsis, Heart, Search, Sparkles, type LucideIcon } from "lucide-react";
import { MoreSheet } from "../menu/MoreSheet";
import { XSheet } from "../menu/XSwitcher";
import { isAnalyticsPath } from "../lib/routes";

/** Untere Leiste auf dem Handy (unter 640 px) wie in einer App: fünf feste Ziele für alle Stufen (Suche mit Karte und Treffern, plenara.X als Auswahl der Analysen, Einblicke und Hintergründe, Folgen = gespeicherte Suchen mit Benachrichtigung, Artikel = gemerkte Artikel, Mehr als Blatt; der Kalender liegt für Enterprise im Umschalter der beiden), das aktive in Petrol. Die Startseite erreicht man über das Logo.
 *  plenara.X öffnet ein Blatt mit allen Seiten (XSheet), Mehr eines mit Konto, Anwendern und Informationen.
 *  Höhe und sicherer Rand unten stehen in `--rm-tabbar` (app/ratsmonitor.css), damit Seiten darüber enden. */
export function BottomNav() {
  const p = usePathname();
  const [more, setMore] = useState(false);
  const [x, setX] = useState(false);
  const closeX = useCallback(() => setX(false), []);
  const close = useCallback(() => setMore(false), []);
  const xOn = x || isAnalyticsPath(p);
  const moreOn = more || p === "/konto/profil" || p.startsWith("/anmelden");
  const link = (href: string, label: string, Icon: LucideIcon, on: boolean) => (
    <li key={label}>
      <Link href={href} aria-current={on ? "page" : undefined} className={`${cell} ${on ? "font-semibold text-teal-700" : "text-slate-500"}`}>
        <Icon size={22} strokeWidth={on ? 2 : 1.6} aria-hidden="true" />
        {label}
      </Link>
    </li>
  );
  const sheet = (label: string, Icon: LucideIcon, on: boolean, expanded: boolean, open: () => void) => (
    <li>
      <button type="button" aria-haspopup="dialog" aria-expanded={expanded} onClick={open} className={`${cell} ${on ? "font-semibold text-teal-700" : "text-slate-500"}`}>
        <Icon size={22} strokeWidth={on ? 2 : 1.6} aria-hidden="true" />
        {label}
      </button>
    </li>
  );
  const cell = "flex h-[56px] w-full flex-col items-center justify-center gap-0.5 border-0 bg-transparent p-0 text-[12px] no-underline [-webkit-tap-highlight-color:transparent] active:bg-slate-50";
  return (
    <>
      <nav aria-label="App-Navigation" className="rm-tabbar fixed inset-x-0 bottom-0 z-[1100] border-t border-slate-200 bg-white sm:hidden print:hidden">
        <ul className="m-0 grid list-none grid-cols-5 p-0">
          {link("/suche", "Suche", Search, p === "/suche" || p.startsWith("/beschluss/"))}
          {sheet("plenara.X", Sparkles, xOn, x, () => setX(true))}
          {link("/konto/suchen", "Folgen", Heart, p === "/konto/suchen")}
          {link("/konto/artikel", "Artikel", Bookmark, p === "/konto/artikel" || p === "/konto/kalender")}
          {sheet("Mehr", Ellipsis, moreOn, more, () => setMore(true))}
        </ul>
      </nav>
      <XSheet open={x} onClose={closeX} />
      <MoreSheet open={more} onClose={close} />
    </>
  );
}
