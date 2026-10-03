// Token-Verbrauch der KI-Verarbeitung je Modell (Summe und Durchschnitt je Artikel).
// Aufruf: node scripts/ai-usage.mjs [Pfad zur lokalen D1-SQLite] [--prices scripts/ai-prices.json]
// Preise: nur aus der Preistabelle (USD/EUR je 1 Mio. Token), nichts wird geschätzt.
// Ältere Artikel ohne Token-Daten werden als "unbekannt" ausgewiesen, nicht nachgerechnet.
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { summarizeUsage } from '../shared/ai-usage.mjs';

const args = process.argv.slice(2);
const pricesAt = args.indexOf('--prices');
const pricesFile = pricesAt >= 0 ? args[pricesAt + 1] : 'scripts/ai-prices.json';
const dir = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
const dbFile = args.find((a, i) => !a.startsWith('--') && (pricesAt < 0 || i !== pricesAt + 1)) ?? `${dir}/${readdirSync(dir).find((f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite')}`;
const db = new DatabaseSync(dbFile, { readOnly: true });
const prices = existsSync(pricesFile) ? JSON.parse(readFileSync(pricesFile, 'utf8')).models ?? {} : {};

const hasTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='ai_usage'").get();
const rows = hasTable ? db.prepare('SELECT * FROM ai_usage').all() : [];
const unknown = db.prepare(`SELECT count(*) n FROM topics WHERE (json_extract(payload,'$.summaryModel') IS NOT NULL OR json_extract(payload,'$.weightedKeywords.model') IS NOT NULL OR json_extract(payload,'$.labelAssessments.ai.model') IS NOT NULL)${hasTable ? ' AND id NOT IN (SELECT topic_id FROM ai_usage)' : ''}`).get().n;
const r = summarizeUsage(rows, unknown, prices);

const fmt = (n) => (n == null ? 'unbekannt' : n.toLocaleString('de-DE'));
if (!r.models.length) console.log('Noch keine Token-Daten gespeichert.');
for (const m of r.models) {
  console.log(`${m.agent} · ${m.model} (${m.method}): ${fmt(m.attempts)} Artikel, davon ${fmt(m.withTokens)} mit Token-Angabe, ${fmt(m.withoutTokens)} ohne (unbekannt), ${fmt(m.incomplete)} nicht in allen Schritten abgeschlossen (z. B. zu wenig Quelltext)`);
  console.log(`  Eingabe ${fmt(m.inputTokens)} (davon gecacht ${fmt(m.cachedTokens)}) · Ausgabe ${fmt(m.outputTokens)} · gesamt ${fmt(m.totalTokens)} · Ø ${fmt(m.avgTotalPerArticle)} Token je Artikel`);
  console.log(`  Ø je Artikel: ${fmt(m.avgWords)} Wörter, ${fmt(m.avgSources)} Quellen, ${fmt(m.avgAttachments)} Anhänge · ${fmt(m.tokensPer1000Words)} Token je 1000 Wörter`);
  if (m.tokensWithoutSplit) console.log(`  Hinweis: ${fmt(m.tokensWithoutSplit)} Token ohne Aufteilung Eingabe/Ausgabe (nur Gesamtwert bekannt).`);
  console.log(m.costRange ? `  Kosten: zwischen ${m.costRange[0].toFixed(2)} und ${m.costRange[1].toFixed(2)} ${m.currency} (alles Eingabe .. alles Ausgabe; Ø ${(m.costRange[0] / m.withTokens).toFixed(4)} .. ${(m.costRange[1] / m.withTokens).toFixed(4)} ${m.currency} je Artikel)` : m.cost == null ? '  Kosten: kein Preis in der Preistabelle (oder keine Token-Angaben)' : `  Kosten (nur Artikel mit Token-Angabe): ${m.cost.toFixed(4)} ${m.currency}, Ø ${(m.cost / m.withTokens).toFixed(5)} ${m.currency} je Artikel`);
}
console.log(`Unbekannt (KI-verarbeitet, aber ohne jede Erfassung, z. B. vor Einführung): ${fmt(r.unknownArticles)} Artikel`);
