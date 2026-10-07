import Link from "next/link";

/** Funktionen von Plenara Analytics; ohne `href` ist die Funktion in Planung */
const TOOLS: { title: string; text: string; href?: string }[] = [
  { title: "Diffusionsanalyse", text: "Wie breitet sich ein Thema über die Gebiete aus? Wer war zuerst dran, wie schnell folgten die anderen? Mit Zeitraffer auf der Karte.", href: "/analytics/diffusion" },
  { title: "Knowledge Graph", text: "Zusammenhänge zwischen Themen, Gremien, Orten und Vorgängen als Netz." },
  { title: "Weitere Profi-Analysen", text: "Vergleiche zwischen Gebieten, Trends und Frühindikatoren." },
];

export function AnalyticsHome() {
  return (
    <main id="inhalt" className="mx-auto w-full max-w-[1100px] px-4 py-12 text-slate-900 sm:px-6">
      <p className="text-[14px] text-slate-500">Plenara</p>
      <h1 className="mt-1 text-[44px] font-semibold leading-tight max-sm:text-[28px]">Plenara Analytics</h1>
      <p className="mt-3 max-w-[640px] text-[18px] text-slate-500">Tiefe Analysen auf dem gesamten Datenbestand der Räte. Alle Ergebnisse werden bei jeder Abfrage frisch aus der Datenbank berechnet.</p>
      <ul className="mt-10 divide-y divide-slate-200 border-y border-slate-200">
        {TOOLS.map((t) => (
          <li key={t.title} className="flex flex-wrap items-center justify-between gap-4 py-6">
            <div className="max-w-[640px]">
              <h2 className="text-[22px] font-semibold">{t.title}</h2>
              <p className="mt-1 text-[16px] text-slate-500">{t.text}</p>
            </div>
            {t.href ? (
              <Link href={t.href} className="rounded-full bg-slate-900 px-5 py-2.5 text-[14px] font-medium text-white">Öffnen →</Link>
            ) : (
              <span className="text-[14px] text-slate-500">In Planung</span>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
