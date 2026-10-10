// Misst Lenas Verstehen gegen tests/fixtures/lena-questions.json: Absicht, Ort, Status, Zeit, Hilfetext.
//   node scripts/lena/measure.mjs [--fehler] [--alle]   (ohne --alle nur die ersten 75 Fragen; die letzten 25 sind zum Endmessen)
import fs from 'node:fs';
import {parseQuestion,LENA_VERSION} from '../../shared/lena/parse.mjs';
import {lookupGlossary} from '../../shared/lena/glossary.mjs';
import {CATALOG} from '../../shared/catalog.mjs';
const ref=JSON.parse(fs.readFileSync(new URL('../../tests/fixtures/lena-questions.json',import.meta.url),'utf8'));
const rows=process.argv.includes('--alle')?ref.rows:ref.rows.slice(0,75);
const now=Date.parse('2026-10-10T12:00:00Z');
const c={intent:0,place:0,placeN:0,status:0,statusN:0,time:0,timeN:0,glossary:0,glossaryN:0,all:0};const bad=[];
for(const r of rows){
 const p=parseQuestion(r.q,CATALOG,now);const errs=[];
 if(p.intent===r.intent)c.intent++;else errs.push('Absicht '+(p.intent||'offen')+' statt '+r.intent);
 const names=p.places.map(x=>x.regions.map(g=>g.name));
 if(r.place||r.place2||r.ambiguous){c.placeN++;
  const ok=r.ambiguous?!!p.ambiguous:(names[0]?.length===1&&names[0][0]===r.place)&&(!r.place2||(names[1]?.length===1&&names[1][0]===r.place2));
  if(ok)c.place++;else errs.push('Ort '+JSON.stringify(names)+' statt '+(r.ambiguous?'Rückfrage':[r.place,r.place2].filter(Boolean).join(' + ')));}
 else if(p.places.length)errs.push('Ort erkannt, keiner erwartet: '+JSON.stringify(names));
 if(r.status){c.statusN++;if(p.status===r.status)c.status++;else errs.push('Status '+(p.status||'keiner')+' statt '+r.status);}
 if(r.time){c.timeN++;if(p.time)c.time++;else errs.push('Zeit nicht erkannt');}else if(p.time)errs.push('Zeit erkannt, keine erwartet: '+p.time.matched);
 if(r.topic&&p.topic!==r.topic)errs.push('Thema „'+p.topic+'“ statt „'+r.topic+'“');
 if(r.glossary){c.glossaryN++;const g=lookupGlossary(r.q);if(g?.title===r.glossary)c.glossary++;else errs.push('Hilfe '+(g?.title||'keine')+' statt '+r.glossary);}
 if(!errs.length)c.all++;else bad.push([r.q,errs]);
}
const n=rows.length,pct=(a,b)=>b?(100*a/b).toFixed(0)+' %':'-';
console.log(LENA_VERSION,'Fragen',n,'| Absicht',c.intent+'/'+n,pct(c.intent,n),'| Ort',c.place+'/'+c.placeN,pct(c.place,c.placeN),'| Status',c.status+'/'+c.statusN,'| Zeit',c.time+'/'+c.timeN,'| Hilfe',c.glossary+'/'+c.glossaryN,'| ganz richtig',c.all+'/'+n,pct(c.all,n));
if(process.argv.includes('--fehler'))for(const [q,e] of bad)console.log('-',q,'→',e.join('; '));
