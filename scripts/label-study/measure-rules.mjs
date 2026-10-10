// Misst die Titelregeln gegen die von Hand zugeordnete Stichprobe (tests/fixtures/'+(process.argv.find(a=>a.startsWith('--set='))?.slice(6)||'label-reference')+'.json).
import fs from 'node:fs';
import {classifyTopic,CLASSIFIER_VERSION} from '../../shared/labels.mjs';
const ref=JSON.parse(fs.readFileSync(new URL('../../tests/fixtures/'+(process.argv.find(a=>a.startsWith('--set='))?.slice(6)||'label-reference')+'.json',import.meta.url),'utf8'));
let ok=0,open=0,wrong=0;const bad=[];
for(const r of ref.rows){const p=classifyTopic({officialTitle:r.title,title:r.title}).primary;
 if(p===r.gold)ok++;else if(p==='unklar'){open++;bad.push(['offen',r.gold,r.title])}else{wrong++;bad.push([p,r.gold,r.title])}}
const n=ref.rows.length;
console.log(CLASSIFIER_VERSION,'richtig',ok+'/'+n,'('+(100*ok/n).toFixed(0)+' %)','offen',open,'falsch',wrong);
if(process.argv.includes('--fehler'))for(const [p,g,t] of bad)console.log(p.padEnd(11),'soll',g.padEnd(11),t.slice(0,90));
