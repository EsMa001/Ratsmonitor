// Experiment (Stand 09.10.2026): Label aus Titel und Text, nur mit Regeln. Nicht eingebunden.
//
// Stufe 1: die bestehenden Titelregeln (shared/labels.mjs, classifyTopic), unverändert.
// Stufe 2: nur wenn der Titel mehrdeutig ist oder nichts trifft, stimmen die ausgewählten Kernsätze
//          (ris_regeln.py) ab. Jeder Satz wird mit classifyTopic wie ein Titel eingeordnet.
//   zaehlen:   jeder Satz zählt 1 für jedes Label, das er trifft (erste Fassung).
//   gewichtet: Beschlusssätze (R2) zählen 3, Kernsätze (R4) 2, Anlass, Zahlen und Fristen 1.
//
// Aufruf:
//   python3 -B experiments/ris-regeln/beispiele.py > beispiele.json   (im Ordner experiments/ris-regeln)
//   node experiments/ris-regeln/label_aus_text.mjs beispiele.json
import {classifyTopic, labelName} from '../../shared/labels.mjs';
import fs from 'node:fs';

const FORMAL = new Set(['unklar', 'allgemein', 'sitzung']);
const SCHWACH = new Set(['finanzen', 'verwaltung']);
const GEWICHT = {R2: 3, R4: 2, R3: 1, R5: 1, R6: 1};

function entscheide(titel, saetze, gewichtet) {
  const tl = classifyTopic({title: titel});
  const stimmen = {};
  for (const {regel, satz} of saetze) {
    const w = gewichtet ? (GEWICHT[regel] ?? 1) : 1;
    const c = classifyTopic({title: satz});
    for (const l of new Set([c.primary, ...c.secondary])) {
      if (!FORMAL.has(l)) stimmen[l] = (stimmen[l] || 0) + w;
    }
  }
  const stark = Object.entries(stimmen).filter(([l]) => !SCHWACH.has(l)).sort((a, b) => b[1] - a[1]);
  const schwach = Object.entries(stimmen).filter(([l]) => SCHWACH.has(l)).sort((a, b) => b[1] - a[1]);
  const pool = stark.length ? stark : schwach;
  const kandidaten = [tl.primary, ...tl.secondary].filter(l => !FORMAL.has(l));
  const eindeutig = !FORMAL.has(tl.primary) && tl.secondary.filter(l => !SCHWACH.has(l)).length === 0;
  if (eindeutig) return {label: tl.primary, grund: 'Titel eindeutig', titel: tl};
  if (kandidaten.length) {
    const c = kandidaten.map(l => [l, stimmen[l] || 0]).sort((a, b) => b[1] - a[1] || (a[0] === tl.primary ? -1 : 1));
    return {label: c[0][0], grund: 'Titel mehrdeutig: ' + c.map(x => x.join(':')).join(' '), titel: tl};
  }
  if (pool.length && pool[0][1] >= 2 && (pool.length === 1 || pool[0][1] > pool[1][1])) {
    return {label: pool[0][0], grund: 'Titel ohne Treffer: ' + pool.slice(0, 3).map(x => x.join(':')).join(' '), titel: tl};
  }
  return {label: 'unklar', grund: 'auch Text nicht eindeutig' + (pool.length ? ' (' + pool.slice(0, 3).map(x => x.join(':')).join(' ') + ')' : ''), titel: tl};
}

const beispiele = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let abweichend = 0;
for (const e of beispiele) {
  const z = entscheide(e.title, e.sentences, false);
  const g = entscheide(e.title, e.sentences, true);
  const t = z.titel;
  const titel = labelName(t.primary) + (t.secondary.length ? ' (+' + t.secondary.join(',') + ')' : '');
  if (z.label !== g.label) abweichend++;
  console.log(`${e.name}\n   Titel: ${titel}\n   zählen: ${labelName(z.label)} [${z.grund}]\n   gewichtet: ${labelName(g.label)} [${g.grund}]`);
}
console.log(`\n${beispiele.length} Beispiele, bei ${abweichend} unterscheiden sich zählen und gewichtet.`);
