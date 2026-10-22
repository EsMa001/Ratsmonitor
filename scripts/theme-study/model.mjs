// Versuch: gelernte Themen statt Wortlisten. Je Thema ein Ja/Nein-Prüfer (logistische Regression, One-vs-Rest) über Wörter und
// Wortteile (3 bis 5 Buchstaben) des vorbereiteten Titels; Unterthemen genauso, aber nur innerhalb des Themas. Formalien wie in
// themeOf über itemKind (kein Thema). Gemessen wie measure.mjs (nur Titel).
//   node scripts/theme-study/model.mjs --cv=5                         Kreuzvalidierung über theme-dev, -val, -test
//   node scripts/theme-study/model.mjs --train=theme-dev,theme-val --eval=theme-test [--fehler] [--regel] [--save=datei]
//   --paare: erstes Wort und Wortpaare als Merkmale; --cv mit --sets=a,b: Messsätze für die Kreuzvalidierung
//   --regel: Ergebnis der Titelregel (themeOf) als zusätzliches Merkmal; --l2=, --schwelle=, --sub=: Bremse und Schwellen
import fs from 'node:fs';
import {THEMES,SUBTOPICS,OPEN,prepare,themeOf} from '../../shared/themes.mjs';
import {itemKind} from '../../shared/item-kind.mjs';
const arg=(k,d)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const L2=+arg('l2',0.01),TH=+arg('schwelle',0.4),SUB=+arg('sub',0.35),withRule=process.argv.includes('--regel'),pairs=process.argv.includes('--paare');
const load=s=>JSON.parse(fs.readFileSync(new URL('../../tests/fixtures/'+s+'.json',import.meta.url),'utf8')).rows.filter(r=>r.gold);

/** Merkmale eines Titels: ganze Wörter (w:) und Wortteile mit Wortgrenzen (g:) */
export function features(title){
 const out=new Set(),words=prepare(title).toLowerCase().match(/[\p{L}\d]+/gu)||[];
 for(const w of words){if(w.length<2)continue;out.add('w:'+w);const b='<'+w+'>';
  for(let n=3;n<=5;n++)for(let i=0;i+n<=b.length;i++)out.add('g:'+b.slice(i,i+n));}
 if(pairs){const ws=words.filter(w=>w.length>=3);if(ws[0])out.add('f:'+ws[0]);for(let i=0;i+1<ws.length;i++)out.add('p:'+ws[i]+'_'+ws[i+1]);}
 if(withRule){const r=themeOf({title});if(r.theme!==OPEN)out.add('r:'+r.theme);for(const s of r.subs)out.add('r:'+s);}
 return [...out];
}
/** Ein Ja/Nein-Prüfer je Klasse, gemeinsam gelernt (Adam, volle Stapel). rows: [{f:[Merkmale], y:Set(Klassen)}] */
function train(rows,classes,{l2=L2,epochs=300,minCount=2}={}){
 const count=new Map();for(const r of rows)for(const f of r.f)count.set(f,(count.get(f)||0)+1);
 const vocab=new Map();for(const [f,n] of count)if(n>=minCount)vocab.set(f,vocab.size);
 const X=rows.map(r=>r.f.map(f=>vocab.get(f)).filter(i=>i!==undefined)),V=vocab.size,K=classes.length,N=rows.length;
 const W=new Float64Array(K*V),B=new Float64Array(K),m=new Float64Array(K*V),v=new Float64Array(K*V),mb=new Float64Array(K),vb=new Float64Array(K);
 const Y=rows.map(r=>classes.map(c=>r.y.has(c)?1:0));
 for(let e=1;e<=epochs;e++){
  const G=new Float64Array(K*V),GB=new Float64Array(K);
  for(let n=0;n<N;n++)for(let k=0;k<K;k++){let z=B[k];for(const i of X[n])z+=W[k*V+i];const d=(1/(1+Math.exp(-z))-Y[n][k])/N;GB[k]+=d;for(const i of X[n])G[k*V+i]+=d;}
  const lr=0.05,b1=0.9,b2=0.999,c1=1-b1**e,c2=1-b2**e;
  for(let j=0;j<K*V;j++){const g=G[j]+l2*W[j];m[j]=b1*m[j]+(1-b1)*g;v[j]=b2*v[j]+(1-b2)*g*g;W[j]-=lr*(m[j]/c1)/(Math.sqrt(v[j]/c2)+1e-8);}
  for(let k=0;k<K;k++){const g=GB[k];mb[k]=b1*mb[k]+(1-b1)*g;vb[k]=b2*vb[k]+(1-b2)*g*g;B[k]-=lr*(mb[k]/c1)/(Math.sqrt(vb[k]/c2)+1e-8);}
 }
 return {classes,vocab,W,B};
}
const scores=(model,f)=>{const V=model.vocab.size,ix=f.map(x=>model.vocab.get(x)).filter(i=>i!==undefined);
 return model.classes.map((c,k)=>{let z=model.B[k];for(const i of ix)z+=model.W[k*V+i];return [c,1/(1+Math.exp(-z))];}).sort((a,b)=>b[1]-a[1]);};

const subTheme=id=>SUBTOPICS.find(s=>s.id===id)?.theme;
const fullSubs=r=>r.gold.subs.map(s=>SUBTOPICS.find(x=>x.id.endsWith('.'+s)&&r.gold.themes.includes(x.theme))?.id).filter(Boolean);
/** Lernt Themen- und Unterthemen-Prüfer aus Messsatz-Zeilen */
export function fit(rows){
 const subj=rows.filter(r=>itemKind(r.title)==='subject').map(r=>({f:features(r.title),y:new Set(r.gold.themes.filter(t=>t!==OPEN)),subs:fullSubs(r)}));
 const themes=train(subj,THEMES.map(t=>t.id)),subs={};
 for(const t of THEMES){const rs=subj.filter(r=>r.y.has(t.id));if(rs.length<5)continue;
  subs[t.id]=train(rs.map(r=>({f:r.f,y:new Set(r.subs)})),SUBTOPICS.filter(s=>s.theme===t.id).map(s=>s.id));}
 return {themes,subs};
}
/** Wahrscheinlichkeit je Thema und je Unterthema (für Mischungen mit anderen Modellen) */
export function themeScores(model,title){const f=features(title);return {themes:Object.fromEntries(scores(model.themes,f)),subs:Object.fromEntries(Object.values(model.subs).flatMap(m=>scores(m,f)))};}
export function predict(model,title){
 if(itemKind(title)!=='subject')return {theme:OPEN,subs:[],p:0};
 const f=features(title),[[theme,p]]=scores(model.themes,f);
 if(p<TH)return {theme:OPEN,subs:[],p};
 const sm=model.subs[theme];let subs=[];
 if(sm){const s=scores(sm,f);subs=s.filter(([,q],i)=>i===0||q>=SUB).filter(([,q])=>q>=SUB*0.6).map(([c])=>c);}
 return {theme,subs,p};
}
/** Zählt wie measure.mjs */
function measure(model,rows,bad){
 const c={n:0,themed:0,mustRight:0,given:0,right:0,wrong:0,alarm:0,missed:0,subGiven:0,subRight:0,subWant:0,subHit:0};
 for(const r of rows){c.n++;const p=predict(model,r.title),g=r.gold,must=!g.themes.includes(OPEN),ok=g.themes.includes(p.theme);
  if(must){c.themed++;if(ok)c.mustRight++;}
  if(p.theme!==OPEN){c.given++;if(ok)c.right++;else if(g.themes.some(t=>t!==OPEN)){c.wrong++;bad?.push(['falsch',p,g,r.title]);}else{c.alarm++;bad?.push(['fehlalarm',p,g,r.title]);}}
  else if(!ok){c.missed++;bad?.push(['fehlt',p,g,r.title]);}
  if(ok&&p.theme!==OPEN){const want=g.subs,got=p.subs.map(s=>s.split('.')[1]);c.subGiven+=got.length;c.subRight+=got.filter(s=>want.includes(s)).length;
   if(want.length){c.subWant++;if(got.some(s=>want.includes(s)))c.subHit++;}}
 }
 return c;
}
const add=(a,b)=>{for(const k in b)a[k]=(a[k]||0)+b[k];return a;};
const pc=(a,b)=>b?(100*a/b).toFixed(0)+' %':'–';
const show=(label,c)=>{console.log(`${label}: ${c.n} Vorgänge, ${c.themed} sicher mit Thema`);
 console.log(`Thema   Genauigkeit ${pc(c.right,c.given)} (${c.right}/${c.given}) · Abdeckung ${pc(c.mustRight,c.themed)} (${c.mustRight}/${c.themed}) · falsches Thema ${c.wrong} · Formalie mit Thema ${c.alarm} · nicht erkannt ${c.missed}`);
 console.log(`Unterth. Genauigkeit ${pc(c.subRight,c.subGiven)} (${c.subRight}/${c.subGiven}) · Abdeckung ${pc(c.subHit,c.subWant)} (${c.subHit}/${c.subWant})`);};

if(import.meta.url===`file://${process.argv[1]}`){
 const cv=+arg('cv',0);
 if(cv){
  // Gleiche Aufteilung bei jedem Lauf: nach Reihenfolge der Zeilen, jede k-te in denselben Teil
  const all=arg('sets','theme-dev,theme-val,theme-test').split(',').flatMap(load),tot={},short={};
  for(let k=0;k<cv;k++){const test=all.filter((_,i)=>i%cv===k),model=fit(all.filter((_,i)=>i%cv!==k).filter((_,i)=>i%100<100*(+arg('anteil',1))));
   add(tot,measure(model,test));add(short,measure(model,test.filter(r=>(prepare(r.title).match(/[\p{L}\d]+/gu)||[]).length<=4)));}
  show(`Modell${withRule?' + Regel':''}, ${cv}-fache Kreuzvalidierung`,tot);show('  davon kurze Titel (bis 4 Wörter)',short);
 }else{
  const model=fit(arg('train','theme-dev,theme-val').split(',').flatMap(load)),set=arg('eval','theme-test'),bad=[];
  show(`Modell${withRule?' + Regel':''} auf ${set}`,measure(model,load(set),bad));
  if(process.argv.includes('--fehler'))for(const [k,p,g,t] of bad)console.log(k.padEnd(10),(p.theme+' '+p.p.toFixed(2)).padEnd(16),'soll',g.themes.join('/').padEnd(22),t.slice(0,80));
  const save=arg('save','');if(save){const dump=m=>({classes:m.classes,bias:[...m.B],weights:Object.fromEntries([...m.vocab].map(([f,i])=>[f,m.classes.map((_,k)=>+m.W[k*m.vocab.size+i].toFixed(3))]).filter(([,w])=>w.some(x=>Math.abs(x)>=0.01)))});
   fs.writeFileSync(save,JSON.stringify({themes:dump(model.themes),subs:Object.fromEntries(Object.entries(model.subs).map(([t,m])=>[t,dump(m)]))}));console.log('gespeichert',save,(fs.statSync(save).size/1024).toFixed(0)+' KB');}
 }
}
