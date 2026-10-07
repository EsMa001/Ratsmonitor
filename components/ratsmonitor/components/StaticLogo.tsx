/* Das normale Plenara-Logo (v2 ■) für die Fehlerseiten: reines Markup mit Inline-Stilen, ohne Hooks, Links oder Stylesheet,
   damit es auch erscheint, wenn der Server oder das Layout Probleme macht. Die Vorlage steht in Brand.tsx (PlenaraV2). */
const TEAL = "#0d9488";
const P: [number, number, number, number][] = [
  [78.0, 50.0, 3.6, 1], [75.9, 60.7, 3.6, 1], [69.8, 69.8, 3.6, 1], [60.7, 75.9, 3.6, 1], [50.0, 78.0, 3.6, 1], [39.3, 75.9, 3.6, 1], [30.2, 69.8, 3.6, 1],
  [24.1, 60.7, 3.6, 1], [50.0, 22.0, 3.6, 1], [60.7, 24.1, 3.6, 1], [69.8, 30.2, 3.6, 1], [75.9, 39.3, 3.6, 1],
  [67.0, 50.0, 3, 0.55], [63.8, 60.0, 3, 0.55], [55.3, 66.2, 3, 0.55], [44.7, 66.2, 3, 0.55], [36.2, 60.0, 3, 0.55], [33.0, 50.0, 3, 0.55],
  [36.2, 40.0, 3, 0.55], [44.7, 33.8, 3, 0.55], [55.3, 33.8, 3, 0.55], [63.8, 40.0, 3, 0.55],
];

export function StaticLogo({ size = 32 }: { size?: number }) {
  return (
    <a href="/" aria-label="Plenara, zur Startseite" style={{ display: "inline-flex", alignItems: "center", color: "#0f172a", textDecoration: "none", fontFamily: "'IBM Plex Sans','Segoe UI',system-ui,sans-serif", fontWeight: 400, lineHeight: 1, whiteSpace: "nowrap", fontSize: size, letterSpacing: "-.015em" }}>
      <svg viewBox="15 15 70 70" overflow="visible" aria-hidden="true" style={{ display: "inline-block", height: ".66em", width: ".66em", verticalAlign: "-0.07em", marginRight: ".01em" }}>
        {P.map(([cx, cy, r, o]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={TEAL} fillOpacity={o} />)}
        <path d="M22 108V50A28 28 0 0 1 38.2 24.6" stroke={TEAL} strokeWidth="7" fill="none" strokeLinecap="round" />
      </svg>
      <span>lenara</span>
      <span style={{ display: "inline-block", width: ".15em", height: ".15em", background: TEAL, marginLeft: ".05em" }} />
    </a>
  );
}
