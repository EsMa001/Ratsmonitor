// Echte Daten für die Karte und die Trends der Startseite (components/ratsmonitor/info/StartseitePage.tsx).
// Fragt /api/analytics/diffusion je Begriff (Gemeindeebene; dauert je Begriff bis zu einer Minute) und schreibt
// public/data/startseite-trends.json: je Begriff und Kreis die erste Beratung (Gemeinde, Datum) und je Monat die neu
// hinzugekommenen Gebiete. Die Startseite lädt nur diese Datei, damit sie nicht auf die Auswertung warten muss.
// Aufruf: node scripts/startseite-trends.mjs [Basisadresse, Standard http://localhost:5173]
import { readFileSync, writeFileSync } from "node:fs";

const base = (process.argv[2] || "http://localhost:5173").replace(/\/$/, "");
const topics = JSON.parse(readFileSync(new URL("../components/ratsmonitor/info/startseite-topics.json", import.meta.url), "utf8"));
const out = { stand: new Date().toISOString().slice(0, 10), topics: {} };
for (const topic of topics) {
  const r = await fetch(`${base}/api/analytics/diffusion?q=${encodeURIComponent(topic)}&level=city`);
  if (!r.ok) throw new Error(`${topic}: ${r.status}`);
  const d = await r.json();
  /* Je Kreis die früheste Gemeinde (die Karte zeigt Kreise) */
  const byKreis = new Map();
  for (const g of d.regions ?? []) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(g.first ?? "") || (g.ags ?? "").length < 5) continue;
    const k = g.ags.slice(0, 5), day = g.first.slice(0, 10);
    if (!byKreis.has(k) || day < byKreis.get(k)[2]) byKreis.set(k, [k, g.name, day]);
  }
  out.topics[topic] = { f: [...byKreis.values()].sort((a, b) => a[2].localeCompare(b[2])), series: d.series ?? [] };
  console.log(topic, byKreis.size, "Kreise,", (d.regions ?? []).length, "Gebiete");
}
writeFileSync(new URL("../public/data/startseite-trends.json", import.meta.url), JSON.stringify(out));
