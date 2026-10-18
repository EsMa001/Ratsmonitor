import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { Ellipsis, House, Search, Sparkles, Star, type LucideIcon } from "lucide-react";
import { MoreSheet } from "../menu/MoreSheet";
import { XSheet } from "../menu/XSwitcher";
import { MeinSheet } from "../menu/MeinSheet";
import { isAnalyticsPath } from "../lib/routes";

/** Untere Leiste auf dem Handy (unter 640 px) wie in einer App: fünf feste Ziele für alle Stufen (Suche mit Karte und Treffern, plenara.X als Auswahl der Analysen, Einblicke und Hintergründe, Folgen = gespeicherte Suchen mit Benachrichtigung, Artikel = gemerkte Artikel, Mehr als Blatt; der Kalender liegt für Enterprise im Umschalter der beiden), das aktive in Petrol. Die Startseite erreicht man über das Logo.
 *  plenara.X öffnet ein Blatt mit allen Seiten (XSheet), Mehr eines mit Konto, Anwendern und Informationen.
 *  Höhe und sicherer Rand unten stehen in `--rm-tabbar` (app/ratsmonitor.css), damit Seiten darüber enden. */
export function BottomNav() {
  const p = usePathname();
  /* Höchstens ein Blatt gleichzeitig; ein zweiter Tipp auf dasselbe Symbol schließt es */
  const [sheet, setSheet] = useState<"x" | "mein" | "more" | null>(null);
  const close = useCallback(() => setSheet(null), []);
  const xOn = sheet === "x" || isAnalyticsPath(p);
  const meinOn = sheet === "mein" || p === "/konto/suchen" || p === "/konto/artikel" || p === "/konto/kalender" || p === "/konto/benachrichtigungen";
  const moreOn = sheet === "more" || p === "/konto/profil" || p.startsWith("/anmelden");
  const link = (href: string, label: string, Icon: LucideIcon, on: boolean) => (
    <li key={label}>
      <Link href={href} onClick={close} aria-current={on ? "page" : undefined} className={`${cell} ${on ? "font-semibold text-teal-700" : "text-slate-500"}`}>
        <Icon size={22} strokeWidth={on ? 2 : 1.6} aria-hidden="true" />
        {label}
      </Link>
    </li>
  );
  const tab = (name: "x" | "mein" | "more", label: string, Icon: LucideIcon, on: boolean) => (
    <li>
      <button type="button" aria-haspopup="dialog" aria-expanded={sheet === name} onClick={() => setSheet(sheet === name ? null : name)} className={`${cell} ${on ? "font-semibold text-teal-700" : "text-slate-500"}`}>
        <Icon size={22} strokeWidth={on ? 2 : 1.6} aria-hidden="true" />
        {label}
      </button>
    </li>
  );
  const cell = "flex h-[52px] w-full whitespace-nowrap tracking-tight flex-col items-center justify-center gap-0.5 border-0 bg-transparent p-0 text-[12px] no-underline [-webkit-tap-highlight-color:transparent] active:bg-slate-50";
  return (
    <>
      <nav aria-label="App-Navigation" className="rm-tabbar fixed inset-x-0 bottom-0 z-[1100] border-t-2 border-teal-600 bg-white sm:hidden print:hidden">
        <ul className="m-0 grid list-none grid-cols-5 p-0">
          {link("/", "Start", House, p === "/")}
          {link("/suche", "Suche", Search, p === "/suche" || p.startsWith("/beschluss/"))}
          {tab("x", "plenara.X", Sparkles, xOn)}
          {tab("mein", "Favoriten", Star, meinOn)}
          {tab("more", "Mehr", Ellipsis, moreOn)}
        </ul>
      </nav>
      <XSheet open={sheet === "x"} onClose={close} />
      <MeinSheet open={sheet === "mein"} onClose={close} />
      <MoreSheet open={sheet === "more"} onClose={close} />
    </>
  );
}
