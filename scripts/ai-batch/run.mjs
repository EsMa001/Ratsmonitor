// Schickt jedes noch unbeantwortete Paket in einem frischen, werkzeuglosen Aufruf an das Modell (Prototyp).
// node scripts/ai-batch/run.mjs <auftrag.json> [--model claude-haiku-5-5] [--effort low] [--parallel 2] [--only 0001,0002] [--limit N]
// Kein eigener API-Zugang: es läuft der vorhandene Agent (Claude Code, `claude -p`) ohne Werkzeuge, ohne MCP und
// außerhalb des Projektordners, damit weder CLAUDE.md noch Werkzeugbeschreibungen mitgeschickt werden.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {loadJob,runDir,writeJson,readJson} from './lib.mjs';

const args=process.argv.slice(2),opt=n=>{const i=args.indexOf('--'+n);return i<0?null:args[i+1]??true;};
const job=loadJob(args[0]),dir=runDir(job);
const model=opt('model')||'claude-haiku-5-5',parallel=Number(opt('parallel')||2),effort=opt('effort')||'low',thinking=opt('thinking');
const system=fs.readFileSync(new URL('./prompt.md',import.meta.url),'utf8');
const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'plenara-ai-'));
const only=opt('only')?.split(',');

function ask(input){
 return new Promise((resolve,reject)=>{
  const p=spawn('claude',['-p','--model',model,'--tools','','--strict-mcp-config','--setting-sources','','--disable-slash-commands','--no-session-persistence','--system-prompt',system,'--output-format','json',...(effort?['--effort',effort]:[])],{cwd,stdio:['pipe','pipe','pipe'],env:{...process.env,...(thinking!==null?{MAX_THINKING_TOKENS:String(thinking)}:{})}});
  let out='',err='';
  // Ein hängender Aufruf darf den Lauf nicht blockieren.
  const timer=setTimeout(()=>{p.kill();reject(Error('Zeitüberschreitung nach 20 min'));},20*60000);
  p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);
  p.on('error',e=>{clearTimeout(timer);reject(e);});
  p.on('close',code=>{clearTimeout(timer);try{resolve(JSON.parse(out));}catch{reject(Error('Antwort ohne JSON (Exit '+code+'): '+(err||out).slice(0,400)));}});
  p.stdin.end(input,'utf8');
 });
}
// Kosten nach scripts/ai-prices.json (die CLI kennt den Preis von Haiku 5.5 nicht und meldet zu hohe Beträge).
const price=JSON.parse(fs.readFileSync(new URL('../ai-prices.json',import.meta.url),'utf8')).models?.[model];
const usd=t=>price?((t.in+t.cacheWrite)*price.input+t.cacheRead*(price.cachedInput??price.input)+t.out*price.output)/1e6:null;
// Alle Pakete ohne Antwort, Wiederholungspakete (R…) zuletzt; ein Paket, das dreimal scheiterte, wird übersprungen
// (steht in run-failures.json; seine Artikel kommen über assemble → pack --retry einzeln wieder).
const failFile=path.join(dir,'run-failures.json'),fails=readJson(failFile)||{};
const todo=[],d=path.join(dir,'packets');
for(const f of fs.readdirSync(d).filter(f=>f.endsWith('.md')).sort()){
 const name=f.slice(0,-3),target=path.join(dir,'answers',name+'.json');
 if(only&&!only.includes(name))continue;
 if(!fs.existsSync(target)&&(fails[name]?.count||0)<3)todo.push({file:path.join(d,f),target,name});
}
const limit=Number(opt('limit')||0);if(limit)todo.splice(limit);
console.log(`${todo.length} Pakete offen, Modell ${model}, ${parallel} gleichzeitig`);
let total={in:0,cacheRead:0,cacheWrite:0,out:0},halt=null,failed=0;
// Rate- oder Kontingentgrenze: Lauf anhalten statt weiter anzufragen; fortsetzen später mit demselben Befehl.
const LIMIT=/rate.?limit|usage limit|limit reached|overloaded|\b429\b|\b529\b|quota|credit balance/i;
async function worker(){
 while(todo.length&&!halt){
  const t=todo.shift(),started=Date.now();
  try{
   const r=await ask(fs.readFileSync(t.file,'utf8'));
   if(r.is_error){const m=String(r.result);if(LIMIT.test(m))halt=m.slice(0,200);throw Error(m.slice(0,300));}
   const u=r.usage||{},m=Object.keys(r.modelUsage||{})[0]||model;
   writeJson(t.target,{packet:t.name,model:m,agent:'Claude Code (claude -p, scripts/ai-batch)',usage:{inputTokens:u.input_tokens||0,cacheReadTokens:u.cache_read_input_tokens||0,cacheWriteTokens:u.cache_creation_input_tokens||0,outputTokens:u.output_tokens||0,thinkingTokens:u.output_tokens_details?.thinking_tokens||0},cliUsd:r.total_cost_usd??null,ms:Date.now()-started,text:r.result});
   total.in+=u.input_tokens||0;total.cacheRead+=u.cache_read_input_tokens||0;total.cacheWrite+=u.cache_creation_input_tokens||0;total.out+=u.output_tokens||0;
   console.log(`${t.name}: ${u.input_tokens}+${u.cache_read_input_tokens||0}c/${u.cache_creation_input_tokens||0}w ein, ${u.output_tokens} aus, ${Math.round((Date.now()-started)/1000)} s`);
  }catch(e){failed++;if(LIMIT.test(e.message))halt??=e.message.slice(0,200);else{fails[t.name]={count:(fails[t.name]?.count||0)+1,error:e.message.slice(0,300)};writeJson(failFile,fails);}console.log(`${t.name}: FEHLER ${e.message}`);}
 }
}
await Promise.all(Array.from({length:parallel},worker));
fs.rmSync(cwd,{recursive:true,force:true});
const remaining=fs.readdirSync(d).filter(f=>f.endsWith('.md')&&!fs.existsSync(path.join(dir,'answers',f.slice(0,-3)+'.json'))&&(fails[f.slice(0,-3)]?.count||0)<3).length;
const cost=usd(total);
console.log('Summe',JSON.stringify(total),cost!==null?`≈ ${cost.toFixed(3)} USD`:'(Preis unbekannt)');
console.log(`fertig: ${remaining} Pakete offen, ${failed} Fehler in diesem Lauf${halt?', angehalten (Grenze): '+halt:''}`);
