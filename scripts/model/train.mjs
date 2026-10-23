// Lernt die Köpfe des Modells (requirements/modell-konzept.md, Begriffsbuch requirements/begriffsbuch-kern.md) und speichert sie.
// Eingaben: eingeordnete Stichproben (tests/fixtures/kern-big.json, kern-extra.json, Zusatztitel theme-*.json) und ihre Einbettungen
// mit dem nachtrainierten Encoder (scripts/model/finetune.py schreibt big-emb, extra-emb, emb mit Endung). Lernen auf den Lernberichten,
// Schwellen auf einem Abstimmungsteil (i % 7 == 0), danach neu gelernt auf allen Lernberichten; gemessen auf den Prüfberichten
// (set check). Jeder Kopf zweistufig: erst aus den Einbettungen, dann die Wortteile als Korrektur.
//   node scripts/model/train.mjs --emb-dir=tmp/ml --suffix=-ft --out=models/heads [--quick]
// Schreibt <out>/heads.json, heads.bin, check.json (Antworten auf die Prüfberichte, für tests/model.test.mjs) und
// shared/model-quality.json (Messwerte für den Admin).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {SUBTOPICS} from '../../shared/themes.mjs';
import {KIND,THEMES,STATUS,PROCESS,STEPS,SERVICE,APPLICANTS,DOCTYPES,INPUT_VERSION,applicantKind,pdfSparse,reportSparse,flags,parts,cat} from '../../shared/model/features.mjs';
import {DENSE_SCALE,loadHeads} from '../../shared/model/heads.mjs';
import {measure,listEval,stepOf} from './measure-lib.mjs';

const arg=(k,d)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const EMB=arg('emb-dir','tmp/ml'),SUF=arg('suffix','-ft'),OUT=arg('out','models/heads'),QUICK=process.argv.includes('--quick');
/* Zweite Nachlieferung (kern-extra2.json, 23.10.2026): Lernberichte zum Lernen, ihre Prüfberichte (check → check2) nie;
   --test=check2 misst auf ihnen statt auf den Prüfberichten von kern-big. --no-quality: shared/model-quality.json nicht schreiben */
const EXTRA2=arg('extra2',''),TEST=arg('test','check'),NO_QUALITY=process.argv.includes('--no-quality');
const EPOCHS=QUICK?2:40,L2=0.001,LR=0.01,BS=128,STICHTAG='2026-10-21',FX='tests/fixtures/';
const loadEmb=name=>{const k=JSON.parse(fs.readFileSync(path.join(EMB,`${name}${SUF}.json`),'utf8')),b=new Float32Array(fs.readFileSync(path.join(EMB,`${name}${SUF}.bin`)).buffer.slice(0));
 const D=b.length/k.length;return {D,map:new Map(k.map((x,i)=>[x,b.subarray(i*D,(i+1)*D)]))};};
const big=loadEmb('big-emb'),D=big.D,emb=big.map,ZERO=new Float32Array(D);
const ext=loadEmb('extra-emb');for(const [k,v] of ext.map)emb.set(k.replace(/^([trp])(\d+)/,(m,a,n)=>a+(100000+ +n)),v);
const titles=loadEmb('emb').map;
if(EXTRA2){const e2=loadEmb('extra2-emb');for(const [k,v] of e2.map)emb.set(k.replace(/^([trp])(\d+)/,(m,a,n)=>a+(200000+ +n)),v);}

// Ein Kopf beim Lernen (Float64): Wortteile W, dicht U, Versatz B; Adam in Paketen, Lernrate fällt (Kosinus), Bremse L2
class Head{
 constructor(classes){this.classes=classes;}
 fit(X,Y,OFF=null){
  const K=this.classes.length,cnt=new Map();for(const x of X)for(const f of new Set(x.s))cnt.set(f,(cnt.get(f)||0)+1);
  this.vocab=new Map();for(const [f,n] of cnt)if(n>=2)this.vocab.set(f,this.vocab.size);
  const V=this.vocab.size,DD=X[0]?.d.length||0,N=X.length;this.V=V;this.DD=DD;
  const S=X.map(x=>[...new Set(x.s.map(f=>this.vocab.get(f)).filter(i=>i!==undefined))]);
  const W=new Float64Array(K*V),U=new Float64Array(K*DD),B=new Float64Array(K),mW=new Float64Array(K*V),vW=new Float64Array(K*V),mU=new Float64Array(K*DD),vU=new Float64Array(K*DD),mB=new Float64Array(K),vB=new Float64Array(K);
  let t=0,seed=12345,lr=LR;const rnd=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648,steps=EPOCHS*Math.ceil(N/BS);
  const ad=(P,m,v,j,g,c1,c2)=>{m[j]=0.9*m[j]+0.1*g;v[j]=0.999*v[j]+0.001*g*g;P[j]-=lr*(m[j]/c1)/(Math.sqrt(v[j]/c2)+1e-8);};
  const idx=[...Array(N).keys()];
  for(let e=0;e<EPOCHS;e++){for(let a=N-1;a>0;a--){const b=Math.floor(rnd()*(a+1));[idx[a],idx[b]]=[idx[b],idx[a]];}
   for(let o=0;o<N;o+=BS){t++;lr=LR*(0.05+0.95*0.5*(1+Math.cos(Math.PI*t/steps)));const batch=idx.slice(o,o+BS),n=batch.length,GU=new Float64Array(K*DD),GB=new Float64Array(K),GW=new Map();
    for(const q of batch){const d=X[q].d,s=S[q];for(let k=0;k<K;k++){let z=B[k]+(OFF?OFF[q][k]:0);const ou=k*DD,ow=k*V;for(const i of s)z+=W[ow+i];for(let j=0;j<DD;j++)z+=U[ou+j]*d[j]*DENSE_SCALE;
     const g=(1/(1+Math.exp(-z))-Y[q][k])/n;GB[k]+=g;for(const i of s)GW.set(ow+i,(GW.get(ow+i)||0)+g);for(let j=0;j<DD;j++)GU[ou+j]+=g*d[j]*DENSE_SCALE;}}
    const c1=1-0.9**t,c2=1-0.999**t;
    for(let j=0;j<K*DD;j++)ad(U,mU,vU,j,GU[j]+L2*U[j],c1,c2);for(let k=0;k<K;k++)ad(B,mB,vB,k,GB[k],c1,c2);
    for(const [j,g] of GW)ad(W,mW,vW,j,g+L2*W[j],c1,c2);}}
  Object.assign(this,{W,U,B});return this;}
 logits(x){const K=this.classes.length,s=[...new Set(x.s.map(f=>this.vocab.get(f)).filter(i=>i!==undefined))],out=[];
  for(let k=0;k<K;k++){let z=this.B[k];for(const i of s)z+=this.W[k*this.V+i];for(let j=0;j<this.DD;j++)z+=this.U[k*this.DD+j]*x.d[j]*DENSE_SCALE;out.push(z);}return out;}
 prob(x){const z=this.logits(this.DD?x:{s:x.s,d:NOD}),out={};this.classes.forEach((c,k)=>{out[c]=1/(1+Math.exp(-z[k]));});return out;}
}
const NOD=new Float32Array(0);
/* Kleine Köpfe (wenige hundert Beispiele): drei Bauarten, auf dem Abstimmungsteil gewählt (zweistufig, gemeinsam, nur Wortteile).
   Bei „Wer“ trennt die Einbettung Parteien kaum („SPD“ und „CDU“ liegen nah), die zweistufige Bauart gibt dann die falsche Richtung vor. */
const SMALL=['step','service','applicants'],VARIANTS=['stack','joint','sparse'];
const fitVariant=(v,classes,X,Y)=>v==='stack'?new Stack(classes).fit(X,Y):v==='joint'?new Head(classes).fit(X,Y):new Head(classes).fit(X.map(x=>({s:x.s,d:NOD})),Y);
class Stack{
 constructor(classes){this.classes=classes;}
 fit(X,Y){this.a=new Head(this.classes).fit(X.map(x=>({s:[],d:x.d})),Y);const off=X.map(x=>this.a.logits({s:[],d:x.d}));
  this.b=new Head(this.classes).fit(X.map(x=>({s:x.s,d:NOD})),Y,off);return this;}
 prob(x){const za=this.a.logits({s:[],d:x.d}),zb=this.b.logits({s:x.s,d:NOD}),out={};this.classes.forEach((c,k)=>{out[c]=1/(1+Math.exp(-(za[k]+zb[k])));});return out;}
}
const argmax=p=>Object.entries(p).sort((a,b)=>b[1]-a[1])[0];

// Berichte: kern-big (Lernen, Abstimmung, Prüfung) und kern-extra (nur Lernen, Schlüssel um 100000 versetzt)
const rows=JSON.parse(fs.readFileSync(FX+'kern-big.json','utf8')).rows.map((r,i)=>({...r,i})).filter(r=>r.gold);
JSON.parse(fs.readFileSync(FX+'kern-extra.json','utf8')).rows.forEach((r,i)=>{if(r.gold)rows.push({...r,i:100000+i,set:'extra'});});
if(EXTRA2)JSON.parse(fs.readFileSync(EXTRA2,'utf8')).rows.forEach((r,i)=>{if(r.gold)rows.push({...r,i:200000+i,set:r.set==='check'?'check2':'extra2'});});
const test=rows.filter(r=>r.set===TEST),trainAll=rows.filter(r=>r.set!=='check'&&r.set!=='check2');
const tune=trainAll.filter(r=>r.i<100000&&r.i%7===0),train=trainAll.filter(r=>!(r.i<100000&&r.i%7===0));
console.log('lernen',train.length,'Schwellen',tune.length,'prüfen',test.length,'Einbettung',D);
const isS=r=>r.gold.kind==='subject';
// Schritt (Begriffsbuch 4b): Planschritt und Schritt der Wärmeplanung übersetzt
const E=k=>emb.get(k)||ZERO,EK=(r,k)=>E(k==='t'?'t'+r.i:k==='r'?'r'+r.i:'p'+r.i+'.'+k.slice(2));

// Zusatztitel der Themenversuche (nur Thema und Unterthema, ohne Titel, die wortgleich unter den Prüfberichten stehen)
const testTitles=new Set(test.map(r=>r.title.toLowerCase())),extra=[],FL=new Float32Array(7);
for(const set of ['theme-dev','theme-val','theme-test','theme-train-a','theme-train-b','theme-train-c','theme-check-a'])
 JSON.parse(fs.readFileSync(FX+set+'.json','utf8')).rows.forEach((r,i)=>{if(!r.gold||testTitles.has(String(r.title).toLowerCase()))return;
  const subs=(r.gold.subs||[]).map(s=>SUBTOPICS.find(x=>x.id.endsWith('.'+s)&&r.gold.themes.includes(x.theme))?.id).filter(Boolean);
  extra.push({x:{s:parts(r.title,''),d:cat(titles.get(set+':'+i)||ZERO,ZERO,ZERO,ZERO,FL)},themes:r.gold.themes,subs});});
console.log('Zusatztitel',extra.length);

const subsAll=[...new Set(trainAll.flatMap(r=>r.gold.subs||[]))].sort(),subsubsAll=[...new Set(trainAll.flatMap(r=>r.gold.subsubs||[]))].sort();
const pdfX=(r,p)=>({s:pdfSparse(r,p),d:EK(r,'p.'+p.i)});
const pdfRows=rs=>rs.flatMap(r=>r.pdfs.map(p=>({r,p})));
let M=null;const F=new Map();
/** Alle Köpfe auf einer Lernmenge; danach Merkmale aller Berichte neu (Haupt- und Ergebnisdokument folgen den Köpfen) */
function build(tr,choice=null){
 const m={};const pr=pdfRows(tr);
 m.doctype=new Stack(DOCTYPES).fit(pr.map(({r,p})=>pdfX(r,p)),pr.map(({r,p})=>DOCTYPES.map(c=>r.gold.doctypes?.[p.i]===c?1:0)));
 const docX=(r,p)=>{const t=m.doctype.prob(pdfX(r,p));return {s:pdfSparse(r,p),d:cat(EK(r,'p.'+p.i),Float32Array.from(DOCTYPES.map(c=>t[c])))};};
 m.document=new Stack(['main','result']).fit(pr.map(({r,p})=>docX(r,p)),pr.map(({r,p})=>[r.gold.main===p.i?1:0,r.gold.result_doc===p.i?1:0]));
 const pick=(r,c)=>{let best=null,bp=0.5;for(const p of r.pdfs){const q=m.document.prob(docX(r,p))[c];if(q>bp){bp=q;best=p.i;}}return best;};
 F.clear();
 for(const r of rows){const main=pick(r,'main'),res=pick(r,'result');
  F.set(r.i,{main,res,x:{s:reportSparse(r,main),d:cat(EK(r,'t'),main!=null?EK(r,'p.'+main):ZERO,res!=null?EK(r,'p.'+res):ZERO,EK(r,'r'),flags(r,main,res,STICHTAG))}});}
 const X=rs=>rs.map(r=>F.get(r.i).x);
 const single=(classes,get,filt)=>{const t=tr.filter(filt);return new Stack(classes).fit(X(t),t.map(r=>classes.map(c=>get(r)===c?1:0)));};
 // kleine Köpfe: alle Bauarten (ohne Wahl) oder die gewählte
 const small=(name,classes,get,filt,list=false)=>{const t=tr.filter(filt),Y=t.map(r=>classes.map(c=>(list?(get(r)||[]).includes(c):get(r)===c)?1:0));
  if(choice)return fitVariant(choice[name],classes,X(t),Y);
  const all={};for(const v of VARIANTS)all[v]=fitVariant(v,classes,X(t),Y);return all;};
 m.kind=single(KIND,r=>r.gold.kind,()=>true);
 m.status=single(STATUS,r=>r.gold.status,()=>true);
 {const t=tr.filter(isS);m.themes=new Stack(THEMES).fit([...X(t),...extra.map(e=>e.x)],[...t.map(r=>THEMES.map(c=>(r.gold.themes||[]).includes(c)?1:0)),...extra.map(e=>THEMES.map(c=>(e.themes||[]).includes(c)?1:0))]);}
 m.process=single(PROCESS,r=>r.gold.process,isS);
 m.project=single(['ja'],r=>r.gold.project?'ja':'nein',isS);
 m.step=small('step',STEPS,stepOf,r=>isS(r)&&!!stepOf(r));
 m.service=small('service',SERVICE,r=>r.gold.service||'none',r=>isS(r)&&r.gold.process==='build');
 m.applicants=small('applicants',APPLICANTS,r=>applicantKind(r.gold.applicants),r=>isS(r)&&r.gold.process==='political'&&!!applicantKind(r.gold.applicants));
 m.subs={};m.subsubs={};
 for(const T of THEMES){const cls=subsAll.filter(x=>x.startsWith(T+'.'));if(!cls.length)continue;
  const t=tr.filter(r=>isS(r)&&(r.gold.themes||[]).includes(T)),ex=extra.filter(e=>(e.themes||[]).includes(T));if(t.length+ex.length<10)continue;
  m.subs[T]=new Stack(cls).fit([...X(t),...ex.map(e=>e.x)],[...t.map(r=>cls.map(c=>(r.gold.subs||[]).includes(c)?1:0)),...ex.map(e=>cls.map(c=>(e.subs||[]).includes(c)?1:0))]);}
 for(const P of [...new Set(subsubsAll.map(x=>x.split('.').slice(0,2).join('.')))]){const cls=subsubsAll.filter(x=>x.startsWith(P+'.'));
  const t=tr.filter(r=>isS(r)&&(r.gold.subs||[]).includes(P));if(t.length<10)continue;
  m.subsubs[P]=new Stack(cls).fit(X(t),t.map(r=>cls.map(c=>(r.gold.subsubs||[]).includes(c)?1:0)));}
 M=m;
}
const t0=Date.now();build(train);console.log('gelernt',((Date.now()-t0)/1000).toFixed(0),'s');

// Schwellen auf dem Abstimmungsteil (bestes Mittel aus Genauigkeit und Abdeckung)
const prob=(h,r)=>h.prob(F.get(r.i).x);
const themesOf=(r,t)=>{const p=prob(M.themes,r),top=argmax(p);return top[1]>=t?Object.entries(p).filter(([c,q])=>c===top[0]||q>=Math.max(t,0.5)).map(([c])=>c):[];};
const subsOf=(r,ths,t)=>ths.flatMap(T=>M.subs[T]?Object.entries(prob(M.subs[T],r)).filter(([,q])=>q>=t).map(([c])=>c):[]);
const subsubsOf=(r,ss,t)=>ss.flatMap(P=>M.subsubs[P]?Object.entries(prob(M.subsubs[P],r)).filter(([,q])=>q>=t).map(([c])=>c):[]);
const best=fn=>{let b=null;for(const t of [0.15,0.2,0.25,0.3,0.35,0.4,0.5]){const v=fn(t);if(!b||v.score>b.score)b={t,...v};}return b;};
const themeEval=(rs,t)=>{let given=0,right=0,want=0,hit=0;for(const r of rs.filter(isS)){const [th,p]=argmax(prob(M.themes,r)),g=r.gold.themes||[];
 if(p>=t){given++;if(g.includes(th))right++;}if(!g.includes('offen')&&g.length){want++;if(p>=t&&g.includes(th))hit++;}}
 const a=given?right/given:0,c=want?hit/want:0;return {acc:a,cov:c,score:a+c?2*a*c/(a+c):0};};
const TH=best(t=>themeEval(tune,t)).t;
const TS=best(t=>listEval(tune.filter(isS),r=>subsOf(r,themesOf(r,TH),t),r=>r.gold.subs)).t;
const TSS=best(t=>listEval(tune.filter(r=>isS(r)&&(r.gold.subs||[]).length),r=>subsubsOf(r,r.gold.subs||[],t),r=>r.gold.subsubs)).t;
console.log('Schwellen',{TH,TS,TSS});
// Bauart der kleinen Köpfe: beste auf dem Abstimmungsteil (Treffer)
const CHOICE={};
for(const name of SMALL){
 const gold=r=>name==='step'?stepOf(r):name==='service'?r.gold.service||'none':applicantKind(r.gold.applicants);
 const rs=tune.filter(r=>isS(r)&&(name==='step'?!!stepOf(r):name==='service'?r.gold.process==='build':r.gold.process==='political'&&!!gold(r)));
 const score=v=>{let ok=0;for(const r of rs)if(argmax(M[name][v].prob(F.get(r.i).x))[0]===gold(r))ok++;return ok/Math.max(1,rs.length);};
 const sc=Object.fromEntries(VARIANTS.map(v=>[v,score(v)]));CHOICE[name]=VARIANTS.reduce((a,b)=>sc[b]>sc[a]?b:a);
 console.log('Bauart',name,JSON.stringify(sc),'→',CHOICE[name],`(${rs.length} Abstimmungsfälle)`);
}
build(trainAll,CHOICE);console.log('neu gelernt auf allen Lernberichten',((Date.now()-t0)/1000).toFixed(0),'s');

// Speichern: Float32, Wortteile ohne Gewicht (alle Klassen unter 1e-4) fallen weg
const floats=[];let off=0;
const put=a=>{const o=[off,a.length];floats.push(Float32Array.from(a));off+=a.length;return o;};
const saveHead=h=>{const K=h.classes.length,keep=[];for(const [f,i] of h.vocab){let m=0;for(let k=0;k<K;k++)m=Math.max(m,Math.abs(h.W[k*h.V+i]));if(m>=1e-4)keep.push([f,i]);}
 const W=new Float32Array(K*keep.length);keep.forEach(([,i],n)=>{for(let k=0;k<K;k++)W[k*keep.length+n]=h.W[k*h.V+i];});
 return {classes:h.classes,DD:h.DD,vocab:keep.map(([f])=>f),W:put(W),U:put(h.U),B:put(h.B)};};
const saveStack=st=>st instanceof Stack?{classes:st.classes,a:saveHead(st.a),b:saveHead(st.b)}:saveHead(st);
const heads={};for(const k of ['doctype','document','kind','status','themes','process','project','step','service','applicants'])heads[k]=saveStack(M[k]);
heads.subs=Object.fromEntries(Object.entries(M.subs).map(([k,v])=>[k,saveStack(v)]));heads.subsubs=Object.fromEntries(Object.entries(M.subsubs).map(([k,v])=>[k,saveStack(v)]));
const bin=Buffer.concat(floats.map(f=>Buffer.from(f.buffer,f.byteOffset,f.byteLength)));
const version='heads-'+crypto.createHash('sha256').update(bin).digest('hex').slice(0,12);
const json={version,input:INPUT_VERSION,variants:CHOICE,encoder:arg('encoder','e5-small-ft1'),dim:D,denseScale:DENSE_SCALE,thresholds:{theme:TH,sub:TS,subsub:TSS},trainedAt:new Date().toISOString(),heads};
fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'heads.json'),JSON.stringify(json));fs.writeFileSync(path.join(OUT,'heads.bin'),bin);
console.log('gespeichert',version,(bin.length/1e6).toFixed(1),'MB Gewichte,',(fs.statSync(path.join(OUT,'heads.json')).size/1e6).toFixed(1),'MB Aufbau');

// Messen auf den Prüfberichten, mit dem gespeicherten Modell (so wie im Betrieb)
const model=loadHeads(json,bin);
const {Q,out}=measure(test,model,EK,STICHTAG);
for(const [k,v] of Object.entries(Q))console.log(k.padEnd(11),JSON.stringify(v));
fs.writeFileSync(path.join(OUT,'check.json'),JSON.stringify({version,today:STICHTAG,rows:test.map(r=>({i:r.i,out:out.get(r.i)}))}));
if(!QUICK&&!NO_QUALITY&&TEST==='check')fs.writeFileSync('shared/model-quality.json',JSON.stringify({version,measuredAt:new Date().toISOString().slice(0,10),sample:'kern-big Prüfberichte (770, zufällig vom Server 21.10.2026)',
 note:'Prüfberichte wurden für die Wahl der Modellvariante mehrfach genutzt; die Werte sind deshalb etwas zu gut (keine frische Stichprobe, Entscheidung 22.10.2026).',quality:Q},null,1)+'\n');
