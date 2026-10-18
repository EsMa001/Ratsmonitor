import Link from "next/link";
import { usePathname } from "next/navigation";
import { DarkCta } from "../info/blocks";
import { useMe } from "../lib/account";
import { useBrand, useBrandText } from "../lib/brand";

const GROUPS: { title: string; links: [string, string][] }[] = [
  { title: "Informationen", links: [["/preise", "Preise"], ["/faq", "FAQ"], ["/videos", "Videos"], ["/datenabdeckung", "Datenabdeckung"]] },
  { title: "Rechtliches", links: [["/impressum", "Impressum"], ["/datenschutz", "Datenschutz"], ["/agb", "AGB"], ["/widerruf", "Widerruf"]] },
];

/** Fußzeile auf allen Seiten: Marke, Linkgruppen, Hinweis auf die Originalquellen */
/* Seiten mit eigener, inhaltlich passender Petrol-Kachel; Kontoseiten ganz ohne Abschlussband */
const OWN_CTA = (p: string) => p === "/" || p.startsWith("/konto/") || p.startsWith("/funktionen/") || p === "/preise" || p === "/faq" || p === "/videos" || p === "/datenabdeckung" || p.startsWith("/anwender");

export function Footer() {
  const { name } = useBrand();
  const brandText = useBrandText();
  const path = usePathname();
  const me = useMe();
  return (
    <>
    {/* Abstand, damit Inhalt wie die Seitenzahl nicht im Verlauf des Abschlusses steht */}
    {/* Handy: kein Abschlussband und kein großer Fuß (wirkt wie eine Webseite); nur eine schmale Zeile mit den Pflichtangaben */}
    {!OWN_CTA(path) && <div className="ri pt-16 max-sm:hidden print:hidden">{
      /* Ohne Anmeldung: Hinweis auf das Konto (nicht auf Konto- und Anmeldeseiten, nicht in der geschlossenen Testphase) */
      me.ready && me.accounts && !me.user && me.access !== "invite" && !(path.startsWith("/konto/") || path.startsWith("/anmelden") || path === "/registrieren") ? (
        <DarkCta title="Mit Konto speichern" sub="Suchen und Artikel im Konto speichern. Anmeldung mit einem Link per E-Mail, ohne Passwort." action={<Link href="/anmelden" className="ri-btn ri-btn--inv">Anmelden</Link>} />
      ) : (
        <DarkCta title="Fragen oder Anregungen?" sub={`Wir freuen uns über Ihr Feedback zu ${name}.`} action={<Link href="/kontakt" className="ri-btn ri-btn--inv">Kontakt aufnehmen</Link>} />
      )}</div>}
    <footer className="pl-footer-accent border-t max-sm:hidden">
      <div className="mx-auto grid max-w-page grid-cols-2 gap-x-6 gap-y-4 py-4 sm:gap-8 sm:py-5 lg:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))]">
        <div className="col-span-2 sm:col-span-1">
          <p className="m-0 text-[16px] font-semibold text-slate-900">{name}</p>
          <p className="m-0 mt-2 max-w-[36ch] text-[12px] leading-relaxed sm:text-[14px] text-slate-500">
            Beschlüsse und Beratungen aus den offiziellen Ratsinformationssystemen der Kommunen. Maßgeblich sind stets die verlinkten Originalunterlagen.
          </p>
        </div>
        {GROUPS.map((g) => (
          <nav key={g.title} aria-label={g.title} className="min-w-0">
            <p className="m-0 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{g.title}</p>
            <ul className="m-0 mt-2 flex list-none flex-col gap-0 p-0 sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-1">
              {g.links.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} lang="de" className="block py-0.5 max-sm:py-[13px] hyphens-auto break-words text-[14px] text-slate-600 no-underline hover:text-teal-700">
                    {brandText(label)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="mx-auto max-w-page border-t border-slate-100 py-2 text-[12px] text-slate-500">© {new Date().getFullYear()} {name}</div>
    </footer>
    <nav aria-label="Rechtliches" className="rm-legalbar border-t border-slate-200 px-4 py-1 text-center text-[12px] text-slate-500 sm:hidden print:hidden">
      {[["/impressum", "Impressum"], ["/datenschutz", "Datenschutz"], ["/agb", "AGB"], ["/widerruf", "Widerruf"], ["/kontakt", "Kontakt"]].map(([href, label], i) => (
        <span key={href}>{i > 0 && " · "}<Link href={href} className="inline-block min-h-[44px] min-w-[44px] px-1.5 text-center leading-[44px] text-slate-500 no-underline">{label}</Link></span>
      ))}
    </nav>
    </>
  );
}
