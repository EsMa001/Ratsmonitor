import { useState } from "react";
import { usePathname } from "next/navigation";
import { useMe } from "../lib/account";
import { Icon } from "../info/icons";
import { ANALYSE, EINBLICKE, HINTERGRUENDE, type XEintrag } from "./MainMenu";
import { Sheet } from "./Sheet";
import { Segmented, Tile } from "./SegTiles";

const GRUPPEN: [string, XEintrag[]][] = [["Analysen", ANALYSE], ["Einblicke", EINBLICKE], ["Hintergründe", HINTERGRUENDE]];

/** Auswahl der plenara.X-Seiten (Handy, Blatt von unten): öffnet der Tab „plenara.X“ der unteren Leiste; alle 11 Seiten in drei Gruppen mit ihrer Frage */
export function XSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const path = usePathname();
  const { features, ready } = useMe();
  /* Die Analysen gehören zu Plus: alle anderen sehen dieselbe Liste mit Schloss, jede Seite zeigt dann eine Vorschau */
  const locked = ready && !features.analytics;
  const [pick, setPick] = useState<string | null>(null);
  const own = GRUPPEN.find(([, l]) => l.some((f) => f.href === path))?.[0] ?? GRUPPEN[0][0];
  const active = pick ?? own;
  const list = GRUPPEN.find(([n]) => n === active)![1];
  return (
    <Sheet open={open} onClose={onClose} label="plenara.X Seiten">
      {locked && <p className="m-0 border-b border-slate-100 pb-3 text-[14px] text-slate-500">Die Analysen gehören zu Plus. Jede Seite zeigt eine Vorschau.</p>}
      {/* Schalter mit drei Stellungen (wie am iPhone), darunter die Seiten der Gruppe als Kacheln (höchstens 4, kein Scrollen) */}
      <Segmented label="Gruppe" names={GRUPPEN.map(([n]) => n)} active={active} onPick={setPick} />
      <ul className="m-0 mt-3 grid list-none grid-cols-2 gap-2 p-0">
        {list.map((f) => (
          <li key={f.href}><Tile href={f.href} icon={<Icon name={f.icon} size={22} />} label={f.label} hint={f.hint} on={f.href === path} locked={locked} onClick={() => f.href === path && onClose()} /></li>
        ))}
      </ul>
    </Sheet>
  );
}
