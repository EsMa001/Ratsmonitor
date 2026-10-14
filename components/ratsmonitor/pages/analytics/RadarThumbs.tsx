/* Vorschaubilder der festen Auswahlen im Atlas und der Themen-Analysen. Gezeichnet, nicht aus dem Schnappschuss: Formen und
   Verhältnisse nach den Auswertungen vom 11.10.2026 (Vorgänge je Unterthema, Beschlussquote je Fraktion, Programme,
   Verfahrensschritte), ohne Zahlen. */

const FRAME = "block h-auto w-full rounded-[18px] border border-slate-200 bg-white";
const TEAL = "#0d9488", TEAL_LIGHT = "#5eead4", TEAL_DARK = "#0f766e", GRID = "#e2e8f0", MUTED = "#cbd5e1";

/* Vorgänge je Unterthema (Formen der früheren Themenradare vom 11.10.2026, nur als Bild) */
const SHAPE: Record<string, number[]> = {
  versorgung: [996, 2911, 3730, 6693, 3583, 6173, 1535],
  verkehr: [7549, 4120, 5797, 5041, 3071, 1838, 1164],
  soziales: [2296, 8462, 5613, 4475, 2231, 3819, 976, 5844],
  vergabe: [1949, 2842, 7892, 2934, 1013, 639],
  klima: [2752, 4081, 2609, 1866, 3063, 1108, 682],
  finanzen: [12958, 1969, 3038, 1449, 11874, 673, 5268],
  beteiligung: [2726, 653, 794, 2878],
  /* Förderung und Zuschüsse je Thema, Bildung je Unterthema (x_cases, 14.10.2026) */
  foerderung: [1058, 1570, 546, 7069, 672, 472, 2163, 897, 2357, 437, 881],
  kita: [1047, 3975, 2518, 7316, 4522, 9845, 2316],
  gebuehren: [317, 1420, 170, 517, 474, 953, 372, 425, 603, 411, 287, 257, 470, 410, 46],
};

/** Thema im Atlas: Netzdiagramm der Unterthemen, daneben die vier häufigsten als Balken */
function ThemeRadarThumb({ id, name }: { id: keyof typeof SHAPE; name: string }) {
  const v = SHAPE[id];
  const max = Math.max(...v), cx = 96, cy = 78, R = 58, k = v.length;
  const at = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / k;
    return [Math.round((cx + Math.cos(a) * r) * 10) / 10, Math.round((cy + Math.sin(a) * r) * 10) / 10];
  };
  const pts = v.map((x, i) => at(i, R * Math.max(0.18, Math.sqrt(x / max))));
  const ring = (f: number) => v.map((_, i) => at(i, R * f).join(",")).join(" ");
  const top = [...v].sort((a, b) => b - a).slice(0, 4);
  return (
    <svg viewBox="0 0 320 156" role="img" aria-label={`Vorschau ${name}: Netz der Unterthemen, daneben die häufigsten als Balken`} className={FRAME}>
      {[1 / 3, 2 / 3, 1].map((f) => <polygon key={f} points={ring(f)} fill="none" stroke={GRID} />)}
      {v.map((_, i) => { const [x, y] = at(i, R); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={GRID} />; })}
      <polygon points={pts.map((p) => p.join(",")).join(" ")} fill={TEAL} fillOpacity=".18" stroke={TEAL} strokeWidth="2" strokeLinejoin="round" />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.2" fill={TEAL} />)}
      {top.map((x, i) => (
        <g key={i} transform={`translate(184 ${46 + i * 20})`}>
          <rect width="112" height="8" rx="4" fill="#f1f5f9" />
          <rect width={Math.max(8, (112 * x) / top[0])} height="8" rx="4" fill={i ? TEAL_LIGHT : TEAL} />
        </g>
      ))}
    </svg>
  );
}

/** Fraktionsprofil: Anträge je Fraktion als Balken, der Petrol-Anteil ist die Erfolgsquote */
function FactionThumb() {
  const rows: [number, number][] = [[6719, 0.8], [6599, 0.745], [5503, 0.71], [2217, 0.715], [1899, 0.56], [1804, 0.41]];
  return (
    <svg viewBox="0 0 320 156" role="img" aria-label="Vorschau des Fraktionsprofils: Anträge je Fraktion, davon beschlossen" className={FRAME}>
      {rows.map(([n, rate], i) => {
        const w = (220 * n) / rows[0][0];
        return (
          <g key={i} transform={`translate(28 ${26 + i * 19})`}>
            <circle cx="6" cy="4" r="6" fill={MUTED} />
            <rect x="22" width={w} height="9" rx="4.5" fill={GRID} />
            <rect x="22" width={w * rate} height="9" rx="4.5" fill={TEAL} />
          </g>
        );
      })}
    </svg>
  );
}

/** Bauleitplanung: Pläne je Verfahrensschritt als Stufen, dazu Häuser als Bild für Baugebiete */
function PlanningThumb() {
  const steps = [2949, 1541, 1599, 423, 2648], max = Math.max(...steps);
  return (
    <svg viewBox="0 0 320 156" role="img" aria-label="Vorschau der Bauleitplanung: Pläne je Verfahrensschritt bis zum Satzungsbeschluss" className={FRAME}>
      {steps.map((n, i) => {
        const x = 24 + i * 38, h = 16 + (70 * n) / max;
        return (
          <g key={i}>
            <rect x={x} y={104 - h} width="28" height={h} rx="3" fill={i === steps.length - 1 ? TEAL : i ? TEAL_LIGHT : MUTED} />
            <path d={`M${x} 116h24l6 6-6 6h-24l6-6z`} fill={i === steps.length - 1 ? TEAL_DARK : GRID} />
          </g>
        );
      })}
      {[[226, 72, 1], [262, 60, 1.25], [238, 104, 0.9]].map(([x, y, f], i) => (
        <path key={i} transform={`translate(${x} ${y}) scale(${f})`} d="M0 14L14 2L28 14V32H0Z" fill={i === 1 ? TEAL : "none"} stroke={TEAL} strokeWidth="2" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

/** Newsradar: Meldungen als Spalten mit Überschrift, Zitatbalken und Zeilen */
function NewsThumb() {
  return (
    <svg viewBox="0 0 320 156" role="img" aria-label="Vorschau des Newsradars: Meldungen mit Überschrift, Zitat und Text" className={FRAME}>
      {[0, 1, 2].map((k) => (
        <g key={k} transform={`translate(${24 + k * 96} 26)`}>
          <rect width="80" height="9" rx="4.5" fill={k ? MUTED : "#0f172a"} />
          <rect y="15" width="58" height="9" rx="4.5" fill={k ? MUTED : "#0f172a"} />
          <rect y="36" width="3" height="34" rx="1.5" fill={TEAL} />
          {[0, 1, 2].map((r) => <rect key={r} x="10" y={38 + r * 11} width={[66, 58, 44][r]} height="6" rx="3" fill={TEAL_LIGHT} />)}
          {[0, 1].map((r) => <rect key={r} y={82 + r * 11} width={[80, 62][r]} height="6" rx="3" fill={GRID} />)}
        </g>
      ))}
    </svg>
  );
}

/** Vorschaubilder je Auswahl (AnalyticsAbout führt sie mit den Tools in ANALYSE_THUMBS zusammen) */
export const RADAR_THUMBS = {
  fraktionen: FactionThumb,
  news: NewsThumb,
  foerderung: () => <ThemeRadarThumb id="foerderung" name="Förderung und Zuschüsse" />,
  bauleitplanung: PlanningThumb,
  kita: () => <ThemeRadarThumb id="kita" name="Kitas: Betrieb, Träger und Beiträge" />,
  versorgung: () => <ThemeRadarThumb id="versorgung" name="Umwelt, Klima & Energie" />,
  verkehr: () => <ThemeRadarThumb id="verkehr" name="Mobilität & Verkehr" />,
  soziales: () => <ThemeRadarThumb id="soziales" name="Soziales & Gesundheit" />,
  vergabe: () => <ThemeRadarThumb id="vergabe" name="Ausschreibung und Vergabe" />,
  klima: () => <ThemeRadarThumb id="klima" name="Klimaschutz und Energieeffizienz" />,
  finanzlage: () => <ThemeRadarThumb id="finanzen" name="Finanzen & Haushalt" />,
  beteiligung: () => <ThemeRadarThumb id="beteiligung" name="Bürgerbeteiligung und Beiräte" />,
  gebuehren: () => <ThemeRadarThumb id="gebuehren" name="Gebühren, Beiträge und Steuern" />,
};
