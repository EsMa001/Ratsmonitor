import type { ReactNode } from "react";
import { Reveal } from "./Reveal";
import { AnalyticsLogo } from "../../components/Brand";

/** Kopfband der plenara.X-Seiten: derselbe Farbverlauf oben rechts wie im Kopf der Branchenseiten (.ri-head), über die ganze Breite */
export function PageBand({ children }: { children: ReactNode }) {
  return (
    <div
      className="-mx-[max(1vw,16px)] mb-8 border-b border-[#eef1f4] px-[max(1vw,16px)] pb-10 pt-10"
      style={{ background: "radial-gradient(ellipse 1000px 520px at 88% -15%,rgba(13,148,136,.10),rgba(13,148,136,0) 70%),#fff" }}
    >
      <div className="mb-6 hidden print:block"><AnalyticsLogo size={30} /></div>
      <Reveal>{children}</Reveal>
    </div>
  );
}
