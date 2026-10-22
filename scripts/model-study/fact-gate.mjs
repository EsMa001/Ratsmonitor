// Messung: Fakten an das Modell binden (Fakt-Art → passende Unterthemen bzw. Vorgangsart). Liest Fakten wie readReport aus Titel
// und erster Seite des Hauptdokuments der eingeordneten Stichproben (der volle Text liegt nicht in der Stichprobe) und zählt je Art,
// welche Werte die Bindung behalten bzw. verwerfen würde, nach der Einordnung im Begriffsbuch (gold). Gibt Beispiele der
// verworfenen Werte zum Nachsehen aus.
//   node scripts/model-study/fact-gate.mjs [--show=hebesatz]
import fs from 'node:fs';
import {factsOf} from '../../shared/topic-facts.mjs';
import {FACT_SUBS,factFits} from '../../shared/model/fact-gate.mjs';
const arg=(k,d)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const rows=[...JSON.parse(fs.readFileSync('tests/fixtures/kern-big.json','utf8')).rows,...JSON.parse(fs.readFileSync('tests/fixtures/kern-extra.json','utf8')).rows].filter(r=>r.gold);
const c={},show=arg('show','');
for(const r of rows){
 const m=r.pdfs.find(p=>p.i===r.gold.main),text=[m?.first||'',m?.decision||''].join('\n');
 for(const f of factsOf(r.title,text)){
  if(!FACT_SUBS[f.kind])continue;
  const ok=factFits(f.kind,{kind:r.gold.kind,subs:r.gold.subs||[],process:r.gold.process});
  const x=c[f.kind]=c[f.kind]||{kept:0,dropped:0,ex:[]};ok?x.kept++:x.dropped++;
  if(!ok&&(show===f.kind||!show)&&x.ex.length<6)x.ex.push(`${f.value} | ${r.gold.kind}/${(r.gold.subs||[]).join(',')}/${r.gold.process} | ${r.title.slice(0,90)}`);
 }
}
for(const [k,x] of Object.entries(c).sort((a,b)=>b[1].dropped-a[1].dropped)){console.log(`${k.padEnd(14)} behalten ${x.kept}, verworfen ${x.dropped}`);for(const e of x.ex)console.log('   - '+e);}
