import {env} from 'cloudflare:workers';
import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {requireSameOrigin,AdminError} from '@/server/integrations/admin-access.mjs';
import {pdfStoreState,requestPdfJob,removePdfJob,requestStop,requestCount} from '@/server/integrations/pdf-store-admin.mjs';
// PDF-Import (server/integrations/pdf-store-admin.mjs): GET liest Stand, Fortschritt, Aufträge und Protokoll. POST legt nur
// Wünsche ab, ausgeführt werden sie auf dem Server (scripts/pdf-store/job.mjs und die Skripte selbst):
// {action:'queue',kind:'run'|'retry'|'others'} (früher nur {kind}), {action:'remove',id}, {action:'stop',lane:'chain'|'ocr'},
// {action:'count'}.
export async function GET(){try{await requireAdmin();return Response.json(await pdfStoreState(env.DB),{headers:ADMIN_HEADERS});}catch(e){return adminFailure(e);}}
export async function POST(request:Request){try{
 requireSameOrigin(request);await requireAdmin();
 const text=await request.text();if(text.length>256)throw new AdminError(413,'Anfrage zu groß.');
 let body:{action?:unknown;kind?:unknown;id?:unknown;lane?:unknown};try{body=JSON.parse(text)||{};}catch{throw new AdminError(400,'Ungültige Anfrage.');}
 const action=body.action??'queue',str=(v:unknown)=>typeof v==='string'?v:'';
 const run=async()=>{
  if(action==='queue')return requestPdfJob(env.DB,str(body.kind));
  if(action==='remove')return removePdfJob(env.DB,str(body.id));
  if(action==='stop')return requestStop(env.DB,str(body.lane));
  if(action==='count')return requestCount(env.DB);
  throw new AdminError(400,'Unbekannte Aktion.');
 };
 try{return Response.json(await run(),{headers:ADMIN_HEADERS});}
 catch(e){const status=(e as {status?:number}).status;if(status&&status<500)throw new AdminError(status,(e as Error).message);throw e;}
}catch(e){return adminFailure(e);}}
