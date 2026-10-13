// Lernt aus den Titeln der Suchkarten, welches Zeichen an einer Stelle steht, die eine Quelle verloren hat (U+FFFD statt
// ä, ö, ü, ß, §, „ …), und schreibt shared/lost-letters.json (genutzt von shared/lost-letters.mjs, KIC-Import).
// Aufruf: node --max-old-space-size=8000 scripts/learn-lost-letters.mjs [--messen]; --messen lernt an 95 % der Titel,
// prüft an den übrigen und schreibt nichts. Danach Test (tests/lost-letters.test.mjs) und Commit der JSON-Datei.
// Ein Fenster bleibt nur, wenn es in den Titeln mindestens GAIN Stellen mehr richtig setzt als die Fenster, auf die
// restoreLostLetters ohne es zurückfiele (von den kürzesten Fenstern zu den längsten entschieden).
import {DatabaseSync} from 'node:sqlite';
import {existsSync,readdirSync,writeFileSync} from 'node:fs';
import {CANDIDATES,LOST,foldCase,windowKey,wordStart,shapes,letter,inWordChar,restorer} from '../shared/lost-letters.mjs';
const SIDE=3,GAIN=2,ORDER=[...CANDIDATES],SHAPES=shapes(SIDE);
const measure=process.argv.includes('--messen');
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
const local=existsSync(dir)?readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'):null;
const file=process.env.DATABASE_FILE||(local?dir+local:null);
if(!file){console.log('Keine lokale Datenbank gefunden.');process.exit(1);}
const db=new DatabaseSync(file,{readOnly:true});
// Titel mit verlorenen oder falsch gelesenen Zeichen lehren nichts.
const BROKEN=new RegExp(LOST+'|[ÃÂ][\\u0080-\\u00bf\\u0152-\\u0178\\u2018-\\u203a\\u20ac]|\\u00e2\\u20ac');
const titles=[];
for(const r of db.prepare('SELECT title FROM search_cards').iterate()){const t=r.title.replace(/\s+/g,' ').trim();if(/[^\x00-\x7f]/.test(t)&&!BROKEN.test(t))titles.push(t);}
const capital=c=>/\p{Lu}/u.test(c||'');
// Each position of the titles as restoreLostLetters sees it when a source lost all such characters: those before it
// already restored, those after it still lost. In the same order in every pass: callback(characters, position, folded character).
function eachPosition(list,callback){
 for(const t of list){
  const a=[...t],lost=a.map(c=>CANDIDATES.has(foldCase(c)));
  for(let i=0;i<a.length;i++){if(!lost[i])continue;const seen=a.map((c,j)=>j>i&&lost[j]?LOST:c);callback(seen,i,foldCase(a[i]));}
 }
}
function learn(list){
 // 1. How often each window holds each character; its most frequent one.
 const counts=new Map(),cases=new Map();let total=0;
 eachPosition(list,(a,i,c)=>{
  total++;
  for(const [before,after] of SHAPES){const k=windowKey(a,i,before,after);if(!k)continue;let m=counts.get(k);if(!m)counts.set(k,m=new Map());m.set(c,(m.get(c)||0)+1);}
  // Upper or lower case where restoreLostLetters asks the word: an umlaut starting a word inside the text, no capital next to it.
  if('äöü'.includes(c)&&i>0&&!letter(a[i-1])&&!capital(a[i+1])&&!/^[\s"'„“(]*$/.test(a.slice(0,i).join(''))){
   const w=wordStart(a,i,c),up=a[i]!==c;for(let n=1;n<=w.length;n++){let e=cases.get(w.slice(0,n));if(!e)cases.set(w.slice(0,n),e=[0,0]);e[up?1:0]++;}
  }
 });
 const windows=new Map();
 for(const [k,m] of counts){let best=null,n=0;for(const [c,v] of m)if(v>n||(v===n&&ORDER.indexOf(c)<ORDER.indexOf(best))){n=v;best=c;}if(n>=GAIN)windows.set(k,best);}
 counts.clear();
 // 2. From the shortest windows to the longest: what restoreLostLetters sets without a window, and what it sets with it.
 const truth=new Uint8Array(total),answer=new Uint8Array(total).fill(255),inWord=new Uint8Array(total);
 let o=0;eachPosition(list,(a,i,c)=>{truth[o]=ORDER.indexOf(c);inWord[o]=letter(a[i-1])&&letter(a[i+1])?1:0;o++;});
 for(const [before,after] of [...SHAPES].reverse()){
  const gain=new Map(),use=c=>typeof c==='string';
  o=0;eachPosition(list,(a,i)=>{const k=windowKey(a,i,before,after),c=k&&windows.get(k);if(use(c)&&(!inWord[o]||inWordChar(c))){const x=ORDER.indexOf(c);gain.set(k,(gain.get(k)||0)+(truth[o]===x)-(truth[o]===answer[o]));}o++;});
  for(const [k,g] of gain)if(g<GAIN)windows.delete(k);
  o=0;eachPosition(list,(a,i)=>{const k=windowKey(a,i,before,after),c=k&&windows.get(k);if(use(c)&&(!inWord[o]||inWordChar(c)))answer[o]=ORDER.indexOf(c);o++;});
 }
 // Windows never asked (no position reached them) are dropped as well: they set nothing.
 const asked=new Set();eachPosition(list,(a,i)=>{for(const [before,after] of SHAPES){const k=windowKey(a,i,before,after);if(k&&windows.has(k))asked.add(k);}});
 const upper=new Map();for(const [p,[lo,up]] of cases)if(lo+up>=GAIN)upper.set(p,up>lo);
 for(const p of [...upper.keys()].filter(p=>p.length>1&&upper.get(p.slice(0,-1))===upper.get(p)))upper.delete(p);
 const groups={};for(const k of [...asked].sort())(groups[windows.get(k)]??=[]).push(k);
 const words=up=>[...upper].filter(([,u])=>u===up).map(([p])=>p).sort().join('|');
 return {version:2,side:SIDE,gain:GAIN,titles:list.length,windows:Object.fromEntries(ORDER.filter(c=>groups[c]).map(c=>[c,groups[c].join('|')])),upper:words(true),lower:words(false)};
}
if(measure){
 const fnv=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h;};
 const train=[],test=[];for(const t of titles)(fnv(t)%20===0?test:train).push(t);
 const model=learn(train),restore=restorer(model);
 let n=0,exact=0,family=0;const errors=new Map();
 for(const t of test){
  const a=[...t],broken=a.map(c=>CANDIDATES.has(foldCase(c))?LOST:c),r=[...restore(broken.join(''))];
  for(let i=0;i<a.length;i++)if(broken[i]===LOST){n++;if(r[i]===a[i])exact++;else{const k=a[i]+'→'+r[i];errors.set(k,(errors.get(k)||0)+1);}if(foldCase(r[i])===foldCase(a[i]))family++;}
 }
 const pct=x=>(x/n*100).toFixed(2).replace('.',',')+' %';
 console.log(`${test.length} Prüftitel, ${n} verlorene Zeichen: ${pct(exact)} genau, ${pct(family)} bis auf Groß/klein; Modell ${JSON.stringify(model).length>>10} KB`);
 console.log('Häufigste Fehler:',[...errors].sort((a,b)=>b[1]-a[1]).slice(0,15).map(([k,v])=>k+' '+v).join(', '));
}else{
 const json=JSON.stringify(learn(titles));
 writeFileSync('shared/lost-letters.json',json+'\n');
 console.log(`${titles.length} Titel, ${json.length>>10} KB geschrieben: shared/lost-letters.json`);
}
