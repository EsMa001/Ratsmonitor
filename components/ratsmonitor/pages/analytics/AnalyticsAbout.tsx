import Link from "next/link";

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

export function AnalyticsAbout() {
  return (
    <main id="inhalt" className="mx-auto w-full max-w-[1100px] px-4 py-12 text-slate-900 sm:px-6">
      <p className="text-[14px] text-slate-500">Plenara Analytics</p>
      <h1 className="mt-1 text-[28px] font-semibold leading-tight sm:text-[44px]">Über Plenara Analytics</h1>
      <p className="mt-3 max-w-[680px] text-[18px] text-slate-500">Analysen auf dem gesamten Datenbestand der Räte. Jede Auswertung wird bei der Abfrage frisch aus der Datenbank berechnet; ändert sich der Bestand, ändert sich das Ergebnis.</p>

      <h2 className="mt-14 text-[22px] font-semibold">Funktionen</h2>
      <article className="mt-4 grid items-center gap-8 border-y border-slate-200 py-8 md:grid-cols-[320px_1fr]">
        <Link href="/analytics/diffusion" aria-label="Diffusionsanalyse öffnen"><DiffusionThumb /></Link>
        <div>
          <h3 className="text-[22px] font-semibold">Diffusionsanalyse</h3>
          <p className="mt-2 text-[16px] text-slate-500">Zeigt, wie sich ein Thema über die Gebiete ausbreitet: wer zuerst dran war, wie schnell andere folgten und wo es noch fehlt. Als Zeitraffer auf der Karte, mit den gleichen Suchen und Filtern wie auf der Startseite.</p>
          <p className="mt-4 text-[14px] leading-relaxed text-slate-700"><b className="font-semibold">Wissenschaftlicher Hintergrund.</b> Die Analyse folgt der Diffusionsforschung (Rogers, „Diffusion of Innovations“, 1962; Hägerstrand zur räumlichen Ausbreitung, 1967): Neuerungen breiten sich in der Regel in einer S-Kurve aus, erst langsam bei wenigen Vorreitern, dann schnell, dann abflachend. Für Politik beschreibt die Policy-Diffusion (Walker 1969; Shipan und Volden 2008), dass Kommunen voneinander lernen, einander nachahmen oder unter Wettbewerbsdruck stehen. Als Zeitpunkt der Übernahme gilt hier die erste Erwähnung des Themas in einem Eintrag des Gebiets. Daraus entstehen die Kurve der erreichten Gebiete, die Zeit von 10 % bis 90 % Verbreitung als Maß für das Tempo sowie die Rangfolge der Vorreiter.</p>
          <p className="mt-3 text-[14px] text-slate-500">Grenzen: Die erste Erwähnung ist ein Indikator, keine Entscheidung. Gebiete mit unvollständigem Datenbestand erscheinen womöglich zu spät.</p>
          <Link href="/analytics/diffusion" className="mt-5 inline-block text-[16px] font-medium text-teal-600">Diffusionsanalyse öffnen →</Link>
        </div>
      </article>
      <p className="mt-8 text-[14px] text-slate-500">Weitere Funktionen, etwa ein Knowledge Graph, sind in Planung.</p>
    </main>
  );
}
