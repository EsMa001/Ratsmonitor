/* Fragt echte Zahlen aus der laufenden App ab und schreibt docs/videos/facts.json: node facts.mjs   (BASE = Adresse der App)
   Die Skripte nutzen sie als {{schlüssel|format}} (siehe fmt.mjs), so veralten Zahlen im Video nie und werden nie erfunden. */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const BASE = process.env.BASE || "http://localhost:5173";
const OUT = fileURLToPath(new URL("../facts.json", import.meta.url));
const get = async (path) => { const r = await fetch(BASE + path); if (!r.ok) throw new Error(path + " " + r.status); return r.json(); };
const THEMA = process.env.THEMA || "Klimaschutz", ORT = process.env.ORT || "Münster";
const q = (s) => encodeURIComponent(s);
const [dif, dec, src] = await Promise.all([get(`/api/analytics/diffusion?q=${q(THEMA)}`), get(`/api/analytics/decisions?q=${q(THEMA)}`), get("/api/sources")]);
const ortRow = dif.regions.find((r) => r.name === `Stadt ${ORT}`) || dif.regions.find((r) => r.name.startsWith(ORT));
const [trn, gra, net] = await Promise.all([get(`/api/analytics/trends?q=${q(THEMA)}`), get(`/api/analytics/graph?q=${q(THEMA)}`), get(`/api/analytics/network?q=${q(THEMA)}`)]);
/* Aufkommender Begriff mit den meisten Gebieten (mindestens 10, größter Zuwachs gegenüber dem Zeitraum davor), als Beispiel für Trends */
const trend = [...trn.emerging, ...trn.rising].filter((x) => x.regions >= 10).sort((a, b) => (b.regions - b.regionsPrev) - (a.regions - a.regionsPrev))[0];
const months = (a, b) => Math.round((new Date(b) - new Date(a)) / (30.44 * 864e5));
const facts = {
  "t.d1090": months(dif.stats.p10, dif.stats.p90), "t.decided": dec.totals.decided, "t.rejection": dec.rates.rejection, "t.postponement": dec.rates.postponement,
  "t.unanimous": dec.votes.all.unanimous, "t.changed": dec.votes.all.changed, "t.durMedian": dec.duration.median, "t.trendWindow": trn.window,
  "t.trend": trend ? trend.term : "", "t.trendRegions": trend ? trend.regions : 0, "t.trendPrev": trend ? trend.regionsPrev : 0,
  "t.graphTerms": gra.stats.terms, "t.graphLinks": gra.stats.links, "t.paths": net.paths, "t.pool": net.pool,
  "t.laender": new Set(dif.regions.map((r) => r.ags.slice(0, 2))).size, "t.ort": ortRow ? ortRow.n : 0,
  "t.first": dif.stats.first, "t.half": dif.stats.median, "t.entries": dif.stats.cards, "t.regions": dif.stats.regions,
  "t.approval": dec.rates.approval, "t.statusKnownPct": dec.totals.knownShare,
  "cov.entries": src.totals.articles, "cov.municipalities": src.reach.municipalities.covered,
  "cov.populationPct": Math.round((100 * src.reach.population.covered) / src.reach.population.total),
};
writeFileSync(OUT, JSON.stringify({ asOf: new Date().toISOString().slice(0, 10), thema: THEMA, ort: ORT, values: facts }, null, 1) + "\n");
console.log(THEMA, ORT, facts);
if (facts["t.ort"] < 5) { console.error(`WARNUNG: ${ORT} hat nur ${facts["t.ort"]} Einträge zu ${THEMA} (unter 5). Anderes Thema oder anderen Ort wählen, sonst taugt das Beispiel nicht.`); process.exit(1); }
