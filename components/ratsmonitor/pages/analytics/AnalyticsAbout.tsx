import { useState } from "react";
import type { ReactNode } from "react";
import { type AnalyseId } from "../../info/branchen-enterprise";
import { RADAR_THUMBS } from "./RadarThumbs";

/** Vorschaubild der Ausbreitung: Wellen von Punkten um einen Ursprung und die S-Kurve */
function DiffusionThumb() {
  const dots = Array.from({ length: 70 }, (_, i) => {
    const a = i * 2.399963, r = 5 + Math.sqrt(i) * 8.6;
    return { x: Math.round((98 + Math.cos(a) * r * 1.1) * 100) / 100, y: Math.round((78 + Math.sin(a) * r * 0.9) * 100) / 100, age: i / 70 };
  });
  const shade = (t: number) => (t < 0.25 ? "var(--rm-ac)" : t < 0.5 ? "var(--rm-map3)" : t < 0.75 ? "var(--rm-map2)" : "var(--rm-c200)");
  return (
    <svg viewBox="0 0 320 156" role="img" aria-label="Vorschau der Ausbreitung: Punkte breiten sich wellenförmig aus, daneben eine S-Kurve" className="block h-auto w-full rounded-[18px] border border-slate-200 bg-white">
      {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={3.2 + (1 - d.age) * 1.2} fill={shade(d.age)} />)}
      <path d="M190 126 C 212 124, 224 120, 238 100 S 262 44, 304 34" fill="none" stroke="var(--rm-fill)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M190 126H304" stroke="var(--rm-c200)" />
    </svg>
  );
}

/** Vorschaubild des Themennetzes: ein Netz aus Knoten um einen Mittelpunkt */
function GraphThumb() {
  const hub: [number, number] = [160, 78];
  const ring: [number, number, number, string][] = [
    [96, 40, 7, "var(--rm-fill)"], [128, 24, 5, "var(--rm-fill)"], [200, 30, 8, "var(--rm-fill)"], [236, 62, 6, "var(--rm-fill)"], [232, 112, 7, "var(--rm-fill)"],
    [190, 134, 5, "var(--rm-fill)"], [124, 130, 8, "var(--rm-fill)"], [82, 102, 6, "var(--rm-fill)"], [60, 66, 4, "var(--rm-c400)"], [268, 36, 5, "var(--rm-c900)"], [270, 90, 4, "var(--rm-c400)"],
  ];
  const cross: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [0, 8], [3, 9], [4, 10], [2, 9], [6, 4]];
  return (
    <svg viewBox="0 0 320 156" role="img" aria-label="Vorschau des Themennetzes: Knoten um einen Suchbegriff, durch Linien verbunden" className="block h-auto w-full rounded-[18px] border border-slate-200 bg-white">
      {ring.map(([x, y], i) => <line key={`h${i}`} x1={hub[0]} y1={hub[1]} x2={x} y2={y} stroke="var(--rm-c400)" strokeOpacity=".25" />)}
      {cross.map(([a, b]) => <line key={`${a}-${b}`} x1={ring[a][0]} y1={ring[a][1]} x2={ring[b][0]} y2={ring[b][1]} stroke="var(--rm-c400)" strokeOpacity=".55" strokeWidth="1.4" />)}
      {ring.map(([x, y, r, c], i) => <circle key={i} cx={x} cy={y} r={r} fill={c} fillOpacity=".9" />)}
      <circle cx={hub[0]} cy={hub[1]} r="14" fill="var(--rm-ac)" />
      <rect x={hub[0] - 4.5} y={hub[1] - 4.5} width="9" height="9" fill="#fff" />
    </svg>
  );
}

/** Vorschaubild der Trends: Streudiagramm der Begriffe mit Aufsteigern oben links */
function TrendThumb() {
  const dots: [number, number, number, string][] = [
    [40, 28, 6, "var(--rm-ac)"], [62, 36, 5, "var(--rm-fill)"], [82, 30, 7, "var(--rm-fill)"], [108, 52, 8, "var(--rm-fill)"], [150, 62, 6, "var(--rm-c300)"], [176, 76, 9, "var(--rm-c300)"],
    [196, 70, 7, "var(--rm-c300)"], [220, 80, 10, "var(--rm-c300)"], [244, 74, 6, "var(--rm-c300)"], [270, 84, 7, "var(--rm-c300)"], [136, 98, 6, "var(--rm-c400)"], [96, 118, 5, "var(--rm-c400)"], [200, 112, 7, "var(--rm-c400)"], [60, 126, 4, "var(--rm-c400)"],
  ];
  return (
    <svg viewBox="0 0 320 156" role="img" aria-label="Vorschau der Trendkarte: Begriffe als Punkte, Aufsteiger oben links, Absteiger unten" className="block h-auto w-full rounded-[18px] border border-slate-200 bg-white">
      <line x1="16" x2="304" y1="82" y2="82" stroke="var(--rm-c400)" strokeOpacity=".6" />
      <line x1="16" x2="304" y1="42" y2="42" stroke="var(--rm-c200)" strokeDasharray="3 4" />
      <line x1="16" x2="304" y1="122" y2="122" stroke="var(--rm-c200)" strokeDasharray="3 4" />
      {dots.map(([x, y, r, c]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={c} fillOpacity=".85" />)}
    </svg>
  );
}

/** Vorschaubild des Vergleichs: Schmetterlingsdiagramm, links ein Ort, rechts der andere, in der Mitte die Themen */
function CompareThumb() {
  const rows: [number, number][] = [[96, 40], [64, 88], [44, 52], [78, 24], [30, 70]];
  return (
    <svg viewBox="0 0 320 156" role="img" aria-label="Vorschau des Vergleichs: Balken zweier Orte gegenüber, links der eine, rechts der andere" className="block h-auto w-full rounded-[18px] border border-slate-200 bg-white">
      <line x1="160" x2="160" y1="16" y2="140" stroke="var(--rm-c300)" />
      <circle cx="40" cy="18" r="4" fill="var(--rm-fill)" /><circle cx="280" cy="18" r="4" fill="var(--rm-c900)" />
      {rows.map(([l, r], i) => (
        <g key={i} transform={`translate(0 ${34 + i * 22})`}>
          <rect x={160 - l} width={l - 4} height="12" rx="3" fill="var(--rm-fill)" fillOpacity=".9" />
          <rect x="164" width={r} height="12" rx="3" fill="var(--rm-c900)" fillOpacity=".85" />
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
        <circle r="38" fill="none" stroke="var(--rm-fill)" strokeWidth="14" strokeDasharray={`${a} ${C}`} />
        <circle r="38" fill="none" stroke="var(--rm-c400)" strokeWidth="14" strokeDasharray={`${p} ${C}`} strokeDashoffset={-a} />
        <circle r="38" fill="none" stroke="var(--rm-c900)" strokeWidth="14" strokeDasharray={`${r} ${C}`} strokeDashoffset={-(a + p)} />
      </g>
      <text x="86" y="85" textAnchor="middle" fontSize="20" fontWeight="600" fill="var(--rm-c900)">91 %</text>
      {bars.map(([x, y, z], i) => (
        <g key={i} transform={`translate(160 ${44 + i * 28})`}>
          <rect width="140" height="10" rx="5" fill="var(--rm-c100)" />
          <rect width={140 * x} height="10" rx="5" fill="var(--rm-fill)" />
          <rect x={140 * x} width={140 * y} height="10" fill="var(--rm-c400)" />
          <rect x={140 * (x + y)} width={140 * z} height="10" rx="3" fill="var(--rm-c900)" />
        </g>
      ))}
    </svg>
  );
}

/** Vorschaubild der Gremien: gerichtete Pfeile von Einstiegs-Gremien zu einem Entscheidungs-Gremium */
function NetThumb() {
  const nodes: [number, number, number, string, string][] = [[40, 36, 9, "var(--rm-c300)", "var(--rm-c400)"], [40, 80, 11, "var(--rm-c300)", "var(--rm-c400)"], [40, 122, 8, "var(--rm-c300)", "var(--rm-c400)"], [150, 60, 14, "var(--rm-c300)", "var(--rm-c400)"], [150, 118, 8, "var(--color-teal-300)", "var(--rm-fill)"], [272, 78, 20, "var(--rm-ac)", "var(--rm-ac)"]];
  const links: [number, number, number][] = [[0, 3, 2], [1, 3, 3.5], [2, 4, 1.5], [3, 5, 6], [1, 5, 2], [4, 5, 2.5]];
  return (
    <svg viewBox="0 0 320 156" role="img" aria-label="Vorschau der Gremien: Pfeile von Ausschüssen zum Rat" className="block h-auto w-full rounded-[18px] border border-slate-200 bg-white">
      <defs><marker id="nt" viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" orient="auto"><path d="M0 1L9 5L0 9z" fill="var(--rm-c500)" /></marker></defs>
      {links.map(([a, b, w]) => {
        const A = nodes[a], B = nodes[b], dx = B[0] - A[0], dy = B[1] - A[1], d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
        return <path key={`${a}${b}`} d={`M${A[0] + ux * A[2]},${A[1] + uy * A[2]} Q${(A[0] + B[0]) / 2 - uy * d * 0.12},${(A[1] + B[1]) / 2 + ux * d * 0.12} ${B[0] - ux * (B[2] + 4)},${B[1] - uy * (B[2] + 4)}`} fill="none" stroke="var(--rm-c400)" strokeOpacity=".7" strokeWidth={w} strokeLinecap="round" markerEnd="url(#nt)" />;
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
  ...RADAR_THUMBS,
};

const METHODIK: Partial<Record<AnalyseId, ReactNode>> = {
  diffusion: (
    <>
      <p className="mt-3 text-[16px] text-slate-500">Zeigt, wie sich ein Thema über die Gebiete ausbreitet: wer zuerst dran war, wie schnell andere folgten und wo es noch fehlt.</p>
      <p className="mt-3 text-[14px] leading-relaxed text-slate-700">Als Zeitpunkt der Übernahme gilt die erste Erwähnung des Themas in einem Eintrag des Gebiets. Daraus entstehen die Kurve der erreichten Gebiete, die Zeit von 10 % bis 90 % Verbreitung als Maß für das Tempo und die ersten Gebiete. Steht ein Thema schon in den ersten 14 Tagen des Bestands eines Gebiets, gilt es als „von Anfang an da“. Berichte eines Gemeindeverbands zählen bei der Mitgliedsgemeinde, die der Titel nennt oder deren Rat berät, sonst beim Verband.</p>
      <p className="mt-3 text-[14px] text-slate-500">Grenzen: Die erste Erwähnung ist ein Indikator, keine Entscheidung. Gebiete mit unvollständigem Datenbestand erscheinen womöglich zu spät.</p>
    </>
  ),
  graph: (
    <>
      <p className="mt-3 text-[16px] text-slate-500">Zeigt, womit ein Thema zusammenhängt: verwandte Begriffe und Themenfelder als Netz. Knoten lassen sich ziehen und anklicken.</p>
      <p className="mt-3 text-[14px] leading-relaxed text-slate-700">Zwei Begriffe sind verbunden, wenn sie im selben Eintrag vorkommen; das Gewicht ist der Anteil gemeinsamer Einträge an allen Einträgen beider Seiten. Begriffe, die in der Auswahl häufig, im ganzen Bestand aber selten sind, zählen stärker, damit Füllwörter das Bild nicht bestimmen.</p>
      <p className="mt-3 text-[14px] text-slate-500">Grenzen: Eine Verbindung bedeutet gemeinsames Vorkommen, keine Ursache. Begriffe stammen aus Titeln. Ausgewertet werden höchstens die jüngsten 3.000 passenden Einträge.</p>
    </>
  ),
  trends: (
    <>
      <p className="mt-3 text-[16px] text-slate-500">Zeigt, welche Begriffe gerade aufkommen, zunehmen oder verschwinden: der aktuelle Zeitraum im Vergleich zum Zeitraum davor.</p>
      <p className="mt-3 text-[14px] leading-relaxed text-slate-700">Verglichen werden zwei gleich lange Zeitfenster, und zwar Anteile an allen Einträgen statt Rohzahlen. Ein Test prüft, ob der Unterschied über Zufall hinausgeht. Als Frühindikator gilt ein Begriff, der davor kaum vorkam und jetzt in mehreren Gebieten auftaucht.</p>
      <p className="mt-3 text-[14px] text-slate-500">Grenzen: Ein Trend ist ein Hinweis, keine Entscheidung. Saisonale Muster (etwa Haushaltsberatungen im Herbst) erscheinen als Trend, weil der Vorjahreszeitraum fehlt. Je Zeitraum werden höchstens rund 12.000 Einträge ausgewertet.</p>
    </>
  ),
  vergleich: (
    <>
      <p className="mt-3 text-[16px] text-slate-500">Stellt zwei Orte nebeneinander: Themenprofil, Stand der Vorlagen, Verlauf, aktivste Gremien sowie typische und gemeinsame Begriffe. Maßstab sind alle Gebiete.</p>
      <p className="mt-3 text-[14px] leading-relaxed text-slate-700">Das Themenprofil zeigt den Anteil im Ort geteilt durch den Anteil im Maßstab. Typisch sind Begriffe, die im Ort deutlich häufiger vorkommen als im Maßstab. Einträge je 1.000 Einwohner machen Orte unterschiedlicher Größe vergleichbar.</p>
      <p className="mt-3 text-[14px] text-slate-500">Grenzen: Wie vollständig ein Ort erfasst ist, wirkt auf alle Zahlen; Einträge je Einwohner sind kein Maß für politische Aktivität. Grundlage ist eine Stichprobe von höchstens 6.000 Einträgen je Ort.</p>
    </>
  ),
  beschluesse: (
    <>
      <p className="mt-3 text-[16px] text-slate-500">Zeigt, wie Gremien entscheiden: Beschlussquote, Vertagungen und Ablehnungen, Einigkeit, Änderungen und Dauer bis zum Beschluss.</p>
      <p className="mt-3 text-[14px] leading-relaxed text-slate-700">Die Beschlussquote ist der Anteil „beschlossen“ an allen Vorgängen mit Entscheidung (beschlossen, vertagt, abgelehnt). Einigkeit ist der Anteil einstimmiger Beschlüsse. Änderungen werden aus dem Ergebnistext gelesen („geändert beschlossen“), die Durchlaufzeit läuft von der ersten Station bis zur Entscheidung.</p>
      <p className="mt-3 text-[14px] text-slate-500">Grenzen: Der Status ist nur bei gut einem Drittel der Einträge bekannt, Ablehnungen sind selten vermerkt. Ausschüsse empfehlen meist nur, ihre Quote ist nicht mit der des Rats vergleichbar. Offene Vorgänge fehlen in der Durchlaufzeit. Grundlage sind höchstens 4.000 Vorgänge.</p>
    </>
  ),
  gremien: (
    <>
      <p className="mt-3 text-[16px] text-slate-500">Zeigt, welchen Weg Vorgänge durch die Gremien nehmen: wo sie beginnen, wo sie entschieden werden und wie lange ein Übergang dauert.</p>
      <p className="mt-3 text-[14px] leading-relaxed text-slate-700">Gremien sind Knoten, ein Pfeil heißt: Vorgänge gingen von einem Gremium an das nächste. Aus eingehenden und ausgehenden Pfeilen ergibt sich die Rolle: Einstieg, Entscheidung oder Durchgang. Ohne einzelnen Ort werden Gremien nach ihrer Art zusammengefasst.</p>
      <p className="mt-3 text-[14px] text-slate-500">Grenzen: Nur Vorgänge mit Stationen in mindestens zwei Gremien tragen bei, das ist ein kleiner Teil. Die Gremienart wird aus dem Namen abgeleitet. Ausgewertet werden höchstens rund 10.000 Vorgänge.</p>
    </>
  ),
  fraktionen: (
    <>
      <p className="mt-3 text-[16px] text-slate-500">Zeigt, welche Fraktionen Anträge und Anfragen stellen, zu welchen Themenfeldern, und was aus ihren Anträgen wird.</p>
      <p className="mt-3 text-[14px] leading-relaxed text-slate-700">Die Fraktion wird aus Titel oder Textanfang des Hauptdokuments gelesen („Antrag der SPD-Fraktion“); gemeinsame Anträge zählen bei jeder Fraktion. „Angenommen“ ist der Anteil beschlossener Anträge an denen mit Entscheidung; empfiehlt der Beschlussvorschlag, nicht zu folgen, zählt ein Beschluss als Ablehnung. Derselbe Antrag in Ausschuss und Rat zählt einmal, Anfragen und Besetzungen zählen nicht.</p>
      <p className="mt-3 text-[14px] text-slate-500">Grenzen: Erkannt wird nur, was ausdrücklich als Antrag einer Fraktion dasteht. Der Status ist nur bei einem Teil bekannt; die Quote bewertet keine Partei.</p>
    </>
  ),
  signale: (
    <>
      <p className="mt-3 text-[16px] text-slate-500">Zeigt einzelne Vorhaben, die gerade entstehen, in 10 Kategorien: Wohnbaugebiete, Gewerbeflächen, Windenergie, Solarenergie, Wärme, Schulen und Kitas, Straßen, Wasser, Breitband und Mobilität. Aufträge und Vergaben stehen auf der eigenen Seite Ausschreibungen.</p>
      <p className="mt-3 text-[14px] leading-relaxed text-slate-700">Jede Kategorie hat eine feste Regel, die Titel, Betreff und Beschlussvorschlag liest. Gezählt werden Vorgänge wie im Atlas. „Erstmals hier“ heißt: Im Gebiet gab es vorher keinen Vorgang dieser Kategorie, und es liegen mindestens 12 Monate Daten davor vor. Eine Kategorie wird erst freigegeben, wenn eine Stichprobe mindestens 90 % richtig zugeordnete Vorgänge ergibt.</p>
      <p className="mt-3 text-[14px] text-slate-500">Grenzen: Erkannt wird über Wörter; was weder im Titel noch im Beschlussvorschlag steht, wird nicht gefunden. „Erstmals hier“ ist selten, solange viele Gebiete erst kurz erfasst sind.</p>
    </>
  ),
  ausschreibungen: (
    <>
      <p className="mt-3 text-[16px] text-slate-500">Zeigt, welche Aufträge Kommunen in den Räten ausschreiben, vergeben oder nachbewilligen, nach Leistung (Hochbau, Tiefbau, Wasser, Planung, IT, Fahrzeuge und Ausstattung, Sonstiges) und Schritt (Ausschreibung, Vergabe, Nachtrag).</p>
      <p className="mt-3 text-[14px] leading-relaxed text-slate-700">Die Regel liest den Titel der Vorlage. Gezählt werden Vorgänge wie im Atlas. Ein Auftrag kann zugleich in einer Fachkategorie der Signale stehen, etwa eine Kanalsanierung in Wasser; die Zahlen beider Seiten werden nicht addiert.</p>
      <p className="mt-3 text-[14px] text-slate-500">Grenzen: Gezeigt wird der Beschluss des Rats, nicht die Bekanntmachung: keine Angebotsfrist, keine Verfahrensart, keine Unterlagen. Viele kleinere Aufträge werden nicht öffentlich ausgeschrieben und erscheinen erst mit ihrem Beschluss. Gelesen wird über Wörter im Titel.</p>
    </>
  ),
  fakten: (
    <>
      <p className="mt-3 text-[16px] text-slate-500">Zeigt Werte aus den Vorlagen der Räte je Gemeinde auf der Karte, rot bis grün: derzeit Hebesätze, Haushalt je Einwohner, Wasser- und Abwassergebühren, Jahresergebnis und Preise für Gewerbegrundstücke.</p>
      <p className="mt-3 text-[14px] leading-relaxed text-slate-700">Gelesen werden nur ausdrücklich genannte Werte, mit festen Regeln und ohne KI; empfohlene, geschätzte, Vergleichs- und Höchstwerte nicht. Je Gemeinde zählt der jüngste Wert, daneben der vorige. Die Farbe folgt der Richtung des Werts. „Üblich“ ist die mittlere Hälfte aller Gemeinden mit Wert. Ein Wert erscheint nur, wenn eine Stichprobe mindestens 90 % richtig gelesene Werte ergab.</p>
      <p className="mt-3 text-[14px] text-slate-500">Grenzen: Es gibt nur Werte aus gespeicherten Vorlagen; fehlt eine Gemeinde, hat sie den Wert nicht beraten oder die Vorlage war nicht lesbar. Ein Wert kann veraltet sein.</p>
    </>
  ),
  atlas: (
    <>
      <p className="mt-3 text-[16px] text-slate-500">Zeigt, worüber die Räte beraten, nach den 10 Themen der Suche: Unterthemen, was geschieht, Verlauf je Monat, einen Ort im Vergleich und die Vorgänge hinter jeder Zahl.</p>
      <p className="mt-3 text-[14px] leading-relaxed text-slate-700">Gezählt werden Vorgänge: Derselbe Titel in mehreren Gremien eines Gebiets ist einer und zählt im Monat seiner letzten Sitzung. Formalien, Sammelpunkte, Besetzungen, Wahlen und Fragestunden zählen nicht. Das Thema ist dasselbe wie im Themenfilter der Suche. „Was geschieht“ wird nach festem Leitfaden aus dem Titel gelesen. Die Zahlen werden täglich neu berechnet. In Stichproben waren Thema zu 91 bis 100 %, Unterthemen zu 88 bis 93 % und „Was geschieht“ zu 86 bis 90 % richtig; Werte aus den Unterlagen erscheinen erst ab 90 %.</p>
      <p className="mt-3 text-[14px] leading-relaxed text-slate-700">Ort im Vergleich: Gezeigt wird der Anteil jedes Unterthemas an den Sachvorgängen des Rats in den letzten 12 Monaten, gegen Gebiete gleicher Art und Größe. „Mehr“ oder „weniger“ steht nur ab 5 Vorgängen und wenn der Anteil außerhalb der mittleren Hälfte der Vergleichsgruppe liegt. Eingeordnet werden nur Räte mit mindestens 100 Sachvorgängen in 9 Monaten.</p>
      <p className="mt-3 text-[14px] text-slate-500">Grenzen: Erkannt wird über Wörter; ein Vorgang ohne passendes Wort bleibt „Sonstiges“. Der Status ist nur bei einem Teil bekannt.</p>
    </>
  ),
  news: (
    <>
      <p className="mt-3 text-[16px] text-slate-500">Zeigt, was in den Räten gerade berichtenswert ist: Vorgänge der letzten 30 und der nächsten 10 Tage, nach Nachrichtenwert geordnet.</p>
      <p className="mt-3 text-[14px] leading-relaxed text-slate-700">Der Nachrichtenwert folgt festen Regeln: Konflikt (abgelehnt, vertagt, nur mit Mehrheit beschlossen, Fraktionsanträge), Tragweite (Fördergeld, Kita-Beiträge, Gebühren, Steuern, Bürgerbegehren), Nähe zum Alltag und Aktualität. Der Kern jeder Meldung ist ein wörtliches Zitat aus der Vorlage. Je Gebiet erscheinen höchstens zwei Meldungen.</p>
      <p className="mt-3 text-[14px] text-slate-500">Grenzen: Es wird nichts umformuliert oder bewertet; die Meldung ersetzt keine Recherche. Vorgänge ohne zitierbaren Satz erscheinen nicht.</p>
    </>
  ),
};


/** Methodik einer Analyse (oder mehrerer, etwa Trends und Ausbreitung) für den Info-Knopf im Seitenkopf (XKopf) */
export function MethodikText({ ids, offen = false }: { ids: [AnalyseId, string][]; /** alles zeigen, ohne eigenen Knopf (der umgebende Block klappt aus) */ offen?: boolean }) {
  const da = ids.filter(([id]) => METHODIK[id]);
  /* Kurz: je Analyse nur der erste Absatz (was sie zeigt); „Mehr lesen“ zeigt Grundlage, Messung und Grenzen */
  const [auf, setAlles] = useState(false);
  const alles = offen || auf;
  return (
    <>
      {da.map(([id, name]) => (
        <div key={id} className={alles ? "" : "[&>p:not(:first-of-type)]:hidden"}>
          {da.length > 1 && <h3 className="mt-4 text-[16px] font-semibold first:mt-0">{name}</h3>}
          {METHODIK[id]}
        </div>
      ))}
      {!offen && <button type="button" onClick={() => setAlles(!alles)} aria-expanded={alles} className="mt-2 max-sm:min-h-[44px] text-[14px] font-medium text-teal-700 hover:underline">{alles ? "Weniger" : "Mehr lesen: Grundlage, Messung, Grenzen"}</button>}
    </>
  );
}
