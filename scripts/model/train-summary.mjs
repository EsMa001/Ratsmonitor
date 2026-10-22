// Lernt den Satzkopf der Zusammenfassung (Kernsätze, Begriffsbuch Abschnitt 12) und misst ihn gegen die Regel-Zusammenfassung.
// Je Satzkandidat (server/model/sentences.mjs) zwei Ja/Nein-Fragen: gehört er in die Kurzfassung, gehört er in die Langfassung.
// Merkmale ohne Einbettung (auf dem Server wären es rund 30 Millionen Sätze): Wortteile des Satzes, Abschnitt, Stelle, Länge,
// Zahlen und Beträge, Nähe zum Titel, Satzanfang (shared/model/summary.mjs). Schwellen auf einem Abstimmungsteil (i % 7 == 0),
// danach neu gelernt auf allen Lernberichten; gemessen auf den Prüfberichten (set check).
//   node scripts/model/train-summary.mjs [--out=tmp/model/summary] [--epochs=30]
// Schreibt <out>/summary.json (Gewichte) und shared/model-summary-quality.json (Messwerte).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {candidates} from '../../server/model/sentences.mjs';
import {sentenceFeatures,pickSummary,SUMMARY_FEATURES_VERSION} from '../../shared/model/summary.mjs';
import {buildRuleSummary} from '../../server/integrations/rule-summary.mjs';

const arg=(k,d)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const OUT=arg('out','tmp/model/summary'),EPOCHS=+arg('epochs',30),L2=+arg('l2',3e-3),LR=+arg('lr',0.02);
const data=JSON.parse(fs.readFileSync('tests/fixtures/kern-saetze.json','utf8'));
const rows=data.rows.map((r,i)=>({...r,i,cands:candidates(r.text)})).filter(r=>r.gold);
const test=rows.filter(r=>r.set==='check'),all=rows.filter(r=>r.set!=='check'),tune=all.filter(r=>r.i%7===0),train=all.filter(r=>r.i%7!==0);
console.log('lernen',train.length,'Schwellen',tune.length,'prüfen',test.length);

/* Logistische Regression über dünne Merkmale, zwei Ausgänge (kurz, lang), Adam in Paketen */
function fit(rs){
 const X=[],Y=[];
 for(const r of rs)for(const c of r.cands){X.push(sentenceFeatures(c,r.cands,r.title));Y.push([r.gold.short.includes(c.i)?1:0,r.gold.long.includes(c.i)?1:0]);}
 const cnt=new Map();for(const x of X)for(const f of new Set(x))cnt.set(f,(cnt.get(f)||0)+1);
 const vocab=new Map();for(const [f,n] of cnt)if(n>=3)vocab.set(f,vocab.size);
 const V=vocab.size,W=[new Float64Array(V),new Float64Array(V)],B=[0,0],m=[new Float64Array(V),new Float64Array(V)],v=[new Float64Array(V),new Float64Array(V)];let mb=[0,0],vb=[0,0];
 const S=X.map(x=>[...new Set(x.map(f=>vocab.get(f)).filter(i=>i!==undefined))]);
 let t=0,seed=7;const rnd=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648,idx=[...X.keys()],BS=256;
 for(let e=0;e<EPOCHS;e++){for(let a=idx.length-1;a>0;a--){const b=Math.floor(rnd()*(a+1));[idx[a],idx[b]]=[idx[b],idx[a]];}
  for(let o=0;o<idx.length;o+=BS){t++;const batch=idx.slice(o,o+BS),G=[new Map(),new Map()],gb=[0,0];
   for(const q of batch)for(let k=0;k<2;k++){let z=B[k];for(const j of S[q])z+=W[k][j];const g=(1/(1+Math.exp(-z))-Y[q][k])/batch.length;gb[k]+=g;for(const j of S[q])G[k].set(j,(G[k].get(j)||0)+g);}
   const c1=1-0.9**t,c2=1-0.999**t;
   for(let k=0;k<2;k++){for(const [j,g0] of G[k]){const g=g0+L2*W[k][j];m[k][j]=0.9*m[k][j]+0.1*g;v[k][j]=0.999*v[k][j]+0.001*g*g;W[k][j]-=LR*(m[k][j]/c1)/(Math.sqrt(v[k][j]/c2)+1e-8);}
    mb[k]=0.9*mb[k]+0.1*gb[k];vb[k]=0.999*vb[k]+0.001*gb[k]*gb[k];B[k]-=LR*(mb[k]/c1)/(Math.sqrt(vb[k]/c2)+1e-8);}}}
 // gespeichert: nur Merkmale mit Gewicht
 const keep=[...vocab].filter(([,j])=>Math.abs(W[0][j])>=1e-4||Math.abs(W[1][j])>=1e-4);
 return {bias:B,weights:Object.fromEntries(keep.map(([f,j])=>[f,[+W[0][j].toFixed(5),+W[1][j].toFixed(5)]]))};
}
const probs=(model,r)=>r.cands.map(c=>{let z0=model.bias[0],z1=model.bias[1];for(const f of new Set(sentenceFeatures(c,r.cands,r.title))){const w=model.weights[f];if(w){z0+=w[0];z1+=w[1];}}return {i:c.i,short:1/(1+Math.exp(-z0)),long:1/(1+Math.exp(-z1))};});

/* Messung: Kurzfassung trifft einen Satz der Einordnung; Langfassung Genauigkeit und Abdeckung über Sätze; „keine“ richtig */
function evaluate(rs,choose){
 let nShort=0,hitShort=0,given=0,right=0,want=0,found=0,noneOk=0,n=0,firstOk=0;
 for(const r of rs){n++;const g=r.gold,o=choose(r);
  if(!!o===!g.none)noneOk++;
  if(g.none||!o)continue;
  nShort++;if(o.short.some(i=>g.short.includes(i)))hitShort++;if(g.short.includes(o.short[0]))firstOk++;
  given+=o.long.length;right+=o.long.filter(i=>g.long.includes(i)).length;want+=g.long.length;found+=g.long.filter(i=>o.long.includes(i)).length;}
 const pc=(a,b)=>b?Math.round(100*a/b):null;
 return {n,none:pc(noneOk,n),short:pc(hitShort,nShort),shortFirst:pc(firstOk,nShort),longAcc:pc(right,given),longCov:pc(found,want),both:nShort};
}
const t0=Date.now();
let model=fit(train);
// Schwellen auf dem Abstimmungsteil: „keine“ ab wann, Langfassung ab welcher Wahrscheinlichkeit
let best=null;
for(const tNone of [0.05,0.1,0.15,0.2,0.3])for(const tLong of [0.2,0.3,0.4,0.5]){
 const e=evaluate(tune,r=>pickSummary(r.cands,probs(model,r),{tNone,tLong}));const sc=e.none+e.short+(e.longAcc+e.longCov)/2;
 if(!best||sc>best.sc)best={sc,tNone,tLong};}
console.log('Schwellen',best);
model=fit(all);
const th={tNone:best.tNone,tLong:best.tLong};
const mq=evaluate(test,r=>pickSummary(r.cands,probs(model,r),th));
// Regel auf denselben Berichten: ihre Sätze den Kandidaten zuordnen (gleicher Anfang)
const key=s=>s.toLowerCase().replace(/[^\p{L}\d]+/gu,'').slice(0,40);
const rq=evaluate(test,r=>{const s=buildRuleSummary(r.text,r.title,'2026-10-22');if(!s)return null;const map=new Map(r.cands.map(c=>[key(c.text),c.i]));
 const ids=a=>a.map(x=>map.get(key(x))).filter(i=>i!==undefined);const short=ids(s.short.sentences),long=ids(s.long.sentences);return short.length||long.length?{short:short.length?short:long.slice(0,1),long:[...new Set([...long,...short])]}:null;});
console.log('Modell',JSON.stringify(mq));console.log('Regel ',JSON.stringify(rq));
const json={version:'summary-'+crypto.createHash('sha256').update(JSON.stringify(model)).digest('hex').slice(0,12),features:SUMMARY_FEATURES_VERSION,thresholds:th,trainedAt:new Date().toISOString(),...model};
fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(json));
fs.writeFileSync('shared/model-summary-quality.json',JSON.stringify({version:json.version,measuredAt:new Date().toISOString().slice(0,10),sample:`kern-saetze Prüfberichte (${test.length}, zufällig vom Server 22.10.2026)`,model:mq,rule:rq},null,1)+'\n');
console.log('gespeichert',json.version,Object.keys(model.weights).length,'Merkmale,',((Date.now()-t0)/1000).toFixed(0),'s');
