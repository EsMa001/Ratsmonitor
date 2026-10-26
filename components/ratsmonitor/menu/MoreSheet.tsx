import Link from "next/link";
import { useState } from "react";
import { LEGAL } from "../components/Footer";
import { Icon } from "../info/icons";
import { BRANCHEN } from "../info/content";
import { ANWENDER, INFO } from "./MainMenu";
import { useInstall } from "../lib/useInstall";
import { Sheet } from "./Sheet";
import { Segmented, Tile } from "./SegTiles";

const GRUPPEN = ["Anwender", "Informationen"];

/** „Mehr“ in der unteren Leiste (Handy): ersetzt ☰: Anwender, Informationen, Rechtliches. Konto, Preise, Dunkler Modus und Admin stehen im Konto-Menü oben rechts. */
export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useInstall();
  const [pick, setPick] = useState<string | null>(null);
  const active = pick ?? GRUPPEN[0];
  return (
    <Sheet open={open} onClose={onClose} label="Mehr">
      {/* Gleiche Bauart wie das plenara.X-Blatt: Schalter, darunter Kacheln */}
      <Segmented label="Bereich" names={GRUPPEN} active={active} onPick={setPick} />
      <ul className="m-0 mt-3 grid list-none grid-cols-2 gap-2 p-0">
        {active === "Anwender"
          ? ANWENDER.map((g) => (
              <li key={g.slug}><Tile href={`/anwender/${g.slug}`} label={g.label} icon={<Icon name={g.icon ?? BRANCHEN.find((x) => x.slug === g.slug)?.icon ?? "fileText"} size={22} />} /></li>
            ))
          : [...INFO.filter((f) => f.href !== "/preise"), { href: "/funktionen/benachrichtigungen", label: "Benachrichtigungen", icon: "bell" as const }].map((f) => (
              <li key={f.href}><Tile href={f.href} label={f.label} icon={<Icon name={f.icon} size={22} />} /></li>
            ))}
      </ul>
      {/* Rechtliches: auf der Suche fehlt die Handyzeile der Fußzeile (search.css), hier ist es immer erreichbar */}
      <nav aria-label="Rechtliches" className="mt-3 flex flex-wrap gap-x-4 text-[13px]">
        {LEGAL.map(([href, label]) => (
          <Link key={href} href={href} onClick={onClose} className="inline-block min-h-[44px] leading-[44px] text-slate-600 no-underline">{label}</Link>
        ))}
      </nav>
      {app.kind === "prompt" &&<button type="button" onClick={() => { app.install(); onClose(); }} className="mt-3 flex h-11 w-full items-center gap-3 rounded-xl border border-teal-600/30 px-3 text-left text-[14px] font-medium text-teal-800"><Icon name="check" size={18} />Als App hinzufügen</button>}
    </Sheet>
  );
}
