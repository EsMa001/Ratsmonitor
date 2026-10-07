/* Zahlen und Daten als gesprochenes Deutsch (für Platzhalter {{schlüssel|format}} in den Skripten). */
const ONES = ["null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn"];
const TENS = ["", "", "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig"];
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const below100 = (n) => (n < 20 ? ONES[n] : (n % 10 ? (n % 10 === 1 ? "ein" : ONES[n % 10]) + "und" : "") + TENS[Math.floor(n / 10)]);
const below1000 = (n) => { const h = Math.floor(n / 100), r = n % 100; return (h ? (h === 1 ? "ein" : ONES[h]) + "hundert" : "") + (r ? (h && r === 1 ? "eins" : below100(r)) : ""); };
export function words(n) {
  n = Math.round(n);
  if (n < 1000) return n === 0 ? "null" : below1000(n);
  if (n >= 1e6) { const m = Math.floor(n / 1e6), r = n % 1e6; return (m === 1 ? "eine Million" : words(m) + " Millionen") + (r ? " " + words(r) : ""); }
  const t = Math.floor(n / 1000), r = n % 1000;
  return (t === 1 ? "ein" : below1000(t)) + "tausend" + (r ? below1000(r) : "");
}
/* Auf die führende Stelle abrunden: 941027 -> 900000, 6113 -> 6000 */
export const floorLead = (n) => { const p = 10 ** (String(Math.floor(n)).length - 1); return Math.floor(n / p) * p; };
const ordinal = (d) => ({ 1: "ersten", 3: "dritten", 7: "siebten", 8: "achten" }[d] || words(d) + (d < 20 ? "ten" : "sten"));
export const FORMATS = {
  text: (v) => String(v), /* Parameter des Kapitels: {{p.thema|text}} */
  zahl: (v) => words(v),
  /* Ziffern mit Tausenderpunkt für Einblendungen: 2230 -> 2.230 */
  ziffern: (v) => Number(v).toLocaleString("de-DE"),
  abrunden: (v) => words(floorLead(v)),
  mehrals: (v) => "mehr als " + words(floorLead(v)),
  fast: (v) => "fast " + words(Math.ceil(v)),
  /* "2025-09-30" -> "dreißigsten September zweitausendfünfundzwanzig" (nach "am") */
  datum: (v) => { const [y, m, d] = String(v).slice(0, 10).split("-").map(Number); return `${ordinal(d)} ${MONTHS[m - 1]} ${words(y)}`; },
  /* "2026-02-26" -> "Februar zweitausendsechsundzwanzig" */
  monat: (v) => { const [y, m] = String(v).slice(0, 10).split("-").map(Number); return `${MONTHS[m - 1]} ${words(y)}`; },
};
export function fill(line, facts) {
  return line.replace(/\{\{([\w.]+)\|(\w+)\}\}/g, (_, key, fmt) => {
    const v = facts[key];
    if (v === undefined) throw new Error(`Fakt fehlt: ${key} (facts.mjs ausführen)`);
    if (!FORMATS[fmt]) throw new Error(`Format unbekannt: ${fmt}`);
    return FORMATS[fmt](v);
  });
}
