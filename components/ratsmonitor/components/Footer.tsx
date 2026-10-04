import Link from "next/link";
import { useBrand } from "../lib/brand";

const GROUPS: { title: string; links: [string, string][] }[] = [
  { title: "Produkt", links: [["/", "Suche"], ["/preise", "Preise & Tarife"], ["/branchen", "Branchen & Anwendungsfälle"]] },
  { title: "Informationen", links: [["/ueber-ratsmonitor", "Über uns"], ["/faq", "FAQ"], ["/quellen", "Quellen & Abdeckung"]] },
  { title: "Rechtliches", links: [["/impressum", "Impressum"], ["/datenschutz", "Datenschutz"]] },
];

/** Fußzeile auf allen Seiten: Marke, Linkgruppen, Hinweis auf die Originalquellen */
export function Footer() {
  const { name } = useBrand();
  return (
    <footer className="mt-6 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-page gap-8 py-10 sm:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
        <div>
          <p className="m-0 text-[16px] font-semibold text-slate-900">{name}</p>
          <p className="m-0 mt-2 max-w-[36ch] text-[13px] leading-relaxed text-slate-500">
            Beschlüsse und Beratungen aus den offiziellen Ratsinformationssystemen der Kommunen. Maßgeblich sind stets die verlinkten Originalunterlagen.
          </p>
        </div>
        {GROUPS.map((g) => (
          <nav key={g.title} aria-label={g.title}>
            <p className="m-0 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{g.title}</p>
            <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
              {g.links.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="text-[14px] text-slate-600 no-underline hover:text-teal-600">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="mx-auto max-w-page border-t border-slate-100 py-4 text-[12px] text-slate-500">© {new Date().getFullYear()} {name}</div>
    </footer>
  );
}
