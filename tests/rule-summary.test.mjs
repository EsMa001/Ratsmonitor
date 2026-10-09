import test from 'node:test';
import assert from 'node:assert/strict';
import {ruleSummary,splitSentences,buildRuleSummary,isLetter,isMinutes,sections} from '../server/integrations/rule-summary.mjs';
import {enrichDocument,sourceFor} from '../server/integrations/documents.mjs';
import {compactSummaryAttempt} from '../server/integrations/compact-summary.mjs';
import {preserveArticleContent} from '../shared/article-record.mjs';

const DOC = `Sitzungsvorlage
Beschlussvorschlag:
Der Finanzzwischenbericht 2025 wird zur Kenntnis genommen.
Sachverhalt:
Der Schwerpunkt liegt dabei auf dem Produktbereich 16 „Allgemeine Finanzwirtschaft“.
Steuerschätzung und Einnahmeentwicklung
Die Mai-Steuerschätzung prognostiziert für alle Gebietskörperschaften erneut erhebliche Mindereinnahmen gegenüber dem Vorjahr. Damit verschärft sich die Finanzlage der Kommunen deutlich.
Für die Jahre 2025 bis 2029 werden insgesamt rund 27 Milliarden Euro weniger Steuereinnahmen er-
wartet, z.B. wegen der schwachen wirtschaftlichen Entwicklung im Land.
Anlage 1: Tabelle`;

test('übernimmt nur Originalsätze, Einleitung vorn, Beschluss enthalten', () => {
  const r = ruleSummary(DOC, { target: 60, max: 90 });
  assert.ok(r.sentences.includes('Der Finanzzwischenbericht 2025 wird zur Kenntnis genommen.'));
  assert.ok(r.sentences[0].startsWith('Die Mai-Steuerschätzung'));
  const flat = DOC.replace(/-\n/g, '').replace(/\s+/g, ' ');
  for (const s of r.sentences) assert.ok(flat.includes(s), s);
});
test('überspringt Bezugssätze und Überschriften, nimmt Betragssatz', () => {
  const r = ruleSummary(DOC, { target: 60, max: 90 });
  assert.ok(!r.sentences.some(s => s.startsWith('Der Schwerpunkt') || s.startsWith('Steuerschätzung und')));
  assert.ok(r.sentences.some(s => s.includes('27 Milliarden Euro')));
});
test('Kürzel und Datum trennen keinen Satz', () => {
  assert.equal(splitSentences('Die Frist endet am 31.12.2025 gem. dem Beschluss und z.B. im Haushaltsjahr darauf. Danach folgt der nächste Satz hier.').length, 2);
});
test('ohne brauchbaren Text keine Zusammenfassung', () => {
  assert.equal(ruleSummary('Seite 1\n\n12 3'), null);
});

test('Güte liegt zwischen 0 und 100; ohne erkennbare Struktur gibt es keine Zusammenfassung', () => {
  const good = buildRuleSummary(DOC, 'Finanzzwischenbericht', '2026-10-09T00:00:00Z');
  assert.ok(good.score > 0 && good.score <= 100 && good.short.score <= 100);
  const flat = 'Ein Satz ohne jede Struktur steht hier im Text und geht lange weiter. Noch ein zweiter Satz folgt direkt danach im Text hier.\nUnd ein dritter Satz gehört auch noch dazu und endet hier ohne Marke.';
  assert.equal(buildRuleSummary(flat, 'Etwas ganz anderes'), null);
});
test('Zusammenfassung wird am Artikel gespeichert und überlebt Quellenaktualisierung', async () => {
  const topic = { title: 'Finanzzwischenbericht', officialTitle: 'Finanzzwischenbericht', sourceText: 'x', longSummary: [], documents: [{ title: 'Vorlage', kind: 'application/pdf', url: 'https://example.org/a.pdf' }] };
  const out = await enrichDocument(topic, async () => DOC);
  assert.equal(out.ruleSummary.generatedBy, 'Regelbasierte Zusammenfassung');
  const stored = await compactSummaryAttempt({ ...topic, metadata: {} }, out, '2026-10-09T00:00:00Z');
  assert.equal(stored.topic.ruleSummary.score, out.ruleSummary.score);
  assert.equal(preserveArticleContent({ ruleSummary: out.ruleSummary }, { title: 'neu' }).ruleSummary.score, out.ruleSummary.score);
});

test('Dokumentquellen werden nach Herkunft und Pfad zugeordnet', () => {
  assert.equal(sourceFor('https://sessionnet.owl-it.de/bad-wildungen/bi/getfile.asp?id=1&type=do').base, 'https://sessionnet.owl-it.de/bad-wildungen/bi/');
  assert.equal(sourceFor('https://evil.example/x.pdf').base, 'https://invalid.local/');
});

test('Briefe und Einwendungen bekommen keine Zusammenfassung, Fraktionsanträge schon', () => {
  const letter = 'Bad Wildungen, den 29. Oktober 2025\nSehr geehrter Herr Schwarz,\nhiermit erhebe ich gemäß § 61 HGO Einwendungen gegen das Protokoll der Sitzung. Ich beantrage daher, diesen Punkt in das Protokoll aufzunehmen. Meine Bitte blieb unbeantwortet, und ich bitte um Prüfung.\nMit freundlichen Grüßen';
  assert.equal(ruleSummary(letter, 'Einwendungen des Stadtverordneten gegen die Niederschrift'), null);
  assert.equal(buildRuleSummary(letter, 'Einwendungen gegen die Niederschrift'), null);
  const motion = 'Sehr geehrter Herr Vorsteher,\nwir bitten, folgenden Antrag zu behandeln.\nAntrag: Der Magistrat wird beauftragt, eine Verkehrszählung in der Straße der Jugend durchzuführen und das Ergebnis vorzulegen.\nBegründung:\nDie Straße wird vermehrt als Abkürzung benutzt, obwohl es eine Verbindung über die Kreisstraße gibt. Wir bitten um Unterstützung des Antrages von allen Fraktionen.';
  assert.ok(ruleSummary(motion, 'Antrag der Fraktion - Verkehrszählung'));
  assert.equal(isLetter(DOC, 'Finanzzwischenbericht', true), false);
});

test('Eine frühere Zusammenfassung bleibt nicht stehen, wenn die Regeln jetzt keine mehr erzeugen', async () => {
  const letter = 'Sehr geehrter Herr Schwarz,\nhiermit erhebe ich Einwendungen gegen das Protokoll. Ich beantrage daher eine Änderung. Meine Bitte blieb unbeantwortet, mir fehlt die Antwort.\nMit freundlichen Grüßen';
  const topic = { title: 'Einwendungen gegen die Niederschrift', sourceText: 'x', longSummary: [], ruleSummary: { score: 50 }, documents: [{ title: 'Vorlage', kind: 'application/pdf', url: 'https://example.org/a.pdf' }] };
  const out = await enrichDocument(topic, async () => letter);
  assert.equal(out.ruleSummary, undefined);
});

test('Auszug nennt Quelle und markiert Lücken zwischen nicht angrenzenden Sätzen', () => {
  const b = buildRuleSummary(DOC, 'Finanzzwischenbericht', '2026-10-09T00:00:00Z', { url: 'https://example.org/a.pdf', title: 'Vorlage' });
  assert.deepEqual(b.source, { url: 'https://example.org/a.pdf', title: 'Vorlage' });
  assert.equal(b.long.gaps.length, b.long.sentences.length);
  assert.equal(b.long.gaps[0], false);
  assert.ok(b.long.gaps.slice(1).some(Boolean));
});

test('Protokolle, Anreden und doppelte Sätze', () => {
  assert.equal(isMinutes('Niederschrift über die öffentliche Sitzung des Rates\nAnwesend: Herr A, Frau B'), true);
  assert.equal(isMinutes(DOC), false);
  const doc = 'Beschlussvorschlag:\nSehr geehrter Herr Bürgermeister, bitte setzen Sie folgenden Antrag auf die Tagesordnung der Ratssitzung.\nDer Magistrat wird beauftragt, die Verkehrszählung in der Straße der Jugend durchzuführen und das Ergebnis vorzulegen.\nSachverhalt:\nDie Straße wird vermehrt als Abkürzung benutzt, obwohl es eine Verbindung über die Kreisstraße gibt. Die Straße wird vermehrt als Abkürzung benutzt, obwohl es eine Verbindung über die Kreisstraße gibt.';
  const r = ruleSummary(doc, 'Verkehrszählung Straße der Jugend', { target: 100, max: 140 });
  assert.ok(!r.sentences.some(x => x.startsWith('Sehr geehrter')));
  assert.equal(new Set(r.sentences).size, r.sentences.length);
});

test('Überschrift und Text in derselben Zeile ohne Doppelpunkt', () => {
  const { facts, decision } = sections('Beschlussvorschlag Der Rat beschließt den Haushalt für das Jahr 2027 in der vorgelegten Fassung.\nSachverhalt und Begründung Die Amtszeit des Bürgermeisters endet mit Ablauf des 30. September 2026.');
  assert.ok(decision.startsWith('Der Rat beschließt'));
  assert.ok(facts.startsWith('Die Amtszeit'));
});

test('Gliederungsziffer vor der Überschrift', () => {
  const { facts } = sections('Sitzungsvorlage 2026/001\nII. Sachverhalt und Begründung\nDie Amtszeit des Bürgermeisters endet mit Ablauf des 30. September 2026.\nAnlagen: keine');
  assert.ok(facts.trim().startsWith('Die Amtszeit'));
});

test('Darstellung der Sach- und Rechtslage ist eine Überschrift', () => {
  const { facts } = sections('Antrag: Der Rat beschließt die Einrichtung einer Anliegerstraße in der Hauptstraße.\nDarstellung der Sach- und Rechtslage: Der Antrag der Fraktion vom 23.03.2026 ist als Anlage beigefügt.\nAnlagen: keine');
  assert.ok(facts.trim().startsWith('Der Antrag der Fraktion'));
});
