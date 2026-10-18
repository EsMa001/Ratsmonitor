import Link from "next/link";
import { Icon } from "../info/icons";
import { BRANCHEN } from "../info/content";
import { ANWENDER, INFO } from "./MainMenu";
import { useInstall } from "../lib/useInstall";
import { Sheet, SHEET_HEAD, SHEET_ROW } from "./Sheet";

/** „Mehr“ in der unteren Leiste (Handy): ersetzt ☰: Anwender, Informationen, Rechtliches. Konto, Preise, Dunkler Modus und Admin stehen im Konto-Menü oben rechts. */
export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useInstall();
  return (
    <Sheet open={open} onClose={onClose} label="Mehr">
      <p className={SHEET_HEAD}>Anwender</p>
      {ANWENDER.map((g) => (
        <Link key={g.slug} href={`/anwender/${g.slug}`} className={SHEET_ROW}><Icon name={g.icon ?? BRANCHEN.find((x) => x.slug === g.slug)?.icon ?? "fileText"} size={18} />{g.label}</Link>
      ))}
      <p className={SHEET_HEAD}>Informationen</p>
      {INFO.filter((f) => f.href !== "/preise").map((f) => (
        <Link key={f.href} href={f.href} className={SHEET_ROW}><Icon name={f.icon} size={18} />{f.label}</Link>
      ))}
      <Link href="/funktionen/benachrichtigungen" className={SHEET_ROW}><Icon name="bell" size={18} />Benachrichtigungen</Link>
      {app.kind === "prompt" && <button type="button" onClick={() => { app.install(); onClose(); }} className={`${SHEET_ROW} w-full border-x-0 border-t-0 bg-transparent text-left`}><Icon name="check" size={18} />Als App hinzufügen</button>}
      {app.kind === "ios" && <p className="m-0 border-b border-slate-100 py-3 text-[14px] text-slate-500">Als App: unten auf Teilen tippen, dann „Zum Home-Bildschirm“.</p>}
      <p className="m-0 flex gap-4 pt-4 text-[12px] text-slate-500">
        <Link href="/impressum" className="text-slate-500">Impressum</Link>
        <Link href="/datenschutz" className="text-slate-500">Datenschutz</Link>
      </p>
    </Sheet>
  );
}
