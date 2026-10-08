import Link from "next/link";
import { usePathname } from "next/navigation";
import { DarkCta } from "../info/blocks";
import { useTier } from "../lib/tier";
import { useBrand, useBrandText } from "../lib/brand";

const GROUPS: { title: string; links: [string, string][] }[] = [
  { title: "Informationen", links: [["/preise", "Preise"], ["/faq", "FAQ"], ["/videos", "Videos"], ["/datenabdeckung", "Datenabdeckung"]] },
  { title: "Rechtliches", links: [["/impressum", "Impressum"], ["/datenschutz", "Datenschutz"], ["/agb", "AGB"], ["/widerruf", "Widerruf"]] },
];

/** Fußzeile auf allen Seiten: Marke, Linkgruppen, Hinweis auf die Originalquellen */
/* Seiten mit eigener, inhaltlich passender Petrol-Kachel; Kontoseiten ganz ohne Abschlussband */
const OWN_CTA = (p: string) => p.startsWith("/konto/") || p.startsWith("/funktionen/") || p === "/preise" || p === "/faq" || p === "/videos" || p === "/datenabdeckung" || p.startsWith("/anwender");

export function Footer() {
  const { name } = useBrand();
  const brandText = useBrandText();
  const path = usePathname();
  const { tier } = useTier();
  return (
    <>
    {/* Abstand, damit Inhalt wie die Seitenzahl nicht im Verlauf des Abschlusses steht */}
    {!OWN_CTA(path) && <div className="ri pt-16">{
      /* Auf Konto-, Anmelde- und Registrierseiten steht die Aufforderung schon im Inhalt: dort kein zweites Mal */
      tier === "guest" && !(path.startsWith("/konto/") || path === "/anmelden" || path === "/registrieren") ? (
        <DarkCta title="Starten Sie kostenlos" sub="Alle Treffer und Filter, Suchen speichern. Ohne Zahlungsdaten." action={<Link href="/registrieren?tarif=free" className="ri-btn ri-btn--inv">Konto erstellen</Link>} />
      ) : (
        <DarkCta title="Fragen oder Anregungen?" sub={`Wir freuen uns über Ihr Feedback zu ${name}.`} action={<Link href="/kontakt" className="ri-btn ri-btn--inv">Kontakt aufnehmen</Link>} />
      )}</div>}
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-page grid-cols-2 gap-x-6 gap-y-6 py-8 sm:gap-8 sm:py-10 lg:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))]">
        <div className="col-span-2 sm:col-span-1">
          <p className="m-0 text-[16px] font-semibold text-slate-900">{name}</p>
          <p className="m-0 mt-2 max-w-[36ch] text-[12px] leading-relaxed sm:text-[14px] text-slate-500">
            Beschlüsse und Beratungen aus den offiziellen Ratsinformationssystemen der Kommunen. Maßgeblich sind stets die verlinkten Originalunterlagen.
          </p>
        </div>
        {GROUPS.map((g) => (
          <nav key={g.title} aria-label={g.title} className="min-w-0">
            <p className="m-0 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{g.title}</p>
            <ul className="m-0 mt-2 flex list-none flex-col gap-0 p-0 sm:mt-3 sm:gap-2">
              {g.links.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} lang="de" className="block max-sm:py-[13px] hyphens-auto break-words text-[14px] text-slate-600 no-underline hover:text-teal-600">
                    {brandText(label)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="mx-auto max-w-page border-t border-slate-100 py-4 text-[12px] text-slate-500">© {new Date().getFullYear()} {name}</div>
    </footer>
    </>
  );
}
