// Vorprüfung und Lesepakete für das Modell (Prototyp).
// node scripts/ai-batch/pack.mjs <auftrag.json> [--all] [--words 4000] [--max 6] [--article-words 1800] [--force]
// 1. Regelbasierte Vorprüfung ohne Modell (answers/triage.json, Bericht vorpruefung.json):
//    keine Inhaltsquelle und keine TOP-Seite, nur Titel, Bild-PDF ohne Text → insufficient_source;
//    alle Inhaltsquellen mit HTTP-Fehler → failed; nur App-Hüllen ohne Adapter oder noch nicht geladen → offen.
// 2. Übrige Artikel in Auftragsreihenfolge zu Paketen: je Satz eine Kennung <Quelle>.<Satz>, gleiche Sätze einer
//    früheren Quelle desselben Artikels und wiederkehrende Kopf-/Fußzeilen eines Hosts entfallen, Textbudget je Quelle,
//    eine Quelle mehrerer Artikel steht im Paket nur einmal.
// Speicher: Kopfzeilen werden Host für Host ermittelt, Texte bei Bedarf gelesen (kleiner Zwischenspeicher).
import fs from 'node:fs';
import path from 'node:path';
import {loadJob,runDir,cached,sentences,fold,words,writeJson,readJson,shingles,repeated,CONTENT_ROLES} from './lib.mjs';

const args=process.argv.slice(2),opt=n=>{const i=args.indexOf('--'+n);return i<0?null:args[i+1]??true;};
const job=loadJob(args[0]),dir=runDir(job);
const PACKET_WORDS=Number(opt('words')||4000),PACKET_MAX=Number(opt('max')||(opt('retry')?2:6)),ARTICLE_WORDS=Number(opt('article-words')||1800);
const MAIN_WORDS=1200,EXTRA_WORDS=300,SECTION_WORDS=500,MIN_TEXT=40,BOILER_MAX=300;
// --retry: nur die Artikel aus retry.json (vom Zusammenbau), als zusätzliche Pakete R0001 … mit dem Prüfhinweis.
const retry=opt('retry')?new Map((readJson(path.join(dir,'retry.json'))||[]).map(r=>[r.id,r.error])):null;
const sel=retry?[...retry.keys()]:opt('all')?null:readJson(path.join(dir,'selection.json'));
const articles=sel?job.articles.filter(a=>sel.includes(a.id)):job.articles;
const readRole=s=>CONTENT_ROLES.has(s.role)||s.role==='item';
if(retry&&!articles.length){console.log('retry.json ist leer, nichts zu tun.');process.exit(0);}

// Bezahlte Antworten schützen: Pakete mit Antworten nur mit --force neu bauen (Antworten wandern nach answers-alt/).
const answered=fs.readdirSync(path.join(dir,'answers')).filter(f=>/^R?\d+\.json$/.test(f));
if(answered.length&&!retry){
 if(!opt('force')){console.log(`${answered.length} Pakete sind schon beantwortet; Neubau nur mit --force (die Antworten werden nach answers-alt/ verschoben).`);process.exit(2);}
 const alt=path.join(dir,'answers-alt',new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(alt,{recursive:true});
 for(const f of answered)fs.renameSync(path.join(dir,'answers',f),path.join(alt,f));
}

// Texte bei Bedarf, mit kleinem Zwischenspeicher (Auftragsreihenfolge = Gebiet für Gebiet, Quellen wiederholen sich nah).
const lru=new Map();
function source(url){
 if(lru.has(url)){const v=lru.get(url);lru.delete(url);lru.set(url,v);return v;}
 const c=cached(dir,url),v=c?{c,all:c.status==='ok'?sentences(c.text):[]}:null;
 lru.set(url,v);if(lru.size>400)lru.delete(lru.keys().next().value);
 return v;
}

// 1. Wiederkehrende Sätze je Host (Kopf, Fuß, Bedienelemente): kürzer als 300 Zeichen und in mindestens drei
//    verschiedenen Texten (Hash) desselben Hosts. Host für Host, damit nie alle Texte zugleich im Speicher liegen.
// Grundlage sind alle Texte des Auftrags auf den Hosts der Auswahl (bei Stichprobe und Wiederholung sonst zu wenige).
const hosts=new Set(articles.flatMap(a=>a.sources.filter(readRole).map(s=>new URL(s.url).hostname)));
const byHost=new Map();
for(const a of job.articles)for(const s of a.sources)if(readRole(s)){const h=new URL(s.url).hostname;if(!hosts.has(h))continue;if(!byHost.has(h))byHost.set(h,new Set());byHost.get(h).add(s.url);}
const boilerOf=new Map();let t0=Date.now();
for(const [host,set] of byHost){
 const count=new Map();
 for(const url of set){
  const c=cached(dir,url);if(c?.status!=='ok')continue;
  const seenHere=new Set();
  for(const x of sentences(c.text)){
   if(x.end-x.start>=BOILER_MAX)continue;
   const f=fold(c.text.slice(x.start,x.end));if(!f||seenHere.has(f))continue;seenHere.add(f);
   const e=count.get(f);if(!e)count.set(f,[c.hash]);else if(e.length<3&&!e.includes(c.hash))e.push(c.hash);
  }
 }
 const b=new Set();for(const [f,e] of count)if(e.length>=3)b.add(f);
 if(b.size)boilerOf.set(host,b);
}
console.log(`Kopfzeilen: ${byHost.size} Hosts, ${[...boilerOf.values()].reduce((n,b)=>n+b.size,0)} wiederkehrende Sätze, ${Math.round((Date.now()-t0)/1000)} s`);
const boiler=(host,f)=>boilerOf.get(host)?.has(f)||false;
const titleWords=t=>new Set(String(t).toLocaleLowerCase('de-DE').match(/\p{L}{4,}/gu)||[]);

/** Sätze einer Quelle für ein Artikelbudget; seen enthält die Wortgruppen der früheren Quellen des Artikels. */
function select(url,role,{budget,title,seen}){
 const v=source(url);if(v?.c.status!=='ok')return null;
 const {c,all}=v,host=new URL(url).hostname;
 let start=0;
 if(role==='minutes'||role==='bundle'){
  // Abschnitt zu diesem Punkt: Satz mit der größten Überdeckung der Titelwörter.
  const tw=titleWords(title);let best=-1,bestScore=0;
  all.forEach((x,i)=>{const w=titleWords(c.text.slice(x.start,x.end));let n=0;for(const t of tw)if(w.has(t))n++;const sc=tw.size?n/tw.size:0;if(sc>bestScore){bestScore=sc;best=i;}});
  if(bestScore<0.5)return {url,shown:[],total:c.words,note:'Abschnitt zu diesem Punkt nicht gefunden'};
  start=best;budget=Math.min(budget,SECTION_WORDS);
 }
 const shown=[];let n=0,cut=false;
 for(let i=start;i<all.length;i++){
  const x=all[i],t=c.text.slice(x.start,x.end),f=fold(t);
  if(!f||boiler(host,f)||repeated(t,seen))continue;
  const w=words(t);if(n+w>budget&&shown.length){cut=true;break;}
  shown.push({i,t});n+=w;for(const x of shingles(t))seen.add(x);
 }
 return {url,shown,words:n,total:c.words,cut};
}

// 2. Vorprüfung.
const REASON={
 no_source:'Keine Vorlage, Anlage, Niederschrift oder Seite des Tagesordnungspunkts; nur Sitzungs- oder Einladungsseiten.',
 item_title_only:'Die Seite des Tagesordnungspunkts enthält nur den Titel, keinen Sachtext.',
 title_only:'Die Unterlagen enthalten außer Titel und Formalien keinen Sachtext.',
 image_pdf:'Die Vorlage ist ein Bild-PDF ohne Textschicht; kein lesbarer Sachtext.'
};
const triage=[],queue=[],open=[],cls={};
const note=(k,a)=>{(cls[k]??=[]).push(a.id);};
for(const a of articles){
 const content=a.sources.filter(s=>CONTENT_ROLES.has(s.role)),item=a.sources.filter(s=>s.role==='item');
 if(!content.length&&!item.length){triage.push({id:a.id,s:'insufficient_source',r:REASON.no_source,code:'no_source'});note('no_source',a);continue;}
 const read=[...content,...item].map(s=>({s,v:source(s.url)}));
 if(read.some(x=>!x.v)){open.push({id:a.id,r:'Quellen noch nicht geladen'});note('pending',a);continue;}
 const ok=read.filter(x=>x.v.c.status==='ok');
 if(!ok.length&&read.some(x=>x.v.c.status==='unsupported')){open.push({id:a.id,r:read.find(x=>x.v.c.status==='unsupported').v.c.error});note('unsupported',a);continue;}
 if(!ok.length){triage.push({id:a.id,s:'failed',r:'Quellen nicht abrufbar: '+[...new Set(read.map(x=>x.v.c.error))].join('; ').slice(0,300),code:'fetch_failed'});note('fetch_failed',a);continue;}
 // Sachtext: Sätze ohne Titel und ohne wiederkehrende Zeilen.
 const tf=fold(a.title);
 const substance=ok.reduce((n,{s,v})=>n+v.all.filter(x=>{const f=fold(v.c.text.slice(x.start,x.end));return f&&f!==tf&&!boiler(new URL(s.url).hostname,f);}).reduce((m,x)=>m+words(v.c.text.slice(x.start,x.end)),0),0);
 if(substance<MIN_TEXT){
  const code=!content.length?'item_title_only':ok.some(x=>x.v.c.kind==='attachment'&&x.v.c.words===0)?'image_pdf':'title_only';
  triage.push({id:a.id,s:'insufficient_source',r:REASON[code],code});note(code,a);continue;
 }
 queue.push(a);note('model',a);
}

// 3. Pakete in Auftragsreihenfolge.
const packets=[];let cur=null;
const flush=()=>{if(cur&&cur.articles.length)packets.push(cur);cur=null;};
const events=a=>(a.events||[]).map(e=>`${e.date.split('-').reverse().join('.')} ${e.committee}${e.result?' – '+e.result:''}`).join('; ');
for(const a of queue){
 if(!cur)cur={articles:[],sources:new Map(),text:[],words:0};
 const seen=new Set(),refs=[],block=[];let aw=0,first=true;
 const order=[...a.sources.filter(s=>s.role==='paper'),...a.sources.filter(s=>s.role==='minutes'||s.role==='bundle'),...a.sources.filter(s=>s.role==='item')];
 for(const s of order){
  if(cur.sources.has(s.url)){const no=cur.sources.get(s.url).no;refs.push('Q'+no+' (oben)');for(const x of cur.sources.get(s.url).shingles)seen.add(x);continue;}
  const left=ARTICLE_WORDS-aw;if(left<60)break;
  const pick=select(s.url,s.role,{budget:Math.min(left,first?MAIN_WORDS:EXTRA_WORDS),title:a.title,seen});
  if(!pick||!pick.shown.length)continue;
  first=false;
  const no=cur.sources.size+1;
  cur.sources.set(s.url,{no,url:s.url,role:s.role,shownWords:pick.words,shingles:pick.shown.flatMap(x=>shingles(x.t))});
  refs.push('Q'+no);aw+=pick.words;
  block.push(`### Q${no} ${s.role}${s.title?' · '+s.title:''} (${pick.words} von ${pick.total} Wörtern${pick.cut?', gekürzt':''})`);
  for(const x of pick.shown)block.push(`[${no}.${x.i}] ${x.t.replace(/\s*\n\s*/g,' ')}`);
 }
 const hint=retry?.get(a.id);
 const head=[`## ${a.id}`,`Schritte: ${(a.kinds||job.kinds).join(',')}`,`Titel: ${a.title}`,events(a)?`Beratungsfolge: ${events(a)}`:null,`Quellen: ${refs.join(', ')}`,hint?`Hinweis: Die letzte Antwort zu diesem Artikel war ungültig (${hint.slice(0,200)}). Bitte Format und Regeln genau einhalten.`:null].filter(Boolean);
 cur.articles.push({id:a.id,kinds:a.kinds||job.kinds,words:aw,refs:refs.map(r=>Number(r.match(/\d+/)[0]))});
 cur.text.push(head.join('\n'),...block,'');
 cur.words+=aw;
 if(cur.words>=PACKET_WORDS||cur.articles.length>=PACKET_MAX)flush();
}
flush();

// Schreiben: packets/NNNN.md (für das Modell) und NNNN.json (Zuordnung für den Zusammenbau).
const existingR=fs.readdirSync(path.join(dir,'packets')).filter(f=>/^R\d+\.json$/.test(f)).length;
if(!retry)for(const f of fs.readdirSync(path.join(dir,'packets')))fs.unlinkSync(path.join(dir,'packets',f));
packets.forEach((p,k)=>{
 const name=retry?'R'+String(existingR+k+1).padStart(4,'0'):String(k+1).padStart(4,'0');
 fs.writeFileSync(path.join(dir,'packets',name+'.md'),`# Paket ${name}\n\n`+p.text.join('\n'),'utf8');
 writeJson(path.join(dir,'packets',name+'.json'),{articles:p.articles,sources:[...p.sources.values()].map(({shingles,...s})=>s)});
});
if(retry){console.log(`${packets.length} Wiederholungspakete für ${queue.length} Artikel (${articles.length-queue.length} nicht mehr fürs Modell)`);process.exit(0);}
writeJson(path.join(dir,'answers','triage.json'),{agent:'regelbasierte Vorprüfung (scripts/ai-batch)',model:'keines',lines:triage.map(({code,...t})=>t)});
writeJson(path.join(dir,'open.json'),open);
const shown=packets.reduce((n,p)=>n+p.words,0),counts=Object.fromEntries(Object.entries(cls).map(([k,v])=>[k,v.length]));
// Hochrechnung aus der Stichprobe vom 09.10.2026 (Haiku 5.5, effort low): je Artikel 0,0028 USD und 16 s.
const report={at:new Date().toISOString(),articles:articles.length,counts,packets:packets.length,shownWords:shown,avgWords:Math.round(shown/Math.max(1,queue.length)),estimate:{usd:+(queue.length*0.0028).toFixed(2),hoursSequential:+(queue.length*16/3600).toFixed(1)},examples:Object.fromEntries(Object.entries(cls).map(([k,v])=>[k,v.slice(0,5)]))};
writeJson(path.join(dir,'vorpruefung.json'),report);
console.log(JSON.stringify({articles:report.articles,counts,packets:report.packets,avgWords:report.avgWords,estimate:report.estimate}));
