import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageBand } from "./PageBand";
import { ThemeRadarPage } from "./ThemeRadarPage";
import { KitaRadarPage } from "./KitaRadarPage";
import { BauleitplanungPage } from "./BauleitplanungPage";
import { ScoreView } from "./ScoreView";
import { GRUPPEN } from "../../info/branchen-enterprise";

/** Themen des Atlas: Adresse (?bereich=…, gleich den früheren Seiten /analytics/<bereich>), Name in der Themenleiste;
    zuerst der plenara.X Score als Startfärbung */
export const ATLAS_BEREICHE = [
  ["score", "plenara.X Score"],
  ["kita", "Kita"],
  ["versorgung", "Versorgung"],
  ["verkehr", "Verkehr"],
  ["bauleitplanung", "Bauleitplanung"],
  ["soziales", "Vereine und Soziales"],
  ["klima", "Klima und Energie"],
  ["finanzlage", "Haushalt und Steuern"],
  ["gebuehren", "Gebühren"],
  ["vergabe", "Vergabe"],
  ["beteiligung", "Beteiligung"],
] as const;
export type AtlasBereich = (typeof ATLAS_BEREICHE)[number][0];
export const isAtlasBereich = (v: string): v is AtlasBereich => ATLAS_BEREICHE.some(([id]) => id === v);
export const atlasHref = (bereich: AtlasBereich) => `/analytics/atlas?bereich=${bereich}`;

/**
 * plenara.X Atlas: eine Seite für alle Themenradare. Oben die Themenleiste (zuerst der Score über alle Themen), darunter Karte und Auswertung des gewählten
 * Themas (dieselben Bausteine wie die früheren Einzelseiten, ohne deren Kopf). Die früheren Adressen (/analytics/verkehr …)
 * zeigen den Atlas mit ihrem Thema und stellen die Adresse auf /analytics/atlas?bereich=… um.
 */
export function AtlasPage({ initial }: { initial?: AtlasBereich }) {
  const params = useSearchParams(), router = useRouter(), path = usePathname();
  const fromUrl = params.get("bereich") ?? "";
  const bereich: AtlasBereich = isAtlasBereich(fromUrl) ? fromUrl : initial ?? "score";
  // Frühere Einzeladresse oder fehlender Bereich: auf die Atlas-Adresse umstellen (ohne neuen Verlaufseintrag)
  useEffect(() => {
    if (path !== "/analytics/atlas" || fromUrl !== bereich) router.replace(atlasHref(bereich), { scroll: false });
  }, [path, fromUrl, bereich, router]);
  const pick = (id: AtlasBereich) => router.replace(atlasHref(id), { scroll: false });
  const name = ATLAS_BEREICHE.find(([id]) => id === bereich)?.[1] ?? "";
  return (
    <main id="inhalt" className="w-full px-[max(1vw,16px)] pb-10 text-slate-900">
      <PageBand>
        <p className="text-[14px] text-slate-500"><Link href={GRUPPEN.radar.href} className="text-teal-600">{GRUPPEN.radar.name}</Link> / Atlas</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight sm:text-[44px]">plenara.X Atlas</h1>
        <p className="mt-2 max-w-[680px] text-[16px] text-slate-500">Eine Karte für alle Themen: wie häufig ein Thema in den Räten vorkommt, verglichen mit ähnlichen Kommunen, und was dort beraten wird. Zuerst der plenara.X Score über alle Themen; Thema wählen, Ort anklicken oder suchen.</p>
      </PageBand>
      <nav aria-label="Thema des Atlas" className="-mx-[max(1vw,16px)] mt-2 overflow-x-auto px-[max(1vw,16px)] print:hidden">
        <ul className="m-0 flex w-max list-none gap-2 p-0">
          {ATLAS_BEREICHE.map(([id, label]) => (
            <li key={id}>
              <button type="button" aria-pressed={id === bereich} onClick={() => pick(id)}
                className={`h-9 whitespace-nowrap rounded-full px-4 text-[14px] ${id === bereich ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{label}</button>
            </li>
          ))}
        </ul>
      </nav>
      <h2 className="mt-8 text-[22px] font-semibold">{name}</h2>
      {/* key: beim Themenwechsel startet die Auswertung neu (eigener Zustand je Thema) */}
      {bereich === "score" ? <ScoreView onTheme={(id) => isAtlasBereich(id) && pick(id)} atlasThemes={ATLAS_BEREICHE.map(([id]) => id)} /> :
        bereich === "kita" ? <KitaRadarPage key="kita" embedded /> :
        bereich === "bauleitplanung" ? <BauleitplanungPage embedded /> :
        bereich === "finanzlage" ? <ThemeRadarPage key="finanzen" id="finanzen" analyse="finanzlage" embedded /> :
        <ThemeRadarPage key={bereich} id={bereich} embedded />}
    </main>
  );
}
