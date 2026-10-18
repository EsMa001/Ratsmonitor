import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { useTier } from "../lib/tier";
import { Icon } from "../info/icons";
import { ANALYSE, EINBLICKE, HINTERGRUENDE, XGruppe, type XEintrag } from "./MainMenu";
import { Sheet, SHEET_HEAD } from "./Sheet";

const GRUPPEN: [string, XEintrag[]][] = [["Analysen", ANALYSE], ["Einblicke", EINBLICKE], ["Hintergründe", HINTERGRUENDE]];

/** Auswahl der plenara.X-Seiten (Handy, Blatt von unten): öffnet der Tab „plenara.X“ der unteren Leiste; alle 11 Seiten in drei Gruppen mit ihrer Frage */
export function XSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const path = usePathname();
  const { tier, ready } = useTier();
  /* Die Analysen gehören zu Enterprise: alle anderen sehen dieselbe Liste mit Schloss, jede Seite zeigt dann eine Vorschau */
  const locked = ready && tier !== "enterprise";
  return (
    <Sheet open={open} onClose={onClose} label="plenara.X Seiten">
      {locked && <p className="m-0 border-b border-slate-100 pb-3 text-[14px] text-slate-500">Die Analysen gehören zu Enterprise. Jede Seite zeigt eine Vorschau.</p>}
      {GRUPPEN.map(([name, list]) => (
        <div key={name}>
          <p className={SHEET_HEAD}><XGruppe name={name} /></p>
          {list.map((f) => (
            <Link key={f.href} href={f.href} aria-current={f.href === path ? "page" : undefined}
              className={`flex min-h-[48px] items-center gap-3 border-b border-slate-100 no-underline ${f.href === path ? "text-teal-700" : "text-slate-900"}`}>
              <Icon name={f.icon} size={18} />
              <span className="min-w-0 flex-1"><span className={`block text-[16px] ${f.href === path ? "font-semibold" : ""}`}>{f.label}</span>{f.hint && <span className="block text-[12px] text-slate-500">{f.hint}</span>}</span>
              {locked && <Lock size={14} className="flex-none text-slate-400" aria-label="gesperrt" />}
            </Link>
          ))}
        </div>
      ))}
    </Sheet>
  );
}
