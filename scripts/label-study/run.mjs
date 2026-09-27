import fs from 'node:fs/promises';
import {labelMessages,validPrediction,PROMPT_VERSION} from '../../shared/label-study.mjs';
const folder=process.argv[2]||'tmp/label-study',flags=process.argv.slice(3);
const limitArg=flags.find(s=>s.startsWith('--limit='));const limit=flags.includes('--all')?Infinity:Number(limitArg?.split('=')[1]||100);
if(!(limit>0))throw Error('Ungültiges Limit');
const apiKey=process.env.OPENAI_API_KEY,model=process.env.OPENAI_LABEL_MODEL||process.env.OPENAI_MODEL;
if(!apiKey||!model)throw Error('OPENAI_API_KEY und OPENAI_LABEL_MODEL/OPENAI_MODEL sicher als Umgebungsvariablen konfigurieren.');
const {manifest,rows}=JSON.parse(await fs.readFile(folder+'/corpus.json','utf8'));
if(manifest.promptVersion!==PROMPT_VERSION)throw Error('Promptversion geändert; neue Studie vorbereiten.');
const prior=new Map();try{for(const line of (await fs.readFile(folder+'/predictions.jsonl','utf8')).trim().split('\n').filter(Boolean)){const p=JSON.parse(line);prior.set(p.id,p);}}catch(e){if(e.code!=='ENOENT')throw e;}
if([...prior.values()].some(p=>p.model!==model))throw Error('Modellwechsel: eigene Studie verwenden.');
let count=0,errors=0;
for(const row of rows){
 const old=prior.get(row.id);if(old?.inputHash===row.inputHash&&old?.model===model&&old?.promptVersion===PROMPT_VERSION&&(old.status==='done'||!flags.includes('--retry-errors')))continue;
 if(count>=limit)break;count++;
 let output={id:row.id,inputHash:row.inputHash,model,promptVersion:PROMPT_VERSION,createdAt:new Date().toISOString(),status:'error'};
 try{
  const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({model,temperature:0,response_format:{type:'json_object'},messages:labelMessages(row.input)}),signal:AbortSignal.timeout(45000)});
  if([401,403,429].includes(r.status))throw Object.assign(Error('Zugang oder Kontingent prüfen'),{stop:true});
  if(!r.ok)throw Error('KI HTTP '+r.status);
  const body=await r.json(),prediction=JSON.parse(body.choices[0].message.content);
  if(!validPrediction(prediction,row.input))throw Error('Label-, Format- oder Belegprüfung fehlgeschlagen');
  output={...output,status:'done',primary:prediction.primary,evidence:prediction.evidence,reason:prediction.reason,usage:body.usage,returnedModel:body.model};
 }catch(e){output.error=e.message;errors++;await fs.appendFile(folder+'/predictions.jsonl',JSON.stringify(output)+'\n');if(e.stop)throw e;if(errors>=10)throw Error('Zehn Fehler: Lauf zur Prüfung gestoppt.');continue;}
 await fs.appendFile(folder+'/predictions.jsonl',JSON.stringify(output)+'\n');
 if(count%100===0)console.log(JSON.stringify({processed:count,errors}));
}
console.log(JSON.stringify({processed:count,errors,model}));
