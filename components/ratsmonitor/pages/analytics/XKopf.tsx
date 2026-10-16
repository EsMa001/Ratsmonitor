import Link from "next/link";
import { usePathname } from "next/navigation";
import { PageBand } from "./PageBand";

/*
 * Kopf der plenara.X-Seiten: Brotkrumen, Titel, Frage und (bei Atlas und Trends) die Reiter. Ein Reiter ist eine eigene Adresse
 * mit der bisherigen Auswertung (Ortsvergleich, Beschlüsse); Suchbegriff und Ort gelten seitenübergreifend (gemeinsame Suche).
 */
type Seite = { gruppe: "Analysen" | "Einblicke"; titel: string; frage: string; text: string; reiter?: [string, string][] };

const ATLAS: [string, string][] = [["/analytics/atlas", "Überblick"], ["/analytics/vergleich", "Vergleich"]];
const TRENDS: [string, string][] = [["/analytics/trends", "Verlauf"], ["/analytics/beschluesse", "Ausgang"]];

const SEITEN: Record<string, Seite> = {
  atlas: { gruppe: "Analysen", titel: "plenara.X Atlas", frage: "Wie viel?", text: "Worüber die Räte beraten, wo und wie viel, nach 10 Themen.", reiter: ATLAS },
  vergleich: { gruppe: "Analysen", titel: "plenara.X Atlas", frage: "Wie viel?", text: "Zwei Orte nebeneinander: Themen, Ausgang und was für jeden Ort typisch ist.", reiter: ATLAS },
  trends: { gruppe: "Analysen", titel: "plenara.X Trends", frage: "Was verändert sich?", text: "Begriffe, die zunehmen, und wie sie sich über die Gebiete ausbreiten.", reiter: TRENDS },
  beschluesse: { gruppe: "Analysen", titel: "plenara.X Trends", frage: "Was verändert sich?", text: "Wie es ausgeht: Beschlussquote, Vertagungen, Ablehnungen, Einigkeit und Dauer.", reiter: TRENDS },
  fraktionen: { gruppe: "Einblicke", titel: "Fraktionen", frage: "Wer will was?", text: "Welche Fraktionen welche Themen beantragen und was aus ihren Anträgen wird." },
  gremien: { gruppe: "Einblicke", titel: "Gremien", frage: "Wer berät was?", text: "Welchen Weg Vorgänge durch die Gremien nehmen und wo sie entschieden werden." },
  graph: { gruppe: "Einblicke", titel: "Themennetz", frage: "Was hängt zusammen?", text: "Womit ein Thema zusammenhängt: verwandte Begriffe als Netz zum Anklicken." },
  news: { gruppe: "Einblicke", titel: "News", frage: "Was ist diese Woche?", text: "Was in den Räten berichtenswert ist: je Vorgang eine Meldung mit wörtlichem Zitat und Quelle." },
};

export function XKopf({ seite }: { seite: keyof typeof SEITEN }) {
  const s = SEITEN[seite], path = usePathname();
  const teil = s.reiter?.find(([h]) => h === path)?.[1];
  return (
    <PageBand compact>
      <p className="text-[14px] text-slate-500">
        <Link href="/analytics/ueber" className="text-teal-700">plenara.X</Link>
        {s.gruppe === "Einblicke" ? <> / <Link href="/analytics/einblicke" className="text-teal-700">Einblicke</Link> / {s.titel}</> : <> / {s.titel.replace("plenara.X ", "")}{teil && teil !== s.reiter![0][1] ? ` / ${teil}` : ""}</>}
      </p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-[28px] font-semibold leading-tight">{s.titel}</h1>
        <p className="text-[16px] text-slate-500"><b className="font-semibold text-slate-700">{s.frage}</b> {s.text}</p>
      </div>
      {s.reiter && (
        <nav aria-label="Ansicht" className="-mb-4 mt-3 flex gap-6 print:hidden">
          {s.reiter.map(([href, name]) => (
            <Link key={href} href={href} aria-current={href === path ? "page" : undefined} scroll={false}
              className={`border-b-2 pb-2 text-[15px] ${href === path ? "border-teal-700 font-semibold text-slate-900" : "border-transparent text-slate-500 hover:text-slate-900"}`}>{name}</Link>
          ))}
        </nav>
      )}
    </PageBand>
  );
}

/** Querverweise unter einer Auswertung: dieselbe Suche auf einer anderen Seite weiterverfolgen */
export function XWeiter({ links }: { links: [string, string][] }) {
  return (
    <p className="mt-10 flex flex-wrap gap-x-6 gap-y-1 border-t border-slate-100 pt-4 text-[14px] text-slate-500 print:hidden">
      <span>Weiter mit derselben Suche:</span>
      {links.map(([href, name]) => <Link key={href} href={href} className="font-medium text-teal-700">{name} →</Link>)}
    </p>
  );
}
