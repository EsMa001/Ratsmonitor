// Misst die Erkennung von Formalien (Sitzungsablauf f, Sammelpunkt s, Routine r) gegen Sachpunkte (t) an einer von Hand
// eingeordneten Titel-Stichprobe, für jede Regel: „kein Sachpunkt“ erkannt (Genauigkeit, Abdeckung) und, wo die Regel Arten
// trennt, die Art.   node scripts/item-study/measure.mjs --set=item-dev [--fehler=<regel>]
import fs from 'node:fs';
import {FORMAL,NOT_FORMAL} from '../../server/integrations/monitor-search.mjs';
import {classifyTopic} from '../../shared/labels.mjs';
import {routineTitle} from '../../shared/topic-facts.mjs';
import {themeOf} from '../../shared/themes.mjs';
import * as kinds from '../../shared/item-kind.mjs';
const arg=(k,d)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const ref=JSON.parse(fs.readFileSync(new URL('../../tests/fixtures/'+arg('set','item-dev')+'.json',import.meta.url),'utf8'));
const like=(t,p)=>{const s=t.toLowerCase(),x=p.replace(/%/g,'');return p.startsWith('%')?(p.endsWith('%')?s.includes(x):s.endsWith(x)):(p.endsWith('%')?s.startsWith(x):s===x);};
const RULES={
 suche:t=>FORMAL.some(p=>like(t,p))&&!NOT_FORMAL.some(p=>like(t,p))?'f':'t',
 labels:t=>({sitzung:'f',allgemein:'s'})[classifyTopic({title:t,officialTitle:t}).primary]||'t',
 fakten:t=>routineTitle(t)?'r':'t',
 themen:t=>themeOf({title:t}).source==='formal'?'f':'t',
 neu:t=>kinds.itemCode(t),
};
const show=arg('fehler',null);
for(const [name,fn] of Object.entries(RULES)){
 let tp=0,fp=0,fn_=0,exact=0,n=0;const bad=[];
 for(const [i,r] of ref.rows.entries()){
  if(!r.gold)continue;n++;
  const p=fn(r.title),pNo=p!=='t',gNo=r.gold.some(g=>g!=='t'),gYes=r.gold.includes('t');
  if(r.gold.includes(p))exact++;
  if(pNo&&gNo)tp++;else if(pNo&&!gNo){fp++;bad.push([i,p,r.gold.join('/'),r.title]);}else if(!pNo&&!gYes){fn_++;bad.push([i,p,r.gold.join('/'),r.title]);}
 }
 console.log(`${name.padEnd(7)} kein Sachpunkt: Genauigkeit ${(100*tp/(tp+fp)).toFixed(0)} % · Abdeckung ${(100*tp/(tp+fn_)).toFixed(0)} % (${fp} Sachpunkte verworfen, ${fn_} Formalien übersehen) · Art genau ${(100*exact/n).toFixed(0)} %`);
 if(show===name)for(const [i,p,g,t] of bad)console.log('   ',String(i).padStart(3),p,'soll',g.padEnd(5),t.slice(0,90));
}
