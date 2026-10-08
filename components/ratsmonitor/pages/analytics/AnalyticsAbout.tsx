import { LiveThumb } from "../../info/BranchenLive";
import Link from "next/link";
import { PageBand } from "./PageBand";
import { Reveal } from "./Reveal";
import type { ReactNode } from "react";
import { AnalyticsLogo } from "../../components/Brand";
import type { AnalyseId } from "../../info/branchen-enterprise";

/** Vorschaubild der Diffusionsanalyse: Wellen von Punkten um einen Ursprung und die S-Kurve */
function DiffusionThumb() {
  const dots = Array.from({ length: 70 }, (_, i) => {
    const a = i * 2.399963, r = 5 + Math.sqrt(i) * 8.6;
    return { x: Math.round((98 + Math.cos(a) * r * 1.1) * 100) / 100, y: Math.round((78 + Math.sin(a) * r * 0.9) * 100) / 100, age: i / 70 };
  });
  const shade = (t: number) => (t < 0.25 ? "#0f766e" : t < 0.5 ? "#6ebfb8" : t < 0.75 ? "#8ccdc7" : "#d7dce3");
  return (
    <svg viewBox="0 0 320 156" role="img" aria-label="Vorschau der Diffusionsanalyse: Punkte breiten sich wellenförmig aus, daneben eine S-Kurve" className="block h-auto w-full rounded-[18px] border border-slate-200 bg-white">
      {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={3.2 + (1 - d.age) * 1.2} fill={shade(d.age)} />)}
      <path d="M190 126 C 212 124, 224 120, 238 100 S 262 44, 304 34" fill="none" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M190 126H304" stroke="#e2e8f0" />
    </svg>
  );
}

/** Vorschaubild des Knowledge Graph: ein Netz aus Knoten um einen Mittelpunkt */
function GraphThumb() {
  const hub: [number, number] = [160, 78];
  const ring: [number, number, number, string][] = [
    [96, 40, 7, "#0d9488"], [128, 24, 5, "#0d9488"], [200, 30, 8, "#0d9488"], [236, 62, 6, "#0d9488"], [232, 112, 7, "#0d9488"],
    [190, 134, 5, "#0d9488"], [124, 130, 8, "#0d9488"], [82, 102, 6, "#0d9488"], [60, 66, 4, "#94a3b8"], [268, 36, 5, "#0f172a"], [270, 90, 4, "#94a3b8"],
  ];
  const cross: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [0, 8], [3, 9], [4, 10], [2, 9], [6, 4]];
  return (
    <svg viewBox="0 0 320 156" role="img" aria-label="Vorschau des Knowledge Graph: Knoten um einen Suchbegriff, durch Linien verbunden" className="block h-auto w-full rounded-[18px] border border-slate-200 bg-white">
      {ring.map(([x, y], i) => <line key={`h${i}`} x1={hub[0]} y1={hub[1]} x2={x} y2={y} stroke="#94a3b8" strokeOpacity=".25" />)}
      {cross.map(([a, b]) => <line key={`${a}-${b}`} x1={ring[a][0]} y1={ring[a][1]} x2={ring[b][0]} y2={ring[b][1]} stroke="#94a3b8" strokeOpacity=".55" strokeWidth="1.4" />)}
      {ring.map(([x, y, r, c], i) => <circle key={i} cx={x} cy={y} r={r} fill={c} fillOpacity=".9" />)}
      <circle cx={hub[0]} cy={hub[1]} r="14" fill="#0f766e" />
      <rect x={hub[0] - 4.5} y={hub[1] - 4.5} width="9" height="9" fill="#fff" />
    </svg>
  );
}

/** Vorschaubild der Trends: Streudiagramm der Begriffe mit Aufsteigern oben links */
function TrendThumb() {
  const dots: [number, number, number, string][] = [
    [40, 28, 6, "#0f766e"], [62, 36, 5, "#0d9488"], [82, 30, 7, "#0d9488"], [108, 52, 8, "#0d9488"], [150, 62, 6, "#cbd5e1"], [176, 76, 9, "#cbd5e1"],
    [196, 70, 7, "#cbd5e1"], [220, 80, 10, "#cbd5e1"], [244, 74, 6, "#cbd5e1"], [270, 84, 7, "#cbd5e1"], [136, 98, 6, "#94a3b8"], [96, 118, 5, "#94a3b8"], [200, 112, 7, "#94a3b8"], [60, 126, 4, "#94a3b8"],
  ];
  return (
    <svg viewBox="0 0 320 156" role="img" aria-label="Vorschau der Trendkarte: Begriffe als Punkte, Aufsteiger oben links, Absteiger unten" className="block h-auto w-full rounded-[18px] border border-slate-200 bg-white">
      <line x1="16" x2="304" y1="82" y2="82" stroke="#94a3b8" strokeOpacity=".6" />
      <line x1="16" x2="304" y1="42" y2="42" stroke="#e2e8f0" strokeDasharray="3 4" />
      <line x1="16" x2="304" y1="122" y2="122" stroke="#e2e8f0" strokeDasharray="3 4" />
      {dots.map(([x, y, r, c]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={c} fillOpacity=".85" />)}
    </svg>
  );
}

/** Vorschaubild des Gebietsvergleichs: Schmetterlingsdiagramm, links ein Ort, rechts der andere, in der Mitte die Themen */
function CompareThumb() {
  const rows: [number, number][] = [[96, 40], [64, 88], [44, 52], [78, 24], [30, 70]];
  return (
    <svg viewBox="0 0 320 156" role="img" aria-label="Vorschau des Gebietsvergleichs: Balken zweier Orte gegenüber, links der eine, rechts der andere" className="block h-auto w-full rounded-[18px] border border-slate-200 bg-white">
      <line x1="160" x2="160" y1="16" y2="140" stroke="#cbd5e1" />
      <circle cx="40" cy="18" r="4" fill="#0d9488" /><circle cx="280" cy="18" r="4" fill="#0f172a" />
      {rows.map(([l, r], i) => (
        <g key={i} transform={`translate(0 ${34 + i * 22})`}>
          <rect x={160 - l} width={l - 4} height="12" rx="3" fill="#0d9488" fillOpacity=".9" />
          <rect x="164" width={r} height="12" rx="3" fill="#0f172a" fillOpacity=".85" />
        </g>
      ))}
    </svg>
  );
}

/** Vorschaubild von Beschlüssen: Ring der Beschlussquote und Balken je Gremienebene */
function DecisionThumb() {
  const C = 2 * Math.PI * 38, a = 0.82 * C, p = 0.12 * C, r = 0.06 * C;
  const bars: [number, number, number][] = [[0.94, 0.04, 0.02], [0.52, 0.4, 0.08], [0.34, 0.6, 0.06]];
  return (
    <svg viewBox="0 0 320 156" role="img" aria-label="Vorschau von Beschlüssen: Ring mit der Beschlussquote, daneben Balken je Gremienebene" className="block h-auto w-full rounded-[18px] border border-slate-200 bg-white">
      <g transform="translate(86 78) rotate(-90)">
        <circle r="38" fill="none" stroke="#0d9488" strokeWidth="14" strokeDasharray={`${a} ${C}`} />
        <circle r="38" fill="none" stroke="#94a3b8" strokeWidth="14" strokeDasharray={`${p} ${C}`} strokeDashoffset={-a} />
        <circle r="38" fill="none" stroke="#0f172a" strokeWidth="14" strokeDasharray={`${r} ${C}`} strokeDashoffset={-(a + p)} />
      </g>
      <text x="86" y="85" textAnchor="middle" fontSize="20" fontWeight="600" fill="#0f172a">91 %</text>
      {bars.map(([x, y, z], i) => (
        <g key={i} transform={`translate(160 ${44 + i * 28})`}>
          <rect width="140" height="10" rx="5" fill="#f1f5f9" />
          <rect width={140 * x} height="10" rx="5" fill="#0d9488" />
          <rect x={140 * x} width={140 * y} height="10" fill="#94a3b8" />
          <rect x={140 * (x + y)} width={140 * z} height="10" rx="3" fill="#0f172a" />
        </g>
      ))}
    </svg>
  );
}

/** Vorschaubild des Gremiennetzes: gerichtete Pfeile von Einstiegs-Gremien zu einem Entscheidungs-Gremium */
function NetThumb() {
  const nodes: [number, number, number, string, string][] = [[40, 36, 9, "#cbd5e1", "#94a3b8"], [40, 80, 11, "#cbd5e1", "#94a3b8"], [40, 122, 8, "#cbd5e1", "#94a3b8"], [150, 60, 14, "#cbd5e1", "#94a3b8"], [150, 118, 8, "#5eead4", "#0d9488"], [272, 78, 20, "#0f766e", "#0f766e"]];
  const links: [number, number, number][] = [[0, 3, 2], [1, 3, 3.5], [2, 4, 1.5], [3, 5, 6], [1, 5, 2], [4, 5, 2.5]];
  return (
    <svg viewBox="0 0 320 156" role="img" aria-label="Vorschau des Gremiennetzes: Pfeile von Ausschüssen zum Rat" className="block h-auto w-full rounded-[18px] border border-slate-200 bg-white">
      <defs><marker id="nt" viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" orient="auto"><path d="M0 1L9 5L0 9z" fill="#64748b" /></marker></defs>
      {links.map(([a, b, w]) => {
        const A = nodes[a], B = nodes[b], dx = B[0] - A[0], dy = B[1] - A[1], d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
        return <path key={`${a}${b}`} d={`M${A[0] + ux * A[2]},${A[1] + uy * A[2]} Q${(A[0] + B[0]) / 2 - uy * d * 0.12},${(A[1] + B[1]) / 2 + ux * d * 0.12} ${B[0] - ux * (B[2] + 4)},${B[1] - uy * (B[2] + 4)}`} fill="none" stroke="#94a3b8" strokeOpacity=".7" strokeWidth={w} strokeLinecap="round" markerEnd="url(#nt)" />;
      })}
      {nodes.map(([x, y, r, f, st], i) => <circle key={i} cx={x} cy={y} r={r} fill={f} stroke={st} strokeWidth="2" />)}
    </svg>
  );
}

/** Vorschaubilder je Analyse (auch auf den Branchenseiten) */
export const ANALYSE_THUMBS = {
  diffusion: DiffusionThumb,
  graph: GraphThumb,
  trends: TrendThumb,
  vergleich: CompareThumb,
  beschluesse: DecisionThumb,
  gremien: NetThumb,
};

/* Beispielbegriff der Vorschauen; Daten kommen aus dem Schnappschuss (scripts/build-branchen-ausschnitte.mjs) */
const BEISPIEL = "Photovoltaik";
/* Der Gebietsvergleich hat im Schnappschuss ein eigenes Beispiel: zwei Orte statt eines Begriffs */
const VERGLEICH_BEISPIEL = "Köln und Dortmund";

const ANALYSEN_KARTEN: { id: AnalyseId; name: string; href: string; kurz: string }[] = [
  { id: "diffusion", name: "Diffusionsanalyse", href: "/analytics/diffusion", kurz: "Wer zuerst dran war, wie schnell andere folgten und wo ein Thema noch fehlt." },
  { id: "graph", name: "Knowledge Graph", href: "/analytics/graph", kurz: "Womit ein Thema zusammenhängt: verwandte Begriffe als Netz zum Anklicken." },
  { id: "trends", name: "Trends und Frühindikatoren", href: "/analytics/trends", kurz: "Welche Begriffe gerade aufkommen, zunehmen oder verschwinden." },
  { id: "vergleich", name: "Gebietsvergleich", href: "/analytics/vergleich", kurz: "Zwei Orte nebeneinander: Themen, Verlauf und typische Begriffe." },
  { id: "beschluesse", name: "Beschlüsse", href: "/analytics/beschluesse", kurz: "Wie Gremien entscheiden: Beschlussquote, Vertagungen und Dauer." },
  { id: "gremien", name: "Gremiennetz", href: "/analytics/gremien", kurz: "Welchen Weg Vorgänge durch die Gremien nehmen und wo sie entschieden werden." },
];

const METHODIK: Record<AnalyseId, ReactNode> = {
  diffusion: (
    <>
      <p className="mt-3 text-[16px] text-slate-500">Zeigt, wie sich ein Thema über die Gebiete ausbreitet: wer zuerst dran war, wie schnell andere folgten und wo es noch fehlt. Als Zeitraffer auf der Karte, mit den gleichen Suchen und Filtern wie auf der Startseite.</p>
      <p className="mt-3 text-[14px] leading-relaxed text-slate-700">Die Analyse folgt der Diffusionsforschung (Rogers, „Diffusion of Innovations“, 1962; Hägerstrand zur räumlichen Ausbreitung, 1967): Neuerungen breiten sich in der Regel in einer S-Kurve aus, erst langsam bei wenigen Vorreitern, dann schnell, dann abflachend. Für Politik beschreibt die Policy-Diffusion (Walker 1969; Shipan und Volden 2008), dass Kommunen voneinander lernen, einander nachahmen oder unter Wettbewerbsdruck stehen. Als Zeitpunkt der Übernahme gilt hier die erste Erwähnung des Themas in einem Eintrag des Gebiets. Daraus entstehen die Kurve der erreichten Gebiete, die Zeit von 10 % bis 90 % Verbreitung als Maß für das Tempo sowie die Rangfolge der Vorreiter.</p>
          <p className="mt-3 text-[14px] text-slate-500">Grenzen: Die erste Erwähnung ist ein Indikator, keine Entscheidung. Gebiete mit unvollständigem Datenbestand erscheinen womöglich zu spät.</p>
    </>
  ),
  graph: (
    <>
      <p className="mt-3 text-[16px] text-slate-500">Zeigt, womit ein Thema zusammenhängt: verwandte Begriffe und Themenfelder als Netz. Knoten lassen sich ziehen und anklicken, mit denselben Suchen und Filtern wie auf der Startseite.</p>
      <p className="mt-3 text-[14px] leading-relaxed text-slate-700">Ein Wissensgraph beschreibt Dinge als Knoten und ihre Beziehungen als Kanten (Hogan et al., „Knowledge Graphs“, 2021). Hier entsteht er aus den Einträgen, die zur Suche passen: Zwei Dinge sind verbunden, wenn sie im selben Eintrag vorkommen (Ko-Okkurrenz; Newman, „Networks“, 2018). Das Gewicht einer Verbindung ist der Jaccard-Index (Jaccard 1912), also der Anteil gemeinsamer Einträge an allen Einträgen beider Seiten. Begriffe aus den Titeln werden nach ihrer Besonderheit gewichtet: häufig in der Auswahl, aber selten im ganzen Bestand (Inverse Document Frequency, Spärck Jones 1972), damit Füllwörter nicht das Bild bestimmen. Die Anordnung folgt einem Kräftemodell (Fruchterman und Reingold 1991): Verbundene Knoten ziehen sich an, alle stoßen sich ab.</p>
          <p className="mt-3 text-[14px] text-slate-500">Grenzen: Eine Verbindung bedeutet gemeinsames Vorkommen, keine Ursache. Begriffe stammen aus Titeln, nicht aus dem vollen Text. Ausgewertet werden höchstens die jüngsten 3.000 passenden Einträge.</p>
    </>
  ),
  trends: (
    <>
      <p className="mt-3 text-[16px] text-slate-500">Zeigt, welche Begriffe gerade aufkommen, zunehmen oder verschwinden: der aktuelle Zeitraum im Vergleich zum Zeitraum davor, als Trendkarte, Rangliste mit Verlaufskurven und Themenfeld-Veränderung. Mit denselben Suchen und Filtern wie auf der Startseite.</p>
      <p className="mt-3 text-[14px] leading-relaxed text-slate-700">Trenderkennung in Textströmen sucht Begriffe, deren Häufigkeit plötzlich ansteigt („Bursts“; Kleinberg, „Bursty and Hierarchical Structure in Streams“, 2002). Hier werden zwei gleich lange Zeitfenster verglichen, die letzten Tage und die Tage davor. Verglichen werden Anteile an allen Einträgen und nicht Rohzahlen, damit mehr oder weniger Einträge insgesamt das Bild nicht verfälschen. Ob ein Unterschied über Zufall hinausgeht, prüft ein Zwei-Stichproben-Test für Anteile; für seltene Begriffe in Textdaten ist das Log-Likelihood-Verfahren üblich (Dunning, „Accurate Methods for the Statistics of Surprise and Coincidence“, 1993). Als Frühindikator gilt ein Begriff, der davor kaum vorkam und jetzt in mehreren Gebieten auftaucht: Breite ist ein stärkeres Signal als bloße Menge. Gleichmäßige Stichproben halten die Abfrage auch bei Millionen Einträgen schnell.</p>
          <p className="mt-3 text-[14px] text-slate-500">Grenzen: Ein Trend ist ein Hinweis, keine Entscheidung. Begriffe stammen aus Titeln. Saisonale Muster (zum Beispiel Haushaltsberatungen im Herbst) erscheinen als Trend, weil der Vorjahreszeitraum im Bestand fehlt. Je Zeitraum werden höchstens rund 12.000 Einträge ausgewertet.</p>
    </>
  ),
  vergleich: (
    <>
      <p className="mt-3 text-[16px] text-slate-500">Stellt zwei Orte nebeneinander: Themenprofil, Stand der Vorlagen, Verlauf, aktivste Gremien sowie typische und gemeinsame Begriffe. Als Maßstab dienen alle Gebiete. Mit denselben Suchen und Filtern wie auf der Startseite.</p>
      <p className="mt-3 text-[14px] leading-relaxed text-slate-700">Der Vergleich folgt dem Benchmarking: Ein Ort wird nicht für sich, sondern an einem Maßstab gemessen, hier an allen Gebieten mit denselben Filtern. Das Themenprofil zeigt die Anteile der Themenfelder, ähnlich einem Standortquotienten aus der Regionalökonomie (Anteil im Ort geteilt durch Anteil im Maßstab). Typisch für einen Ort sind Begriffe, die dort deutlich häufiger vorkommen als im Maßstab; ob der Unterschied über den Zufall hinausgeht, prüft ein Zwei-Stichproben-Test für Anteile, bei Wortdaten gebräuchlich als Log-Likelihood-Verfahren (Dunning, 1993). Einträge je 1.000 Einwohner machen Orte unterschiedlicher Größe vergleichbar.</p>
          <p className="mt-3 text-[14px] text-slate-500">Grenzen: Wie vollständig das Ratsinformationssystem eines Ortes im Bestand erfasst ist, wirkt auf alle Zahlen. Die Einträge je Einwohner sind deshalb ein Anhaltspunkt, kein Maß für politische Aktivität. Themenprofil, Vorlagenstand und Begriffe stammen aus einer Stichprobe von höchstens 6.000 Einträgen je Ort.</p>
    </>
  ),
  beschluesse: (
    <>
      <p className="mt-3 text-[16px] text-slate-500">Zeigt, wie Gremien entscheiden: Beschlussquote, Vertagungen und Ablehnungen, wie einig sie sind, wie oft Vorlagen geändert werden und wie lange ein Vorgang bis zum Beschluss braucht. Mit denselben Suchen und Filtern wie auf der Startseite.</p>
      <p className="mt-3 text-[14px] leading-relaxed text-slate-700">Die Beschlussquote ist der Anteil „beschlossen“ an allen Vorgängen mit Entscheidung (beschlossen, vertagt, abgelehnt). Als Maß für Einigkeit dient der Anteil einstimmiger Beschlüsse; in der Parlamentsforschung gilt die Geschlossenheit von Abstimmungen als Hinweis auf Konfliktlinien (Rice-Index, Rice 1925). Ob und wie ein Beschlussvorschlag geändert wurde, wird aus dem Ergebnistext gelesen („geändert beschlossen“). Die Durchlaufzeit misst die Tage von der ersten Station eines Vorgangs bis zur Entscheidung; Zeiten bis zu einem Ereignis werden üblicherweise mit Überlebenszeitanalysen untersucht (Kaplan und Meier, 1958), die auch noch offene Vorgänge berücksichtigen.</p>
          <p className="mt-3 text-[14px] text-slate-500">Grenzen: Der Status ist nur bei einem Viertel der Einträge bekannt, Ablehnungen sind in den Quellen selten vermerkt. Ausschüsse empfehlen meist nur, ihre Quote ist mit der des Rats nicht direkt vergleichbar. Noch offene Vorgänge fehlen in der Durchlaufzeit, die dadurch eher zu kurz ausfällt, denn die hier verwendete einfache Messung berücksichtigt sie nicht. Abstimmung, Änderungen und Dauer stammen aus einer Stichprobe von höchstens 4.000 Vorgängen.</p>
    </>
  ),
  gremien: (
    <>
      <p className="mt-3 text-[16px] text-slate-500">Zeigt, welchen Weg Vorgänge durch die Gremien nehmen: wo sie beginnen, welche Gremien dazwischen liegen, wo sie entschieden werden und wie lange ein Übergang dauert. Als Netz mit Pfeilen, mit denselben Suchen und Filtern wie auf der Startseite.</p>
      <p className="mt-3 text-[14px] leading-relaxed text-slate-700">Die Beratungswege bilden ein gerichtetes Netz: Gremien sind Knoten, ein Pfeil bedeutet, dass Vorgänge von einem Gremium an das nächste gingen (Newman, „Networks“, 2018). Aus der Zahl eingehender und ausgehender Pfeile ergibt sich die Rolle: Einstieg (überwiegend ausgehend), Entscheidung (überwiegend eingehend) und Durchgang. Der Durchsatz ist eine einfache Form der Zentralität; wer viele Wege verbindet, hat eine Brückenstellung (Freeman, „A Set of Measures of Centrality Based on Betweenness“, 1977). Die Anordnung von links nach rechts folgt der mittleren Stufe im Beratungsweg, ähnlich einer geschichteten Zeichnung hierarchischer Systeme (Sugiyama et al., 1981). Ohne einzelnen Ort werden Gremien nach ihrer Art zusammengefasst, weil jeder Ort seine eigenen Namen hat.</p>
          <p className="mt-3 text-[14px] text-slate-500">Grenzen: Nur Vorgänge mit Stationen in mindestens zwei verschiedenen Gremien tragen bei, das ist ein kleiner Teil. Wie vollständig die Stationen erfasst sind, hängt vom Ratsinformationssystem des Ortes ab. Die Gremienart wird aus dem Namen abgeleitet und kann im Einzelfall danebenliegen. Ausgewertet werden höchstens rund 10.000 Vorgänge.</p>
    </>
  ),
};

export function AnalyticsAbout() {
  return (
    <main id="inhalt" className="w-full px-[max(1vw,16px)] pb-16 text-slate-900">
      <PageBand>
        <div className="grid items-center gap-10 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] xl:gap-16">
          <div>
            <p className="m-0 text-[14px] text-slate-500">plenara.X</p>
            <span aria-hidden="true" className="mt-3 block max-sm:hidden"><AnalyticsLogo size={56} /></span>
            <span aria-hidden="true" className="mt-3 hidden max-sm:block"><AnalyticsLogo size={40} /></span>
            <h1 className="mt-6 max-w-[16ch] text-[28px] font-semibold leading-[1.1] sm:text-[44px]">Besser verstehen, was vor Ort beraten wird.</h1>
            <p className="mt-5 max-w-[560px] text-[18px] text-slate-500">Analysen auf dem gesamten Datenbestand der Räte, bei jeder Abfrage frisch berechnet.</p>
            <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
              <Link href="/analytics/diffusion" className="inline-flex h-12 items-center gap-2 rounded-full bg-slate-900 px-7 text-[16px] font-medium text-white transition-opacity after:content-['→'] hover:opacity-85">Analyse starten</Link>
              <a href="#analysen" className="text-[16px] font-medium text-teal-600">Alle Analysen ↓</a>
            </div>
          </div>
          <Link href="/analytics/diffusion" aria-label="Diffusionsanalyse öffnen" className="hidden xl:block xl:w-full xl:max-w-[560px] xl:justify-self-end"><LiveThumb id="diffusion" term={BEISPIEL} /></Link>
        </div>
      </PageBand>

      <h2 id="analysen" className="mt-14 scroll-mt-24 text-[28px] font-semibold">Analysen</h2>
      <ul className="m-0 mt-8 grid list-none gap-x-10 gap-y-14 p-0 sm:grid-cols-2 xl:grid-cols-3">
        {ANALYSEN_KARTEN.map((a, i) => (
          <li key={a.id}>
            <Reveal delay={(i % 3) * 90}>
              <Link href={a.href} aria-label={`${a.name} öffnen`} className="group block">
                <div className="overflow-hidden rounded-[18px] transition-transform duration-300 group-hover:-translate-y-1"><LiveThumb id={a.id} term={a.id === "vergleich" ? VERGLEICH_BEISPIEL : BEISPIEL} /></div>
                <h3 className="mt-5 text-[22px] font-semibold">{a.name}</h3>
                <p className="mt-2 text-[16px] text-slate-500">{a.kurz}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-[16px] font-medium text-teal-600">Öffnen <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span></span>
              </Link>
            </Reveal>
          </li>
        ))}
      </ul>
      <p className="mt-10 text-[14px] text-slate-500">Weitere Analysen sind in Planung.</p>

      <h2 id="methodik" className="mt-16 scroll-mt-24 text-[28px] font-semibold">Methodik</h2>
      <p className="mt-2 max-w-[680px] text-[16px] text-slate-500">Was jede Analyse zeigt, worauf sie beruht und wo ihre Grenzen liegen.</p>
      <div className="mt-6 max-w-[900px] border-t border-slate-200">
        {ANALYSEN_KARTEN.map((a) => (
          <details key={a.id} className="group border-b border-slate-200">
            <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-[18px] font-semibold [&::-webkit-details-marker]:hidden">
              {a.name}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform group-open:rotate-180"><path d="m6 9 6 6 6-6" /></svg>
            </summary>
            <div className="pb-6">{METHODIK[a.id]}</div>
          </details>
        ))}
      </div>
    </main>
  );
}
