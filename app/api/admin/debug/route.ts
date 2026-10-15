import {env} from 'cloudflare:workers';
import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {requireSameOrigin,AdminError} from '@/server/integrations/admin-access.mjs';
import {pipelineDebug,pipelineDebugAction} from '@/server/integrations/pipeline-debug.mjs';
import {triggerJob} from '@/server/integrations/job-trigger.mjs';
// Pipeline-Debug (vorübergehend, server/integrations/pipeline-debug.mjs): GET liest Läufe, Wege der Berichte und Fehlerspeicher;
// POST {action:'release',host} gibt einen wartenden Server frei, {action:'reopen',cls?,step?,host?,key?} öffnet Einträge wieder.
// Beides stößt die Nacharbeit an (job-trigger.mjs), die die Einträge dann versucht (im Fenster 09 bis 23 Uhr).
export async function GET(){try{await requireAdmin();if(!env.DB)throw new AdminError(503,'Datenbank fehlt.');return Response.json(await pipelineDebug(env.DB),{headers:ADMIN_HEADERS});}catch(e){return adminFailure(e);}}
export async function POST(request:Request){try{
 requireSameOrigin(request);await requireAdmin();
 if(!env.DB)throw new AdminError(503,'Datenbank fehlt.');
 const text=await request.text();if(text.length>1024)throw new AdminError(413,'Anfrage zu groß.');
 let body:Record<string,unknown>;try{body=JSON.parse(text)||{};}catch{throw new AdminError(400,'Ungültige Anfrage.');}
 try{const r=await pipelineDebugAction(env.DB,body);await triggerJob('nacharbeit');return Response.json(r,{headers:ADMIN_HEADERS});}
 catch(e){const status=(e as {status?:number}).status;if(status&&status<500)throw new AdminError(status,(e as Error).message);throw e;}
}catch(e){return adminFailure(e);}}
