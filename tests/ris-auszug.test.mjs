import test from 'node:test';
import assert from 'node:assert/strict';
import {extrahiereMitRegel, extrahiere, saetze, vorbereiten, AUSZUG_MAX} from '../shared/ris-auszug.mjs';

const TEXT = `Beschlussvorlage
Stadt Beispielstadt
Seite 1 von 2
Beschlussvorschlag:
Der Rat beschließt, die Kindertageseinrichtung am Wiegandweg mit 5 Gruppen zu errichten. Die Kosten betragen insgesamt 4,2 Mio. € und werden aus dem Haushalt gedeckt.
Begründung
Aufgrund der steigenden Kinderzahlen ist ein zusätzlicher Platzbedarf in dem Stadtteil dringend erforderlich geworden.
Die Verwaltung hat mehrere Standorte im gesamten Stadtgebiet geprüft und die Ergebnisse der Prüfung zusammengestellt.
Die Politik wurde in den vergangenen Monaten mehrfach über den Fortgang der Planungen informiert worden.
Die Trägerschaft wird nach Prüfung der Konzepte an den Verein vergeben, der das Konzept für den Stadtteil vorgelegt hat.
Die Satzung tritt am Tag nach der Bekanntmachung in Kraft und bedarf der Genehmigung der Bezirksregierung.`;

test('wählt Beschluss, Anlass, Kern, Zahlen und Frist als Originalsätze', () => {
  const r = extrahiereMitRegel(TEXT);
  assert.ok(r.saetze.length > 0 && r.saetze.length <= AUSZUG_MAX);
  assert.equal(r.saetze[0].regel, 'R2');
  assert.match(r.saetze[0].satz, /^Der Rat beschließt/);
  assert.ok(r.saetze.some(x => x.regel === 'R6' && /in Kraft/.test(x.satz)));
  assert.ok(r.typ.includes('Beschlussvorlage'));
});

test('jeder Satz steht wörtlich im Text und ist 50 bis 420 Zeichen lang, keiner doppelt', () => {
  const flach = TEXT.replace(/\s+/g, ' ');
  const s = extrahiere(TEXT).saetze;
  for (const x of s) { assert.ok(flach.includes(x), x); assert.ok(x.length >= 50 && x.length <= 420); }
  assert.equal(new Set(s).size, s.length);
});

test('Abkürzungen und Ordnungszahlen trennen keinen Satz', () => {
  const s = saetze('Die Kosten betragen ca. 2 Mio. Euro für die 72. Änderung des Plans. Der Rat beschließt dies.');
  assert.equal(s.length, 2);
  assert.match(s[0], /ca\. 2 Mio\. Euro für die 72\. Änderung/);
});

test('Silbentrennung wird zusammengefügt, Ergänzungsstriche bleiben, Kopfzeilen und Seitenzahlen fallen weg', () => {
  const z = vorbereiten('Kopfzeile\nSeite 1\nDie Er-\nweiterung der Schule wird beschlossen\nEinzelhandels- und\nZentrenkonzept wird fortgeschrieben\nKopfzeile');
  assert.ok(z.includes('Die Erweiterung der Schule wird beschlossen'));
  assert.ok(z.some(l => l.includes('Einzelhandels- und')));
  assert.ok(!z.some(l => /Kopfzeile|Seite 1/.test(l)));
});

test('Wortgrenzen funktionieren mit Umlauten', () => {
  // "übertragen" darf nicht in "Übertragenes" gefunden werden, wohl aber als ganzes Wort
  const r = extrahiereMitRegel('Der Betrieb soll künftig an die Stadtwerke Beispielstadt GmbH übertragen werden, die das Gelände seit 2019 pachtet.');
  assert.equal(r.saetze[0]?.regel, 'R4');
});

test('leerer oder fremder Text ergibt keinen Auszug und wirft nicht', () => {
  assert.deepEqual(extrahiere('').saetze, []);
  assert.deepEqual(extrahiere(null).saetze, []);
  assert.deepEqual(extrahiere('Kurz.').saetze, []);
});

test('Anlass: erster Satz der ersten Hälfte mit Auslösewort', () => {
  const t = 'Aufgrund der steigenden Kinderzahlen ist ein zusätzlicher Platzbedarf im Stadtteil dringend erforderlich. '
    + 'Die Verwaltung hat mehrere Standorte im gesamten Stadtgebiet geprüft und die Ergebnisse zusammengestellt. '
    + 'Die Politik wurde in den vergangenen Monaten mehrfach über den Fortgang der Planungen informiert. '
    + 'Die Ergebnisse liegen dieser Vorlage als Anlage bei und können dort in Ruhe nachgelesen werden.';
  assert.deepEqual(extrahiereMitRegel(t).saetze.map(x => x.regel), ['R3']);
});
