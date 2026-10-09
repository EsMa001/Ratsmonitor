// Übersetzt die kompakten Modellantworten in das Ergebnisformat ratsmonitor-ai-results-v1 (Prototyp).
// node scripts/ai-batch/assemble.mjs <auftrag.json> [--answers 0001,0002] [--per-file 100]
// Belege kommen als Satzkennungen; Zitat und Auszug werden hier wörtlich aus dem gelesenen Text geschnitten, daher kann
// kein Beleg erfunden oder verändert sein. Jeder Artikel wird mit articleResult aus shared/ai-job.mjs geprüft;
// Zusatzprüfungen (Zahlen nur aus dem Text, Beschluss nur mit Ergebnis) landen als Hinweis in results/report.json.
import fs from 'node:fs';
import path from 'node:path';
import {loadJob,runDir,cached,sentences,pageAt,readJson,writeJson} from './lib.mjs';
import {articleResult,AI_KINDS} from '../../shared/ai-job.mjs';

const args=process.argv.slice(2),opt=n=>{const i=args.indexOf('--'+n);return i<0?null:args[i+1]??true;};
const job=loadJob(args[0]),dir=runDir(job),perFile=Number(opt('per-file')||100);
const byId=new Map(job.articles.map(a=>[a.id,a]));
const only=opt('answers')?.split(',');

/** JSON-Objekte aus einer Antwort, auch mit Codezaun, Zeilenumbrüchen im Objekt oder Text davor und danach. */
export function objects(text){
 const out=[];let depth=0,start=-1,inStr=false,esc=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(inStr){if(esc)esc=false;else if(ch==='\\')esc=true;else if(ch==='"')inStr=false;continue;}
  if(ch==='"'){inStr=true;continue;}
  if(ch==='{'){if(depth===0)start=i;depth++;}
  else if(ch==='}'&&depth>0){depth--;if(depth===0){try{out.push(JSON.parse(text.slice(start,i+1)));}catch{/* unvollständig */}}}
 }
 return out;
}
const sentenceCache=new Map();
function sourceText(url){
 if(!sentenceCache.has(url)){const c=cached(dir,url);sentenceCache.set(url,c?.status==='ok'?{c,s:sentences(c.text)}:null);}
 return sentenceCache.get(url);
}
const numbersOf=s=>(String(s).match(/\d[\d.,]*\d|\d/g)||[]).map(n=>n.replace(/[.,]/g,'')).filter(n=>n.length>=2);
const DECIDED=/\b(beschließt|beschloss|billigt|billigte|genehmigt|genehmigte|lehnt[e]? \S+ ab|stimmt[e]? \S+ zu)\b|\b(hat|haben|wurde|wurden)\b[^.]{0,80}\b(beschlossen|gebilligt|genehmigt|abgelehnt)\b/i;

function build(answer,packet,line){
 const meta=packet.articles.find(a=>a.id===line.id),article=byId.get(line.id);
 if(!meta||!article)throw Error('Artikel nicht im Paket');
 const srcNo=new Map(packet.sources.map(s=>[s.no,s])),cited=new Map(),warnings=[];
 // Kennung "n.s" → Beleg; merkt sich je Quelle die zitierten Sätze für die Auszüge.
 const ref=id=>{
  const m=String(id).match(/^\[?(\d+)\.(\d+)\]?$/);if(!m)throw Error('Ungültige Kennung '+id);
  const src=srcNo.get(Number(m[1]));if(!src||!meta.refs.includes(src.no))throw Error('Quelle Q'+m[1]+' gehört nicht zu diesem Artikel');
  const t=sourceText(src.url),x=t?.s[Number(m[2])];if(!x)throw Error('Satz '+id+' gibt es nicht');
  if(!cited.has(src.url))cited.set(src.url,new Set());cited.get(src.url).add(Number(m[2]));
  let quote=t.c.text.slice(x.start,x.end);if(quote.length>700)quote=quote.slice(0,quote.lastIndexOf(' ',700));
  return {url:src.url,quote,location:t.c.kind==='attachment'?'Seite '+pageAt(t.c.pages,x.start):'Webseite'};
 };
 const checks=ok=>['source_read','process','numbers','neutrality'].map((name,i)=>({name,passed:Array.isArray(ok)&&ok[i]===1}));
 const result={id:article.id,expectedPayloadHash:article.payloadHash,agent:answer.agent,model:answer.model};
 const shownText=()=>meta.refs.map(n=>sourceText(srcNo.get(n).url)?.c.text||'').join('\n');
 for(const kind of meta.kinds){
  const v=line.s?{s:line.s,r:line.r}:line[kind];
  if(!v)throw Error('Schritt '+kind+' fehlt');
  if(v.s&&v.s!=='completed'){result[kind]={status:v.s,reason:String(v.r||'Keine Begründung angegeben.').slice(0,1200)};continue;}
  if(kind==='summary'){
   // Kennungen im Fließtext („… [14.3].“) gehören nicht in die Zusammenfassung: herausnehmen, als Beleg behalten.
   const inline=[],strip=s=>String(s).replace(/\s*\[(\d+\.\d+)\]/g,(m,id)=>{inline.push(id);return '';}).replace(/\s+([.,;:])/g,'$1').trim();
   const k=strip(v.k),l=(v.l||[]).map(strip);
   if(inline.length)warnings.push('Kennungen im Text entfernt: '+inline.length);
   const ids=[...new Set([...(v.b||[]),...inline])].slice(0,10);
   result.summary={status:'completed',shortSummary:k,longSummary:l,evidence:ids.map(ref),checks:checks(line.ok)};
   v.k=k;v.l=l;
   const nums=new Set([...numbersOf(shownText()+'\n'+article.title),...(article.events||[]).flatMap(e=>{const [y,m,d]=e.date.split('-');return [d+m+y,d+m,String(+d)+String(+m)+y,y];})]);
   const odd=numbersOf([v.k,...(v.l||[])].join(' ')).filter(n=>!nums.has(n));
   if(odd.length)warnings.push('Zahlen nicht im Text: '+[...new Set(odd)].join(', '));
   if(DECIDED.test([v.k,...(v.l||[])].join(' '))&&!(article.events||[]).some(e=>e.result))warnings.push('Beschlussformulierung ohne Ergebnis in der Beratungsfolge');
  }else if(kind==='aiLabel'){
   result.aiLabel={status:'completed',primary:v.p,secondary:v.n||[],reason:v.g,evidence:(v.b||[]).map(ref),checks:checks(line.ok)};
  }else if(kind==='keywords'){
   const items=Array.isArray(v)?v:v.items;
   result.keywords={status:'completed',items:items.map(([term,score,reason,id])=>({term,score,reason,evidence:ref(id)})),evidence:[ref(items[0][3])],checks:checks(line.ok)};
  }
 }
 // Auszüge: zusammenhängende zitierte Sätze zu einem Auszug, höchstens 1.600 Zeichen.
 result.sources=[...cited.entries()].map(([url,set])=>{
  const t=sourceText(url),idx=[...set].sort((a,b)=>a-b),runs=[];
  for(const i of idx){const last=runs.at(-1);if(last&&last.at(-1)===i-1&&t.s[i].end-t.s[last[0]].start<=1600)last.push(i);else runs.push([i]);}
  // Höchstens zehn Auszüge je Quelle (Prüfung in ai-job.mjs): benachbarte Auszüge zusammenfassen, solange sie in 1.600 Zeichen passen.
  const spans=runs.map(r=>[t.s[r[0]].start,t.s[r.at(-1)].end]);
  for(let k=0;k<spans.length-1&&spans.length>10;){
   if(spans[k+1][1]-spans[k][0]<=1600){spans[k]=[spans[k][0],spans[k+1][1]];spans.splice(k+1,1);}else k++;
  }
  const src=packet.sources.find(s=>s.url===url);
  return {url,hash:t.c.hash,fetchedAt:t.c.fetchedAt,words:src.shownWords,kind:t.c.kind,excerpts:spans.slice(0,10).map(([s,e])=>t.c.text.slice(s,e).slice(0,1600))};
 });
 // Verbrauch: Paketverbrauch nach gezeigter Wortzahl verteilt (plus Sockel je Artikel), daher „estimated“.
 const u=answer.usage,weight=(meta.words+100)/packet.articles.reduce((n,a)=>n+a.words+100,0);
 result.usage={basis:'estimated',inputTokens:Math.round((u.inputTokens+u.cacheReadTokens+u.cacheWriteTokens)*weight),outputTokens:Math.round(u.outputTokens*weight),cachedTokens:Math.round(u.cacheReadTokens*weight)};
 return {result,warnings};
}
function triageResult(t,answer){
 const article=byId.get(t.id),kinds=article.kinds||job.kinds;
 return {id:t.id,expectedPayloadHash:article.payloadHash,agent:answer.agent,model:answer.model,sources:[],usage:{basis:'measured',inputTokens:0,outputTokens:0},...Object.fromEntries(kinds.map(k=>[k,{status:t.s,reason:t.r}]))};
}

// Je Artikel zählt die erste gültige Antwort (Pakete vor Wiederholungspaketen R…); Fehler nur, wenn keine gültig ist.
const valid=new Map(),errors=[],warnings=[];
const answersDir=path.join(dir,'answers');
const names=fs.readdirSync(answersDir).filter(f=>f.endsWith('.json')).map(f=>f.slice(0,-5)).sort((a,b)=>(a==='triage'?-1:b==='triage'?1:a.localeCompare(b)));
for(const name of names){
 if(only&&!only.includes(name))continue;
 const answer=readJson(path.join(answersDir,name+'.json'));
 if(name==='triage'){for(const t of answer.lines){const r=triageResult(t,answer);try{await articleResult(job,byId.get(t.id),r);valid.set(t.id,r);}catch(e){errors.push({id:t.id,packet:'triage',error:e.message});}}continue;}
 const packet=readJson(path.join(dir,'packets',name+'.json'));
 if(!packet){errors.push({id:'-',packet:name,error:'Paket fehlt'});continue;}
 const lines=objects(answer.text).filter(o=>o.id&&packet.articles.some(a=>a.id===o.id));
 for(const a of packet.articles)if(!valid.has(a.id)&&!lines.some(l=>l.id===a.id))errors.push({id:a.id,packet:name,error:'keine Antwort'});
 for(const line of lines){
  if(valid.has(line.id))continue;
  try{
   const {result,warnings:w}=build(answer,packet,line);
   const prepared=await articleResult(job,byId.get(line.id),result);
   if(prepared.ignored.length)w.push('ignoriert: '+prepared.ignored.join(','));
   valid.set(line.id,result);if(w.length)warnings.push({id:line.id,packet:name,warnings:w});
  }catch(e){errors.push({id:line.id,packet:name,error:e.message});}
 }
}
const ok=[...valid.values()];
// Was später gültig wurde, ist kein Fehler mehr; der Rest geht als Wiederholung an pack.mjs --retry.
const open=errors.filter(e=>!valid.has(e.id));
writeJson(path.join(dir,'retry.json'),open.filter(e=>e.packet!=='triage'&&e.id!=='-').map(({id,error})=>({id,error})));
// Ergebnisdateien zu höchstens perFile Artikeln.
for(const f of fs.readdirSync(path.join(dir,'results')).filter(f=>/^ergebnisse-\d+\.json$/.test(f)))fs.unlinkSync(path.join(dir,'results',f));
for(let i=0;i<ok.length;i+=perFile)fs.writeFileSync(path.join(dir,'results',`ergebnisse-${String(i/perFile+1).padStart(3,'0')}.json`),JSON.stringify({format:'ratsmonitor-ai-results-v1',jobId:job.id,articles:ok.slice(i,i+perFile)},null,1),'utf8');
writeJson(path.join(dir,'results','report.json'),{ok:ok.length,errors:open,warnings});
console.log(`${ok.length} Artikel gültig, ${open.length} offen mit Fehler (retry.json), ${warnings.length} mit Hinweisen`);
for(const e of open.slice(0,40))console.log('FEHLER',e.packet,e.id,e.error.slice(0,160));
for(const w of warnings.slice(0,40))console.log('HINWEIS',w.packet,w.id,w.warnings.join(' | ').slice(0,200));
export {AI_KINDS};
