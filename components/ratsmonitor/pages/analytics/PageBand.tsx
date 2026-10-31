import type { ReactNode } from "react";
import { Reveal } from "./Reveal";
import { AnalyticsLogo } from "../../components/Brand";
import { BandDots } from "../../components/BandDots";

/** Kopfband der plenara.X-Seiten: derselbe Farbverlauf oben rechts wie im Kopf der Branchenseiten (.ri-head), über die ganze Breite */
/** compact: niedriges Band (Atlas: die Karte soll ohne Scrollen sichtbar sein); logo: plenara.X-Logo im Druck (nicht auf der Dokumentsuche) */
export function PageBand({ children, compact = false, logo = true }: { children: ReactNode; compact?: boolean; logo?: boolean }) {
  return (
    <>
    {/* Handy: echtes festes Element ganz oben in Bandfarbe, daran färbt iOS die Statusleiste (ein Pseudoelement genügte nicht) */}
    <div aria-hidden="true" className="rm-statusstrip" />
    <div
      className={`-mx-[max(1vw,16px)] pl-band sm:min-h-[174px] ${compact ? "pl-top " : ""}rm-topline px-[max(1vw,16px)] ${compact ? "mb-4 max-sm:mb-2 pb-7 pt-4" : "mb-8 max-sm:mb-4 pb-7 pt-4"}`}>
      <BandDots />
      {logo && <div className="mb-6 hidden print:block"><AnalyticsLogo size={30} /></div>}
      {/* Kompakt ohne Einblenden: Titel und Satz sind sofort da */}
      {compact ? children : <Reveal>{children}</Reveal>}
    </div>
    </>
  );
}
