// Regelbasierter Auszug aus dem Text einer Vorlage, Anlage oder Vereinbarung (Ratsinformationssystem).
// Kein KI-Modell: wählt bis zu fünf Originalsätze (Beschluss, Anlass, Kern, Zahlen, Fristen) und formuliert nichts um.
// Portierung von experiments/ris-regeln/ris_regeln.py; die Ergebnisse müssen gleich bleiben
// (Vergleich: tests/ris-auszug.test.mjs, scripts/vergleich-ris-auszug.mjs).
//
// Hinweis zu \b: In JavaScript kennt \b nur ASCII-Wortzeichen, in Python auch Umlaute. Deshalb steht in den Mustern
// \b für eine Wortgrenze mit Unicode-Buchstaben (siehe re()).
export const AUSZUG_METHOD = 'regel-auszug-v1';
export const AUSZUG_LABEL = 'Automatischer Auszug (Regeln)';
export const AUSZUG_NOTICE = 'Automatischer Auszug aus der Originalunterlage, keine KI-Zusammenfassung.';
export const AUSZUG_MAX = 5;

const W = '[\\p{L}\\p{N}_]';
const GRENZE = `(?:(?<!${W})(?=${W})|(?<=${W})(?!${W}))`;
const re = (src, flags = '') => new RegExp(src.replaceAll('\\b', GRENZE), 'u' + flags);
const len = s => Array.from(s).length;

// Abkürzungen mit Punkt, die keine Satzgrenze sind ("gem." fehlt noch)
const ABK = ['Abs.', 'Nr.', 'Dr.', 'Co.', 'Mio.', 'Mrd.', 'Tsd.', 'ca.', 'bzw.', 'ggf.', 'vgl.', 'Art.', 'Satz.',
  'z. B.', 'u. a.', 'i. H. v.', 'i. V. m.', 'd. h.', 'Str.', 'Prof.', 'e. V.', 'zzgl.', 'inkl.', 'evtl.'];
const B = '¶'; // harte Satzgrenze (Überschrift, Aufzählungsnummer)
const PUNKT = '․'; // Ersatz für den Punkt in Abkürzungen und Ordnungszahlen

const TYPEN = re('\\b(ENTWURF|Entwurf|Berichtsvorlage|Beschlussvorlage|Mitteilungsvorlage|Niederschrift|Protokoll|Antrag|Anfrage|Vereinbarung|Satzung|Vertrag|Bebauungsplan|Jahresabschluss|Haushalt)\\b', 'g');
const SEITE = re('^(?:Seite )?\\d+(?: von \\d+)?$');
const KLEIN_START = re('^[a-zäöüß]');
const VERBINDER = re('^(?:und|oder|bzw|sowie)\\b');
const KLEIN_ENDE = re('[a-zäöüß]-$');
const GROSS_START = re('^[A-ZÄÖÜ§0-9]');
const SATZ_ENDE = re('[.,;“]$');
const HILFSVERB = re('\\b(?:wird|werden|ist|sind|soll|sollen)\\b');

/** Zeilen aufräumen: wiederkehrende Kopf-/Fußzeilen und Seitenzahlen weg, Silbentrennung zusammenfügen,
 * Überschriften als harte Satzgrenze markieren. */
export function vorbereiten(txt) {
  const roh = String(txt || '').split(/\r\n|\r|\n/).map(l => l.trim());
  const zaehler = new Map();
  for (const l of roh) zaehler.set(l, (zaehler.get(l) || 0) + 1);
  const lines = roh.filter(l => l && zaehler.get(l) < 2 && !SEITE.test(l));
  const out = [];
  for (const l of lines) {
    // Trennstrich am Zeilenende (nicht bei Ergänzungsstrichen wie "Einzelhandels- und")
    if (out.length && out.at(-1).endsWith('-') && KLEIN_START.test(l) && !VERBINDER.test(l) && KLEIN_ENDE.test(out.at(-1))) {
      out[out.length - 1] = out.at(-1).slice(0, -1) + l;
      continue;
    }
    out.push(l);
  }
  return out.map(l => {
    // Überschrift: kurz, kein Satzzeichen am Ende, beginnt groß/§/Ziffer, kein finites Hilfsverb
    const kopf = len(l) <= 60 && GROSS_START.test(l) && !SATZ_ENDE.test(l) && !HILFSVERB.test(l);
    return kopf ? `${B} ${l} ${B}` : l;
  });
}

export function saetze(flat) {
  let s = flat;
  for (const a of ABK) s = s.replaceAll(a, a.replaceAll('.', PUNKT));
  // Aufzählungsnummern nach Satzende oder Doppelpunkt sind Grenzen, Ordnungszahlen mitten im Satz nicht
  s = s.replace(/(?<=[.!?:“])\s+\d{1,2}\.\s+(?=[A-ZÄÖÜ§„])/g, ` ${B} `);
  s = s.replace(/^\d{1,2}\.\s+/, ' ');
  s = s.replace(/(\d{1,3})\.(?=\s+[A-ZÄÖÜ])/g, (_, z) => z + PUNKT);
  s = s.replace(/:\s+(?=„)/g, `: ${B} `);
  const teile = [];
  for (const blk of s.split(B)) teile.push(...blk.split(/(?<=[.!?“])\s+(?=[A-ZÄÖÜ„§])/));
  return teile.map(p => p.replaceAll(PUNKT, '.').trim()).filter(p => len(p) > 1);
}

const R2_VORSCHLAG = re(`(Beschlussvorschlag|Beschlussempfehlung|Beschlussentwurf)\\s*:?\\s*${B}?\\s*(.{40,900})`);
const R2_RAT = re('\\b(?:Rat|Ausschuss|Bezirksvertretung|Kreistag|Kreisausschuss)\\b[^.]{0,80}\\b(?:beschließt|empfiehlt|nimmt)\\b');
const R3_ANLASS = re('\\b(?:Aufgrund|Vor dem Hintergrund|Ziel (?:ist|der|des)|erforderlich|notwendig|daher|deshalb|Anlass)\\b');
const R4_VERB = re('\\b(?:soll|sollen|wird|werden)\\b.*\\b(?:errichtet|eingerichtet|geändert|neu gefasst|beauftragt|vergeben|genehmigt|beschlossen|angemietet|erweitert|erneuert|saniert|gebaut|aufgestellt|ermächtigt|übertragen)\\b|\\b(?:beschließt|genehmigt|beauftragt|vergibt)\\b');
const R5_BETRAG = re('\\d[\\d.,]*\\s?(?:Mio\\.|Mrd\\.|T€|€|Euro|%)');
const R5_VERGLEICH = re('(?:Vorjahr|VJ|gegenüber|Vergleich|insgesamt|Gesamtkosten|Kosten)');
const R6_FRIST = re('(?:tritt .{0,60}in Kraft|bedarf der Genehmigung|spätestens|Frist)');

function fakten(s) {
  const ziffern = (s.match(/\d/gu) || []).length;
  const grossWorte = (s.match(re('(?<!^)\\b[A-ZÄÖÜ][a-zäöüß]{3,}', 'g')) || []).length;
  return (ziffern * 0.5 + grossWorte) / Math.max(1, len(s) / 50);
}

/** Gibt { typ, saetze: [{regel, satz}] } zurück: Typwörter und bis zu fünf Originalsätze mit der Regel, die sie gewählt hat. */
export function extrahiereMitRegel(txt) {
  const lines = vorbereiten(txt);
  const flat = lines.join(' ').replace(/\s+/gu, ' ');
  const S = saetze(flat);
  const ok = s => { const n = len(s); return n >= 50 && n <= 420; };
  const typ = [...new Set((lines.slice(0, 25).join(' ').match(TYPEN)) || [])].sort();
  // R2 Beschluss: zwei Sätze nach Beschlussvorschlag, sonst "Der Rat beschließt ..."
  let g2 = [];
  const m = R2_VORSCHLAG.exec(flat);
  if (m) g2 = saetze(m[2]).filter(ok).slice(0, 2);
  if (!g2.length) g2 = S.filter(s => R2_RAT.test(s) && ok(s)).slice(0, 1);
  // R3 Anlass: erster Satz der ersten Dokumenthälfte mit Auslösewort
  const n = S.length;
  const g3 = S.filter((s, i) => i < n * 0.5 && ok(s) && !g2.includes(s) && R3_ANLASS.test(s)).slice(0, 1);
  // R4 Kern: Entscheidungsverb, die zwei Sätze mit der höchsten Faktendichte
  const vor = [...g2, ...g3];
  const kand = S.map((s, i) => [fakten(s), i, s]).filter(([, , s]) => ok(s) && R4_VERB.test(s) && !vor.includes(s));
  kand.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const g4 = kand.slice(0, 2).sort((a, b) => a[1] - b[1]).map(a => a[2]);
  // R5 Zahlen: Betrag oder Prozent mit Vergleichswort
  const vor4 = [...vor, ...g4];
  const g5 = S.filter(s => ok(s) && R5_BETRAG.test(s) && R5_VERGLEICH.test(s) && !vor4.includes(s)).slice(0, 1);
  // R6 Fristen, Inkrafttreten, Genehmigung
  const vor5 = [...vor4, ...g5];
  const g6 = S.filter(s => ok(s) && R6_FRIST.test(s) && !vor5.includes(s)).slice(0, 1);
  const getaggt = [
    ...g2.map(satz => ({regel: 'R2', satz})), ...g3.map(satz => ({regel: 'R3', satz})), ...g4.map(satz => ({regel: 'R4', satz})),
    ...g5.map(satz => ({regel: 'R5', satz})), ...g6.map(satz => ({regel: 'R6', satz}))
  ].slice(0, AUSZUG_MAX);
  return {typ, saetze: getaggt};
}

export const extrahiere = txt => { const r = extrahiereMitRegel(txt); return {typ: r.typ, saetze: r.saetze.map(x => x.satz)}; };
