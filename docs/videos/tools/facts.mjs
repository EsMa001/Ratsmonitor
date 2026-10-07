/* Fragt echte Zahlen aus der laufenden App ab und schreibt docs/videos/facts.json: node facts.mjs   (BASE = Adresse der App)
   THEMEN = Themen, für die Zahlen geholt werden (Standard: Klimaschutz,Wärmeplanung,Hitzeschutz; das erste ist das Standardthema), ORT = Beispielort (Standard Münster).
   Die Skripte nutzen sie als {{schlüssel|format}} (siehe fmt.mjs); je Kapitel gilt das Thema aus kapitel.json/Parameter "thema" ("t.*"), ein zweites Thema "thema2" liefert "u.*". So veralten Zahlen im Video nie und werden nie erfunden. */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const BASE = process.env.BASE || "http://localhost:5173";
const OUT = fileURLToPath(new URL("../facts.json", import.meta.url));
const get = async (path) => { const r = await fetch(BASE + path); if (!r.ok) throw new Error(path + " " + r.status); return r.json(); };
const THEMEN = (process.env.THEMEN || "Klimaschutz,Wärmeplanung,Hitzeschutz").split(",").map((s) => s.trim()), ORT = process.env.ORT || "Münster";
const ORTE = (process.env.ORTE || "Münster,Freiburg,Leipzig,Köln,Hannover,Dresden,Mainz,Kiel,Osnabrück,Stuttgart,Hamburg,Berlin,Erfurt,Rostock").split(",").map((x) => x.trim());
const q = (s) => encodeURIComponent(s);
const months = (a, b) => Math.round((new Date(b) - new Date(a)) / (30.44 * 864e5));
async function thema(T) {
  const [dif, dec, trn, gra, net] = await Promise.all(["diffusion", "decisions", "trends", "graph", "network"].map((e) => get(`/api/analytics/${e}?q=${q(T)}`)));
  /* Einträge je Beispielort (Stadt X): jedes Kapitel wählt seinen Ort per Parameter "ort" */
  const orte = Object.fromEntries(ORTE.map((o) => [o, (dif.regions.find((r) => r.name === `Stadt ${o}`) || dif.regions.find((r) => r.name.startsWith(o + " ")) || { n: 0 }).n]));
  /* Aufkommender Begriff mit den meisten Gebieten (mindestens 10, größter Zuwachs gegenüber dem Zeitraum davor), als Beispiel für Trends */
  const trend = [...trn.emerging, ...trn.rising].filter((x) => x.regions >= 10).sort((a, b) => (b.regions - b.regionsPrev) - (a.regions - a.regionsPrev))[0];
  /* Stärkster Monat bei neuen Gebieten und die Summe der vier Monate davor (Sprung, z. B. Hitzeschutz im September) */
  const s = dif.series, pk = s.reduce((m, x, i) => (x.added > s[m].added ? i : m), 0);
  return {
    "t.d1090": months(dif.stats.p10, dif.stats.p90), "t.decided": dec.totals.decided, "t.rejection": dec.rates.rejection, "t.postponement": dec.rates.postponement,
    "t.unanimous": dec.votes.all.unanimous, "t.changed": dec.votes.all.changed, "t.durMedian": dec.duration.median, "t.trendWindow": trn.window,
    "t.trend": trend ? trend.term : "", "t.trendRegions": trend ? trend.regions : 0, "t.trendPrev": trend ? trend.regionsPrev : 0,
    "t.graphTerms": gra.stats.terms, "t.graphLinks": gra.stats.links, "t.paths": net.paths, "t.pool": net.pool,
    "t.laender": new Set(dif.regions.map((r) => r.ags.slice(0, 2))).size, "t.orte": orte,
    "t.first": dif.stats.first, "t.half": dif.stats.median, "t.halfMonate": months(dif.stats.first, dif.stats.median), "t.entries": dif.stats.cards, "t.regions": dif.stats.regions,
    "t.peakMonat": s[pk].month + "-01", "t.peakN": s[pk].added, "t.prev4": s.slice(Math.max(0, pk - 4), pk).reduce((a, x) => a + x.added, 0),
    "t.approval": dec.rates.approval, "t.statusKnownPct": dec.totals.knownShare,
  };
}
const src = await get("/api/sources");
const cov = { "cov.entries": src.totals.articles, "cov.municipalities": src.reach.municipalities.covered, "cov.populationPct": Math.round((100 * src.reach.population.covered) / src.reach.population.total) };
const sets = {};
for (const T of THEMEN) sets[T] = await thema(T);
writeFileSync(OUT, JSON.stringify({ asOf: new Date().toISOString().slice(0, 10), thema: THEMEN[0], ort: ORT, values: { ...cov, ...sets[THEMEN[0]] }, cov, sets }, null, 1) + "\n");
for (const T of THEMEN) console.log(T, JSON.stringify(sets[T]));
if (sets[THEMEN[0]]["t.orte"][ORT] < 5) { console.error(`WARNUNG: ${ORT} hat nur ${sets[THEMEN[0]]["t.orte"][ORT]} Einträge zu ${THEMEN[0]} (unter 5). Anderes Thema oder anderen Ort wählen, sonst taugt das Beispiel nicht.`); process.exit(1); }
