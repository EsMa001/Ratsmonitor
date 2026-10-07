/* Fragt echte Zahlen aus der laufenden App ab und schreibt docs/videos/facts.json: node facts.mjs   (BASE = Adresse der App)
   Die Skripte nutzen sie als {{schlüssel|format}} (siehe fmt.mjs), so veralten Zahlen im Video nie und werden nie erfunden. */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const BASE = process.env.BASE || "http://localhost:5173";
const OUT = fileURLToPath(new URL("../../facts.json", import.meta.url));
const get = async (path) => { const r = await fetch(BASE + path); if (!r.ok) throw new Error(path + " " + r.status); return r.json(); };
const q = (s) => encodeURIComponent(s);
const [dif, dec, src] = await Promise.all([get(`/api/analytics/diffusion?q=${q("Wärmeplanung")}`), get(`/api/analytics/decisions?q=${q("Wärmeplanung")}`), get("/api/sources")]);
const facts = {
  "wp.first": dif.stats.first, "wp.half": dif.stats.median, "wp.entries": dif.stats.cards, "wp.regions": dif.stats.regions,
  "wp.approval": dec.rates.approval, "wp.statusKnownPct": dec.totals.knownShare,
  "cov.entries": src.totals.articles, "cov.municipalities": src.reach.municipalities.covered,
  "cov.populationPct": Math.round((100 * src.reach.population.covered) / src.reach.population.total),
};
writeFileSync(OUT, JSON.stringify({ asOf: new Date().toISOString().slice(0, 10), values: facts }, null, 1) + "\n");
console.log(facts);
