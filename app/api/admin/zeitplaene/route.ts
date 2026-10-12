import {env} from 'cloudflare:workers';
import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {requireSameOrigin,AdminError} from '@/server/integrations/admin-access.mjs';
import {schedulesState,setSchedule,runScheduleNow,requestScheduleStop} from '@/server/integrations/schedules.mjs';
import {triggerJob,triggerStop} from '@/server/integrations/job-trigger.mjs';
// Jobs & Zeitpläne (server/integrations/schedules.mjs): GET liest Jobs, Einstellungen und letzte Läufe. POST
// {action:'set',id,enabled?,time?,every?} ändert die Einstellung, {action:'now',id} startet den Job sofort (Auslöser
// job-trigger.mjs; ohne Auslöser beim nächsten Aufruf, binnen 10 Minuten), {action:'stop',id} hält einen laufenden Job an
// (Auslöser stop-<job>, systemctl stop auf dem Server). Ausgeführt wird auf dem Server von scripts/schedule.mjs.
export async function GET(){try{await requireAdmin();return Response.json(await schedulesState(env.DB),{headers:ADMIN_HEADERS});}catch(e){return adminFailure(e);}}
export async function POST(request:Request){try{
 requireSameOrigin(request);await requireAdmin();
 const text=await request.text();if(text.length>512)throw new AdminError(413,'Anfrage zu groß.');
 let body:{action?:unknown;id?:unknown;enabled?:unknown;time?:unknown;every?:unknown};try{body=JSON.parse(text)||{};}catch{throw new AdminError(400,'Ungültige Anfrage.');}
 const id=typeof body.id==='string'?body.id:'';
 try{
  if(body.action==='set')return Response.json(await setSchedule(env.DB,id,{enabled:body.enabled as boolean|undefined,time:body.time as string|undefined,every:body.every as number|undefined}),{headers:ADMIN_HEADERS});
  if(body.action==='stop'){const r=await requestScheduleStop(env.DB,id);await triggerStop(id);return Response.json(r,{headers:ADMIN_HEADERS});}
  if(body.action==='now'){const r=await runScheduleNow(env.DB,id);await triggerJob(id);return Response.json(r,{headers:ADMIN_HEADERS});}
 }catch(e){const status=(e as {status?:number}).status;if(status&&status<500)throw new AdminError(status,(e as Error).message);throw e;}
 throw new AdminError(400,'Unbekannte Aktion.');
}catch(e){return adminFailure(e);}}
