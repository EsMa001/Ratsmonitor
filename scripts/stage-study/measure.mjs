// Misst „Was geschieht“ (shared/stage.mjs) an einer von Hand eingeordneten Stichprobe (tests/fixtures/stage-*.json):
// genau richtig, und je Wert Genauigkeit (vergeben und richtig) und Abdeckung (gefunden von allen dieses Werts).
//   node scripts/stage-study/measure.mjs --set=stage-a [--von=0 --bis=150] [--fehler]
import fs from 'node:fs';
import {stageOf,RULE_STAGES as STAGES,RULE_SONST as SONST} from '../../shared/stage.mjs';
const arg=(k,d)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const ref=JSON.parse(fs.readFileSync(new URL('../../tests/fixtures/'+arg('set','stage-a')+'.json',import.meta.url),'utf8'));
const from=+arg('von',0),to=+arg('bis',1e9),show=process.argv.includes('--fehler');
const rows=ref.rows.map((r,i)=>({...r,i})).slice(from,to).filter(r=>r.gold);
let ok=0;const per=new Map([...STAGES.map(s=>s.id),SONST].map(id=>[id,{tp:0,fp:0,fn:0}]));
for(const r of rows){
 const p=stageOf({title:r.title});
 if(p===r.gold)ok++;else if(show)console.log(String(r.i).padStart(3),p.padEnd(12),'soll',r.gold.padEnd(12),r.title.slice(0,100));
 if(p===r.gold)per.get(p).tp++;else{per.get(p).fp++;per.get(r.gold).fn++;}
}
console.log(`${ref.version} ${from}–${Math.min(to,ref.rows.length)}: ${rows.length} Fälle, genau richtig ${(100*ok/rows.length).toFixed(0)} %`);
const assigned=rows.length-per.get(SONST).tp-per.get(SONST).fp,right=ok-per.get(SONST).tp;
console.log(`mit Wert (nicht sonst): ${assigned} vergeben, davon richtig ${(100*right/assigned).toFixed(0)} %`);
for(const [id,c] of per)if(c.tp+c.fp+c.fn)console.log(`  ${id.padEnd(12)} Genauigkeit ${c.tp+c.fp?(100*c.tp/(c.tp+c.fp)).toFixed(0):'–'} % · Abdeckung ${c.tp+c.fn?(100*c.tp/(c.tp+c.fn)).toFixed(0):'–'} % (${c.tp}/${c.tp+c.fn})`);
