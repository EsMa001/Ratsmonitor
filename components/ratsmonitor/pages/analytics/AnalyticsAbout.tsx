import Link from "next/link";
import { AnalyticsLogo } from "../../components/Brand";

/** Vorschaubild der Diffusionsanalyse: Wellen von Punkten um einen Ursprung und die S-Kurve */
function DiffusionThumb() {
  const dots = Array.from({ length: 70 }, (_, i) => {
    const a = i * 2.399963, r = 5 + Math.sqrt(i) * 8.6;
    return { x: 98 + Math.cos(a) * r * 1.1, y: 78 + Math.sin(a) * r * 0.9, age: i / 70 };
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

/** Vorschaubild des Gebietsvergleichs: zwei Orte als Balkenprofile mit Marke für den Maßstab */
function CompareThumb() {
  const rows: [number, number][] = [[118, 60], [84, 96], [66, 40], [44, 70], [30, 22]];
  return (
    <svg viewBox="0 0 320 156" role="img" aria-label="Vorschau des Gebietsvergleichs: Themenprofile zweier Orte als Balken" className="block h-auto w-full rounded-[18px] border border-slate-200 bg-white">
      {rows.map(([a, b], i) => (
        <g key={i} transform={`translate(24 ${18 + i * 26})`}>
          <rect width="260" height="6" rx="3" fill="#f1f5f9" />
          <rect width={a * 2} height="6" rx="3" fill="#0d9488" />
          <rect y="10" width="260" height="6" rx="3" fill="#f1f5f9" />
          <rect y="10" width={b * 2} height="6" rx="3" fill="#0f172a" />
          <line x1={(a + b) * 0.75} x2={(a + b) * 0.75} y1="-3" y2="19" stroke="#0f172a" strokeOpacity=".6" />
        </g>
      ))}
    </svg>
  );
}

/** Vorschaubild von Status und Beschlüssen: gestapelte Balken und eine Linie der Beschlussquote */
function DecisionThumb() {
  const cols: [number, number, number][] = [[52, 6, 2], [70, 8, 3], [92, 9, 2], [60, 10, 4], [80, 7, 3], [74, 12, 3], [96, 8, 2]];
  return (
    <svg viewBox="0 0 320 156" role="img" aria-label="Vorschau von Status und Beschlüssen: Säulen mit beschlossen, vertagt und abgelehnt, dazu die Beschlussquote als Linie" className="block h-auto w-full rounded-[18px] border border-slate-200 bg-white">
      <line x1="16" x2="304" y1="136" y2="136" stroke="#e2e8f0" />
      {cols.map(([a, p, r], i) => (
        <g key={i} transform={`translate(${26 + i * 40} 136)`}>
          <rect y={-a} width="24" height={a} fill="#0d9488" fillOpacity=".85" />
          <rect y={-a - p} width="24" height={p} fill="#94a3b8" />
          <rect y={-a - p - r} width="24" height={r} fill="#0f172a" />
        </g>
      ))}
      <polyline points="38,40 78,34 118,30 158,44 198,36 238,46 278,32" fill="none" stroke="#0f172a" strokeWidth="2" strokeDasharray="5 4" />
    </svg>
  );
}

export function AnalyticsAbout() {
  return (
    <main id="inhalt" className="w-full px-[max(1vw,16px)] py-12 text-slate-900">
      <p className="text-[14px] text-slate-500">Plenara.X</p>
      <h1 className="mb-6 mt-4"><span className="sr-only">Über Plenara.X</span><span aria-hidden="true" className="block max-sm:hidden"><AnalyticsLogo size={72} /></span><span aria-hidden="true" className="hidden max-sm:block"><AnalyticsLogo size={44} /></span></h1>
      <p className="mt-3 max-w-[680px] text-[18px] text-slate-500">Analysen auf dem gesamten Datenbestand der Räte. Jede Auswertung wird bei der Abfrage frisch aus der Datenbank berechnet; ändert sich der Bestand, ändert sich das Ergebnis.</p>

      <h2 className="mt-14 text-[22px] font-semibold">Funktionen</h2>
      <article className="mt-4 grid items-center gap-8 border-y border-slate-200 py-8 md:grid-cols-[320px_1fr]">
        <Link href="/analytics/diffusion" aria-label="Diffusionsanalyse öffnen"><DiffusionThumb /></Link>
        <div>
          <h3 className="text-[22px] font-semibold">Diffusionsanalyse</h3>
          <p className="mt-2 text-[16px] text-slate-500">Zeigt, wie sich ein Thema über die Gebiete ausbreitet: wer zuerst dran war, wie schnell andere folgten und wo es noch fehlt. Als Zeitraffer auf der Karte, mit den gleichen Suchen und Filtern wie auf der Startseite.</p>
          <details className="group mt-4 border-t border-slate-200 pt-3">
            <summary className="flex cursor-pointer list-none items-center justify-between text-[16px] font-medium text-slate-900 [&::-webkit-details-marker]:hidden">
              Wissenschaftlicher Hintergrund
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform group-open:rotate-180"><path d="m6 9 6 6 6-6" /></svg>
            </summary>
          <p className="mt-3 text-[14px] leading-relaxed text-slate-700">Die Analyse folgt der Diffusionsforschung (Rogers, „Diffusion of Innovations“, 1962; Hägerstrand zur räumlichen Ausbreitung, 1967): Neuerungen breiten sich in der Regel in einer S-Kurve aus, erst langsam bei wenigen Vorreitern, dann schnell, dann abflachend. Für Politik beschreibt die Policy-Diffusion (Walker 1969; Shipan und Volden 2008), dass Kommunen voneinander lernen, einander nachahmen oder unter Wettbewerbsdruck stehen. Als Zeitpunkt der Übernahme gilt hier die erste Erwähnung des Themas in einem Eintrag des Gebiets. Daraus entstehen die Kurve der erreichten Gebiete, die Zeit von 10 % bis 90 % Verbreitung als Maß für das Tempo sowie die Rangfolge der Vorreiter.</p>
          <p className="mt-3 text-[14px] text-slate-500">Grenzen: Die erste Erwähnung ist ein Indikator, keine Entscheidung. Gebiete mit unvollständigem Datenbestand erscheinen womöglich zu spät.</p>
          </details>
          <Link href="/analytics/diffusion" className="mt-5 inline-block text-[16px] font-medium text-teal-600">Diffusionsanalyse öffnen →</Link>
        </div>
      </article>
      <article className="mt-4 grid items-center gap-8 border-y border-slate-200 py-8 md:grid-cols-[320px_1fr]">
        <Link href="/analytics/graph" aria-label="Knowledge Graph öffnen"><GraphThumb /></Link>
        <div>
          <h3 className="text-[22px] font-semibold">Knowledge Graph</h3>
          <p className="mt-2 text-[16px] text-slate-500">Zeigt, womit ein Thema zusammenhängt: verwandte Begriffe, Themenfelder, Gremien und Länder als Netz. Knoten lassen sich ziehen und anklicken, mit denselben Suchen und Filtern wie auf der Startseite.</p>
          <details className="group mt-4 border-t border-slate-200 pt-3">
            <summary className="flex cursor-pointer list-none items-center justify-between text-[16px] font-medium text-slate-900 [&::-webkit-details-marker]:hidden">
              Wissenschaftlicher Hintergrund
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform group-open:rotate-180"><path d="m6 9 6 6 6-6" /></svg>
            </summary>
          <p className="mt-3 text-[14px] leading-relaxed text-slate-700">Ein Wissensgraph beschreibt Dinge als Knoten und ihre Beziehungen als Kanten (Hogan et al., „Knowledge Graphs“, 2021). Hier entsteht er aus den Einträgen, die zur Suche passen: Zwei Dinge sind verbunden, wenn sie im selben Eintrag vorkommen (Ko-Okkurrenz; Newman, „Networks“, 2018). Das Gewicht einer Verbindung ist der Jaccard-Index (Jaccard 1912), also der Anteil gemeinsamer Einträge an allen Einträgen beider Seiten. Begriffe aus den Titeln werden nach ihrer Besonderheit gewichtet: häufig in der Auswahl, aber selten im ganzen Bestand (Inverse Document Frequency, Spärck Jones 1972), damit Füllwörter nicht das Bild bestimmen. Die Anordnung folgt einem Kräftemodell (Fruchterman und Reingold 1991): Verbundene Knoten ziehen sich an, alle stoßen sich ab.</p>
          <p className="mt-3 text-[14px] text-slate-500">Grenzen: Eine Verbindung bedeutet gemeinsames Vorkommen, keine Ursache. Begriffe stammen aus Titeln, nicht aus dem vollen Text. Ausgewertet werden höchstens die jüngsten 3.000 passenden Einträge.</p>
          </details>
          <Link href="/analytics/graph" className="mt-5 inline-block text-[16px] font-medium text-teal-600">Knowledge Graph öffnen →</Link>
        </div>
      </article>
      <article className="mt-4 grid items-center gap-8 border-y border-slate-200 py-8 md:grid-cols-[320px_1fr]">
        <Link href="/analytics/trends" aria-label="Trends öffnen"><TrendThumb /></Link>
        <div>
          <h3 className="text-[22px] font-semibold">Trends und Frühindikatoren</h3>
          <p className="mt-2 text-[16px] text-slate-500">Zeigt, welche Begriffe gerade aufkommen, zunehmen oder verschwinden: der aktuelle Zeitraum im Vergleich zum Zeitraum davor, als Trendkarte, Rangliste mit Verlaufskurven und Themenfeld-Veränderung. Mit denselben Suchen und Filtern wie auf der Startseite.</p>
          <details className="group mt-4 border-t border-slate-200 pt-3">
            <summary className="flex cursor-pointer list-none items-center justify-between text-[16px] font-medium text-slate-900 [&::-webkit-details-marker]:hidden">
              Wissenschaftlicher Hintergrund
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform group-open:rotate-180"><path d="m6 9 6 6 6-6" /></svg>
            </summary>
          <p className="mt-3 text-[14px] leading-relaxed text-slate-700">Trenderkennung in Textströmen sucht Begriffe, deren Häufigkeit plötzlich ansteigt („Bursts“; Kleinberg, „Bursty and Hierarchical Structure in Streams“, 2002). Hier werden zwei gleich lange Zeitfenster verglichen, die letzten Tage und die Tage davor. Verglichen werden Anteile an allen Einträgen und nicht Rohzahlen, damit mehr oder weniger Einträge insgesamt das Bild nicht verfälschen. Ob ein Unterschied über Zufall hinausgeht, prüft ein Zwei-Stichproben-Test für Anteile; für seltene Begriffe in Textdaten ist das Log-Likelihood-Verfahren üblich (Dunning, „Accurate Methods for the Statistics of Surprise and Coincidence“, 1993). Als Frühindikator gilt ein Begriff, der davor kaum vorkam und jetzt in mehreren Gebieten auftaucht: Breite ist ein stärkeres Signal als bloße Menge. Gleichmäßige Stichproben halten die Abfrage auch bei Millionen Einträgen schnell.</p>
          <p className="mt-3 text-[14px] text-slate-500">Grenzen: Ein Trend ist ein Hinweis, keine Entscheidung. Begriffe stammen aus Titeln. Saisonale Muster (zum Beispiel Haushaltsberatungen im Herbst) erscheinen als Trend, weil der Vorjahreszeitraum im Bestand fehlt. Je Zeitraum werden höchstens rund 12.000 Einträge ausgewertet.</p>
          </details>
          <Link href="/analytics/trends" className="mt-5 inline-block text-[16px] font-medium text-teal-600">Trends öffnen →</Link>
        </div>
      </article>
      <article className="mt-4 grid items-center gap-8 border-y border-slate-200 py-8 md:grid-cols-[320px_1fr]">
        <Link href="/analytics/vergleich" aria-label="Gebietsvergleich öffnen"><CompareThumb /></Link>
        <div>
          <h3 className="text-[22px] font-semibold">Gebietsvergleich</h3>
          <p className="mt-2 text-[16px] text-slate-500">Stellt zwei bis vier Orte nebeneinander: Themenprofil, Stand der Vorlagen, Verlauf, aktivste Gremien sowie typische und gemeinsame Begriffe. Als Maßstab dienen alle Gebiete. Mit denselben Suchen und Filtern wie auf der Startseite.</p>
          <details className="group mt-4 border-t border-slate-200 pt-3">
            <summary className="flex cursor-pointer list-none items-center justify-between text-[16px] font-medium text-slate-900 [&::-webkit-details-marker]:hidden">
              Wissenschaftlicher Hintergrund
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform group-open:rotate-180"><path d="m6 9 6 6 6-6" /></svg>
            </summary>
          <p className="mt-3 text-[14px] leading-relaxed text-slate-700">Der Vergleich folgt dem Benchmarking: Ein Ort wird nicht für sich, sondern an einem Maßstab gemessen, hier an allen Gebieten mit denselben Filtern. Das Themenprofil zeigt die Anteile der Themenfelder, ähnlich einem Standortquotienten aus der Regionalökonomie (Anteil im Ort geteilt durch Anteil im Maßstab). Typisch für einen Ort sind Begriffe, die dort deutlich häufiger vorkommen als im Maßstab; ob der Unterschied über den Zufall hinausgeht, prüft ein Zwei-Stichproben-Test für Anteile, bei Wortdaten gebräuchlich als Log-Likelihood-Verfahren (Dunning, 1993). Einträge je 1.000 Einwohner machen Orte unterschiedlicher Größe vergleichbar.</p>
          <p className="mt-3 text-[14px] text-slate-500">Grenzen: Wie vollständig das Ratsinformationssystem eines Ortes im Bestand erfasst ist, wirkt auf alle Zahlen. Die Einträge je Einwohner sind deshalb ein Anhaltspunkt, kein Maß für politische Aktivität. Themenprofil, Vorlagenstand und Begriffe stammen aus einer Stichprobe von höchstens 6.000 Einträgen je Ort.</p>
          </details>
          <Link href="/analytics/vergleich" className="mt-5 inline-block text-[16px] font-medium text-teal-600">Gebietsvergleich öffnen →</Link>
        </div>
      </article>
      <article className="mt-4 grid items-center gap-8 border-y border-slate-200 py-8 md:grid-cols-[320px_1fr]">
        <Link href="/analytics/beschluesse" aria-label="Status und Beschlüsse öffnen"><DecisionThumb /></Link>
        <div>
          <h3 className="text-[22px] font-semibold">Status und Beschlüsse</h3>
          <p className="mt-2 text-[16px] text-slate-500">Zeigt, wie Vorgänge stehen und ausgehen: Beschlussquote, Vertagungen und Ablehnungen, wie einig Gremien entscheiden, wie oft Vorlagen geändert werden und wie lange ein Vorgang bis zum Beschluss braucht. Mit denselben Suchen und Filtern wie auf der Startseite.</p>
          <details className="group mt-4 border-t border-slate-200 pt-3">
            <summary className="flex cursor-pointer list-none items-center justify-between text-[16px] font-medium text-slate-900 [&::-webkit-details-marker]:hidden">
              Wissenschaftlicher Hintergrund
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform group-open:rotate-180"><path d="m6 9 6 6 6-6" /></svg>
            </summary>
          <p className="mt-3 text-[14px] leading-relaxed text-slate-700">Die Beschlussquote ist der Anteil „beschlossen“ an allen Vorgängen mit Entscheidung (beschlossen, vertagt, abgelehnt). Als Maß für Einigkeit dient der Anteil einstimmiger Beschlüsse; in der Parlamentsforschung gilt die Geschlossenheit von Abstimmungen als Hinweis auf Konfliktlinien (Rice-Index, Rice 1925). Ob und wie ein Beschlussvorschlag geändert wurde, wird aus dem Ergebnistext gelesen („geändert beschlossen“). Die Durchlaufzeit misst die Tage von der ersten Station eines Vorgangs bis zur Entscheidung; Zeiten bis zu einem Ereignis werden üblicherweise mit Überlebenszeitanalysen untersucht (Kaplan und Meier, 1958), die auch noch offene Vorgänge berücksichtigen.</p>
          <p className="mt-3 text-[14px] text-slate-500">Grenzen: Der Status ist nur bei einem Viertel der Einträge bekannt, Ablehnungen sind in den Quellen selten vermerkt. Ausschüsse empfehlen meist nur, ihre Quote ist mit der des Rats nicht direkt vergleichbar. Noch offene Vorgänge fehlen in der Durchlaufzeit, die dadurch eher zu kurz ausfällt, denn die hier verwendete einfache Messung berücksichtigt sie nicht. Abstimmung, Änderungen und Dauer stammen aus einer Stichprobe von höchstens 4.000 Vorgängen.</p>
          </details>
          <Link href="/analytics/beschluesse" className="mt-5 inline-block text-[16px] font-medium text-teal-600">Status und Beschlüsse öffnen →</Link>
        </div>
      </article>
      <p className="mt-8 text-[14px] text-slate-500">Weitere Funktionen sind in Planung.</p>
    </main>
  );
}
