import type { ReactNode } from "react";
import { Reveal } from "./Reveal";
import { AnalyticsLogo } from "../../components/Brand";

/** Kopfband der plenara.X-Seiten: derselbe Farbverlauf oben rechts wie im Kopf der Branchenseiten (.ri-head), über die ganze Breite */
/** compact: niedriges Band (Atlas: die Karte soll ohne Scrollen sichtbar sein) */
export function PageBand({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return (
    <div
      className={`-mx-[max(1vw,16px)] border-b border-slate-100 rm-topline px-[max(1vw,16px)] ${compact ? "mb-4 pb-4 pt-5" : "mb-8 pb-10 pt-10"}`}
      style={{ background: "radial-gradient(ellipse 1000px 520px at 88% -15%,rgba(38,132,120,.10),rgba(38,132,120,0) 70%)" }}
    >
      <div className="mb-6 hidden print:block"><AnalyticsLogo size={30} /></div>
      {/* Kompakt ohne Einblenden: Titel und Satz sind sofort da */}
      {compact ? children : <Reveal>{children}</Reveal>}
    </div>
  );
}
