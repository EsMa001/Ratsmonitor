import {env} from 'cloudflare:workers';
import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {requireSameOrigin,AdminError} from '@/server/integrations/admin-access.mjs';
import {pipelineAction} from '@/server/integrations/pipeline-jobs.mjs';
import {runSync} from '@/server/services/sync';
import {analysePending} from '@/server/integrations/manual-analysis.mjs';
export async function POST(request:Request){try{
 requireSameOrigin(request);await requireAdmin();const text=await request.text();// Alle Gebiete des Katalogs als ID-Liste: rund 75.000 Zeichen; der bundesweite Abruf nennt stattdessen regions:'sources'
 if(text.length>200000)throw new AdminError(413,'Anfrage zu groß.');let body;try{body=JSON.parse(text);if(!body||typeof body!=='object'||Array.isArray(body))throw Error();}catch{throw new AdminError(400,'Ungültige Anfrage.');}
 const job=await pipelineAction(env.DB,body,(stage:string,region:string,lookback?:string)=>stage==='analysis'?analysePending(env.DB,region):runSync('metadata',region,'manual',{window:lookback}));
 return Response.json(job,{headers:ADMIN_HEADERS});
 }catch(e){return adminFailure(e);}}
