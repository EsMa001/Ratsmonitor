// Vergleicht die JavaScript-Regeln (shared/ris-auszug.mjs) mit der Python-Vorlage (experiments/ris-regeln/ris_regeln.py)
// auf allen Vorgängen mit Dokumenttext in data/topics.json. Aufruf: node scripts/vergleich-ris-auszug.mjs
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {extrahiereMitRegel} from '../shared/ris-auszug.mjs';
const topics = JSON.parse(fs.readFileSync(new URL('../data/topics.json', import.meta.url), 'utf8')).topics
  .filter(t => (t.hasDocumentText === true || t.hasDocumentText === 'True') && t.sourceText);
const py = `
import json,sys
sys.path.insert(0,'experiments/ris-regeln')
import ris_regeln as R
t=json.load(open('data/topics.json',encoding='utf8'))['topics']
t=[x for x in t if x.get('hasDocumentText') in (True,'True') and x.get('sourceText')]
json.dump([{'id':x['id'],'typ':R.extrahiere_mit_regel(x['sourceText'])[0],'s':[[r,s] for r,s in R.extrahiere_mit_regel(x['sourceText'])[1]]} for x in t],sys.stdout,ensure_ascii=False)`;
const ref = JSON.parse(execFileSync('python3', ['-B', '-c', py], {maxBuffer: 1 << 28}).toString());
let gleich = 0; const abw = [];
topics.forEach((t, i) => {
  const r = extrahiereMitRegel(t.sourceText);
  const a = JSON.stringify([r.typ, r.saetze.map(x => [x.regel, x.satz])]), b = JSON.stringify([ref[i].typ, ref[i].s]);
  if (a === b) gleich++; else abw.push(t.id);
});
console.log(`${gleich} von ${topics.length} identisch`, abw.length ? 'Abweichungen: ' + abw.slice(0, 10).join(', ') : '');
process.exit(abw.length ? 1 : 0);
