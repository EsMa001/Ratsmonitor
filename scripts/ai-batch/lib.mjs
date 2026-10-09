// Gemeinsame Teile der Stapelverarbeitung von KI-Aufträgen (Prototyp): Laufordner, Quellen-Cache, Textaufbereitung,
// Sätze mit festen Positionen. Was hier als Text entsteht, ist der „gelesene Text“: Hash, Wortzahl und alle Auszüge
// beziehen sich darauf, damit jeder Beleg wörtlich im Auszug und jeder Auszug wörtlich im gelesenen Text steht.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {getDocumentProxy} from 'unpdf';
import {SOURCE_USER_AGENT} from '../../server/integrations/no-redirect.mjs';
import {decodeText} from '../../server/integrations/website.mjs';
import {htmlToLines} from '../../server/integrations/website-text.mjs';
import {kicShell,kicConfig,kicHeaders} from '../../server/integrations/kic.mjs';
import {normalize} from '../../shared/ai-job.mjs';

export const CONTENT_ROLES=new Set(['paper','minutes','bundle']);
export const MAX_BYTES=60_000_000,READ_PAGES=40;

export function loadJob(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
export function runDir(job,root='.local-backups/ai-runs'){
 const dir=path.join(root,job.id);
 for(const sub of ['cache','packets','answers','results'])fs.mkdirSync(path.join(dir,sub),{recursive:true});
 return dir;
}
export const sha256=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
export const keyOf=url=>crypto.createHash('sha1').update(url).digest('hex').slice(0,16);
export const words=s=>(String(s).match(/\S+/g)||[]).length;
export function readJson(file,fallback=null){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}}
export function writeJson(file,value){fs.writeFileSync(file+'.tmp',JSON.stringify(value));fs.renameSync(file+'.tmp',file);}

/** Datei im Cache, nach den ersten zwei Zeichen des Schlüssels auf Unterordner verteilt (zehntausende Adressen). */
export function cacheFile(dir,url,ext){
 const k=keyOf(url),sub=path.join(dir,'cache',k.slice(0,2)),file=path.join(sub,k+ext),flat=path.join(dir,'cache',k+ext);
 if(!fs.existsSync(file)&&fs.existsSync(flat)){fs.mkdirSync(sub,{recursive:true});fs.renameSync(flat,file);}
 return file;
}
/** Eintrag im Cache: {url,status:'ok'|'error'|'unsupported',kind,fetchedAt,hash,words,pages,error}; Text daneben als .txt. */
export function cached(dir,url,{text=true}={}){
 const meta=readJson(cacheFile(dir,url,'.json'));
 if(!meta)return null;
 if(text&&meta.status==='ok')meta.text=fs.readFileSync(cacheFile(dir,url,'.txt'),'utf8');
 return meta;
}

// Zeilen zu Absätzen: Silbentrennung am Zeilenende auflösen, Zeilen eines Satzes verbinden, Leerzeilen als Absatz.
function paragraphs(lines){
 const out=[];let cur='';
 for(const raw of lines){
  const l=raw.replace(/[\t ]+/g,' ').replace(/ {2,}/g,' ').trim();
  if(!l){if(cur)out.push(cur);cur='';continue;}
  if(!cur){cur=l;continue;}
  if(/\p{Ll}-$/u.test(cur)&&/^\p{Ll}/u.test(l))cur=cur.slice(0,-1)+l;
  else if(/[.:;!?]$/.test(cur)&&/^[\p{Lu}\d„"(]/u.test(l)&&l.length<60||/:$/.test(cur)&&cur.length<40)cur+='\n'+l;
  else cur+=' '+l;
 }
 if(cur)out.push(cur);
 return out.map(p=>p.trim()).filter(Boolean);
}
const tidy=s=>normalize(s).replace(/\n{3,}/g,'\n\n');

/** PDF-Text je Seite; pages[i] ist die Startposition von Seite i+1 im gelesenen Text. Lange Dokumente (Haushaltspläne,
 *  Bebauungspläne mit Gutachten) werden nur bis READ_PAGES gelesen: das Textbudget zeigt ohnehin den Anfang. Text je Seite
 *  wie in unpdf.extractText (Textstücke, Zeilenende bei hasEOL). */
async function pdfText(bytes){
 const pdf=await getDocumentProxy(bytes,{isEvalSupported:false,verbosity:0});
 try{
  const read=Math.min(pdf.numPages,READ_PAGES),text=[];
  for(let i=1;i<=read;i++){const page=await pdf.getPage(i);text.push((await page.getTextContent()).items.filter(x=>x.str!=null).map(x=>x.str+(x.hasEOL?'\n':'')).join(''));page.cleanup?.();}
  let all='';const pages=[];
  for(const page of text){
   const p=paragraphs(String(page).split(/\r\n|\r|\n/)).join('\n\n');
   if(!p.trim()){pages.push(all.length);continue;}
   if(all)all+='\n\n';
   pages.push(all.length);all+=p;
  }
  return {text:tidy(all),pages,pagesTotal:pdf.numPages,pagesRead:read};
 }finally{await (pdf.destroy?pdf.destroy():pdf.loadingTask?.destroy?.());}
}
function jsonText(value){
 // OParl-Objekte: nur sprechende Felder, keine Adressen und Kennungen.
 const keep=['name','reference','paperType','text','description','subject','title'];
 return [...new Set(keep.flatMap(k=>typeof value?.[k]==='string'?[value[k]]:[]))].join('\n\n');
}

// KIC-RIS (komuna u. a.): die Seite eines Tagesordnungspunkts ist eine leere App-Hülle; den angezeigten Sachtext lädt
// sie aus der öffentlichen Gastschnittstelle (web/guestagendaitems/<id>, Textblöcke als Base64-HTML). Gelesen wird
// derselbe Text, den die Seite zeigt; er bleibt der Seitenadresse zugeordnet. Anlagen stehen als eigene Adressen im Auftrag.
const KIC_PAGE=/\/app\/sitzungen\/\d+\/(\d+-\d+)$/;
const kicApps=new Map();
async function kicText(url,timeoutMs){
 const u=new URL(url),id=u.pathname.match(KIC_PAGE)[1],H={'User-Agent':SOURCE_USER_AGENT},sig=()=>AbortSignal.timeout(timeoutMs);
 const appKey=u.origin+u.pathname.split('/app/')[0];
 if(!kicApps.has(appKey))kicApps.set(appKey,(async()=>{
  const html=await (await fetch(url,{headers:H,redirect:'manual',signal:sig()})).text(),shell=kicShell(url,html);
  if(!shell)throw Error('Seite ist keine KIC-Anwendung');
  const cfg=kicConfig(await (await fetch(new URL(shell.version+'/webconfig.json',u.origin+'/').href,{headers:H,redirect:'manual',signal:sig()})).json());
  return {api:cfg.api,headers:{...H,...kicHeaders({...cfg,uniqueId:shell.uniqueId,customName:shell.customName})}};
 })());
 const app=await kicApps.get(appKey);
 const r=await fetch(app.api+'web/guestagendaitems/'+encodeURIComponent(id),{headers:app.headers,redirect:'manual',signal:sig()});
 if(!r.ok)throw Object.assign(Error('Schnittstelle HTTP '+r.status),{http:r.status});
 const item=await r.json();
 if(item.restricted)throw Error('Tagesordnungspunkt nicht öffentlich');
 const blocks=(item.textblocks||[]).map(b=>{
  const html=b.content?new TextDecoder('utf-8').decode(Uint8Array.from(atob(b.content),c=>c.charCodeAt(0))):'';
  const body=paragraphs(htmlToLines(html).flatMap(l=>[l,''])).join('\n\n');
  return body.trim()?(b.caption?b.caption+':\n':'')+body:'';
 }).filter(Boolean);
 return tidy([item.name,...blocks].filter(Boolean).join('\n\n'));
}

/** Lädt eine Adresse einmal (ohne Weiterleitungen über Hostgrenzen, mit Projektkennung) und liefert den gelesenen Text. */
export async function fetchSource(url,{timeoutMs=60000}={}){
 const fetchedAt=new Date().toISOString();
 if(KIC_PAGE.test(new URL(url).pathname))return {url,status:'ok',kind:'page',fetchedAt,text:await kicText(url,timeoutMs),pages:[0],via:'kic-api'};
 let r,target=url;
 for(let hop=0;hop<=3;hop++){
  r=await fetch(target,{redirect:'manual',headers:{'User-Agent':SOURCE_USER_AGENT},signal:AbortSignal.timeout(timeoutMs)});
  if(r.status<300||r.status>=400)break;
  const next=new URL(r.headers.get('location')||'',target);await r.body?.cancel();
  if(next.origin!==new URL(url).origin)throw Object.assign(Error('Weiterleitung auf anderen Host: '+next.origin),{http:r.status});
  target=next.href;
 }
 if(!r.ok){await r.body?.cancel();throw Object.assign(Error('HTTP '+r.status),{http:r.status});}
 const type=r.headers.get('content-type')||'';
 const bytes=new Uint8Array(await r.arrayBuffer());
 if(bytes.byteLength>MAX_BYTES)throw Error('Dokument zu groß ('+bytes.byteLength+' Bytes)');
 const head=new TextDecoder('latin1').decode(bytes.subarray(0,5));
 if(head==='%PDF-'){const p=await pdfText(bytes);return {url,status:'ok',kind:'attachment',fetchedAt,...p};}
 const body=decodeText(bytes,type);
 if(/json/i.test(type)||/^\s*[{[]/.test(body.slice(0,20))){let v=null;try{v=JSON.parse(body);}catch{/* kein JSON */}if(v)return {url,status:'ok',kind:'page',fetchedAt,text:tidy(jsonText(v)),pages:[0]};}
 if(/html|xml/i.test(type)||/<html|<body|<div/i.test(body.slice(0,4000))){
  const text=tidy(paragraphs(htmlToLines(body).flatMap(l=>[l,''])).join('\n\n'));
  // App-Hülle ohne Inhalt (Inhalt kommt per Skript): nicht „kein Sachtext“, sondern nicht lesbar ohne Adapter.
  if(words(text)<15&&/<script/i.test(body))throw Object.assign(Error('Inhalt wird per Skript nachgeladen; Adapter für dieses System fehlt'),{unsupported:true});
  return {url,status:'ok',kind:'page',fetchedAt,text,pages:[0]};
 }
 if(/^text\//i.test(type))return {url,status:'ok',kind:'page',fetchedAt,text:tidy(body),pages:[0]};
 throw Error('Nicht lesbares Format: '+(type||'unbekannt'));
}
export function storeSource(dir,entry){
 const json=cacheFile(dir,entry.url,'.json');fs.mkdirSync(path.dirname(json),{recursive:true});
 if(entry.status==='ok')fs.writeFileSync(cacheFile(dir,entry.url,'.txt'),entry.text,'utf8');
 const {text,...meta}=entry;
 if(entry.status==='ok')Object.assign(meta,{hash:sha256(normalize(text)),words:words(text)});
 writeJson(json,meta);
 return meta;
}
/** Drosselgruppe einer Adresse: die Plattform (letzte zwei Namensteile), nicht der einzelne Host – viele Kommunen
 *  liegen als eigene Hosts auf derselben Plattform (komm.one, owl-it.de, ratsinfomanagement.net), und die sperrt als Ganzes. */
export const platformOf=url=>new URL(url).hostname.split('.').slice(-2).join('.');

// Satzgrenzen: nach . ! ? vor Großbuchstabe/Ziffer/Anführung, nicht nach gängigen Abkürzungen; Absatz ist immer Grenze.
const ABBR=/(?:^|[\s(.])(?:\p{L}|vgl|bzw|bzgl|ggf|ggü|ca|rd|Nr|Abs|Art|gem|lt|inkl|einschl|evtl|bspw|usw|etc|Dr|Prof|Hr|Fr|St|Str|Tel|Anl|TOP|Ziff|lfd|zzgl|ff|max|min|Mio|Mrd|Tsd|Std|Jh|\p{L}*(?:nördl|südl|östl|westl|öffentl|städt|gemeindl|jährl|monatl|tägl))\.$/u;
/** Sätze als {i,start,end} über dem gelesenen Text; Positionen bleiben stabil, solange der Text gleich bleibt. */
export function sentences(text){
 const out=[];let i=0;
 const push=(s,e)=>{while(s<e&&/\s/.test(text[s]))s++;while(e>s&&/\s/.test(text[e-1]))e--;if(e>s)out.push({i:i++,start:s,end:e});};
 const para=/[^\n]+(?:\n(?!\n)[^\n]+)*/g;let m;
 while((m=para.exec(text))){
  const p=m[0],base=m.index;let s=0;
  const re=/[.!?](?=\s+[\p{Lu}\d„"(])/gu;let b;
  while((b=re.exec(p))){
   const before=p.slice(Math.max(0,b.index-12),b.index+1);
   if(ABBR.test(before)||/\d\.$/.test(before)&&/^\s+\d/.test(p.slice(b.index+1)))continue;
   if(b.index+1-s<25)continue;
   push(base+s,base+b.index+1);s=b.index+1;
  }
  // Sehr lange Sätze (Tabellen, Aufzählungen) an Zeilenumbrüchen oder Semikolons teilen, damit Belege kurz bleiben.
  let rest=base+s;const end=base+p.length;
  while(end-rest>600){
   const chunk=text.slice(rest,rest+600),cut=Math.max(chunk.lastIndexOf('\n'),chunk.lastIndexOf('; '),chunk.lastIndexOf(', '));
   const at=cut>200?rest+cut+1:rest+(chunk.lastIndexOf(' ')>200?chunk.lastIndexOf(' '):600);
   push(rest,at);rest=at;
  }
  push(rest,end);
 }
 return out;
}
/** Seite eines Textpunkts (1-basiert) aus den Seitenstarts. */
export const pageAt=(pages,pos)=>{let p=1;for(let k=0;k<(pages||[]).length;k++)if(pages[k]<=pos)p=k+1;return p;};
/** Vergleichsform eines Satzes für das Erkennen inhaltsgleicher Stellen über Quellen hinweg. */
export const fold=s=>s.toLocaleLowerCase('de-DE').normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu,'');
/** Wort-Fünfergruppen eines Satzes; trägt ein Satz überwiegend schon gezeigte Gruppen, ist er eine Wiederholung. */
export function shingles(s){
 const w=s.toLocaleLowerCase('de-DE').normalize('NFKD').match(/[\p{L}\p{N}]+/gu)||[];
 if(w.length<5)return [w.join(' ')];
 const out=[];for(let i=0;i+5<=w.length;i++)out.push(w.slice(i,i+5).join(' '));return out;
}
export const repeated=(s,seen,share=0.7)=>{const sh=shingles(s);if(!sh[0])return true;return sh.filter(x=>seen.has(x)).length>=share*sh.length;};
