// Mail an den Betreiber aus der Betriebsüberwachung (Bearer IMPORT_TOKEN): scripts/notify-failure.mjs (Fehler einer
// systemd-Einheit) und scripts/ops-check.mjs (tägliche Sammelmail) rufen das auf, weil nur der Webdienst den Postausgang in
// der Kontendatei sieht (server/integrations/operator-notify.mjs). Antwort 200 nur, wenn die Mail verschickt wurde.
import {env} from 'cloudflare:workers';
import {internalCall} from '@/server/services/session';
import {accountsConfig} from '@/server/accounts/config.mjs';
import {notifyOperator} from '@/server/integrations/operator-notify.mjs';
export const dynamic='force-dynamic';
const H={'Cache-Control':'no-store'};
export async function POST(request:Request){
 if(!await internalCall(request))return Response.json({error:'Nicht berechtigt.'},{status:401,headers:H});
 let body:{subject?:unknown;message?:unknown}|null=null;
 try{body=await request.json() as {subject?:unknown;message?:unknown};}catch{return Response.json({sent:false,error:'JSON mit subject und message erwartet.'},{status:400,headers:H});}
 const cfg=accountsConfig(env);
 try{
  const result=await notifyOperator(cfg.db,cfg,{subject:String(body?.subject??''),message:String(body?.message??'')});
  return Response.json(result,{status:result.sent?200:503,headers:H});
 }catch(error){
  console.error('[betrieb] Mail an den Betreiber:',error instanceof Error?error.message:String(error));
  return Response.json({sent:false,reason:'Mail nicht verschickt.'},{status:503,headers:H});
 }
}
