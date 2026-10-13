import {parseArgs} from 'node:util';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {openLocalAiWork} from '../server/node/ai-local-runtime.mjs';

export async function runAiLocal(args,{input=process.stdin,output=console.log}={}){
 const {values:v,positionals}=parseArgs({args,allowPositionals:true,options:{database:{type:'string'},store:{type:'string'},regions:{type:'string'},window:{type:'string'},limit:{type:'string'},cursor:{type:'string'},state:{type:'string'},ids:{type:'string'},id:{type:'string'},agent:{type:'string'},token:{type:'string'},source:{type:'string'},page:{type:'string'},offset:{type:'string'},reason:{type:'string'},kind:{type:'string'},help:{type:'boolean'}}});
 if(v.help){output('node scripts/ai-local.mjs list|claim|read|renew|release|submit|fail [--database PFAD] [--store ORDNER]\nlist --regions all --window all --limit 25 [--cursor CURSOR] [--state open]\nclaim --ids ID,ID --agent Codex\nread --id ID [--source QUELLEN_ID --page 1 --offset 0]\nrenew|release --id ID\nsubmit: JSON {id,token,inputHash,result} von stdin\nfail --id ID --kind failed --reason GRUND\nReservierungstoken mit --token oder AI_WORK_TOKEN. Keine Migration, kein Netzwerkabruf.');return;}
 const [action]=positionals;
 if(positionals.length!==1||!['list','claim','read','renew','release','submit','fail'].includes(action))throw new Error('Eine gültige Aktion angeben; Optionen mit --help anzeigen.');
 let body={id:v.id,token:v.token||process.env.AI_WORK_TOKEN};
 if(action==='list')body={regions:v.regions==='all'?'all':(v.regions||'').split(',').filter(Boolean),window:v.window||'all',limit:v.limit?Number(v.limit):25,cursor:v.cursor,state:v.state||'open'};
 if(action==='claim')body={ids:(v.ids||'').split(',').filter(Boolean),agent:v.agent};
 if(action==='read')body={...body,sourceId:v.source,...(v.page?{page:Number(v.page)}:{}),...(v.offset?{offset:Number(v.offset)}:{})};
 if(action==='fail')body={...body,reason:v.reason,kind:v.kind||'failed'};
 if(action==='submit'){
  let size=0;const chunks=[];
  for await(const chunk of input){size+=Buffer.byteLength(chunk);if(size>3_000_000)throw new Error('Ergebnis zu groß.');chunks.push(Buffer.from(chunk));}
  body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('JSON-Objekt erforderlich.');
  body.token??=v.token||process.env.AI_WORK_TOKEN;
 }
 const runtime=openLocalAiWork({file:v.database,directory:v.store||process.env.RM_PDF_STORE||'tmp/pdf-store'});
 try{output(JSON.stringify(await runtime.work[action](body),null,2));}finally{runtime.close();}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 runAiLocal(process.argv.slice(2)).catch(error=>{console.error(JSON.stringify({error:error.message,status:error.status||500}));process.exitCode=1;});
}
