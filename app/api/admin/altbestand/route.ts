import {env} from 'cloudflare:workers';
import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {requireSameOrigin,AdminError} from '@/server/integrations/admin-access.mjs';
import {altbestandState,altbestandAction} from '@/server/integrations/altbestand-admin.mjs';
import {triggerJob} from '@/server/integrations/job-trigger.mjs';
// Seite „Altbestand“ (server/integrations/altbestand-admin.mjs): GET liest Anforderungen, Fortschritt und Fehler des Altbestands;
// POST legt einen Wunsch ab (rückwirkend abrufen, alte Fehler erneut versuchen, OCR, PDF-Auftrag, Regeln) und startet den
// zuständigen Job sofort (job-trigger.mjs). Ausgeführt wird auf dem Server, im Fenster 10 bis 22 Uhr.
export async function GET(){try{await requireAdmin();if(!env.DB)throw new AdminError(503,'Datenbank fehlt.');return Response.json(await altbestandState(env.DB),{headers:ADMIN_HEADERS});}catch(e){return adminFailure(e);}}
export async function POST(request:Request){try{
 requireSameOrigin(request);await requireAdmin();
 if(!env.DB)throw new AdminError(503,'Datenbank fehlt.');
 const text=await request.text();if(text.length>200000)throw new AdminError(413,'Anfrage zu groß.');
 let body:Record<string,unknown>;try{body=JSON.parse(text)||{};}catch{throw new AdminError(400,'Ungültige Anfrage.');}
 try{const r=await altbestandAction(env.DB,body) as {trigger?:string[]};for(const id of r.trigger||[])await triggerJob(id);return Response.json(r,{headers:ADMIN_HEADERS});}
 catch(e){const status=(e as {status?:number}).status;if(status&&status<500)throw new AdminError(status,(e as Error).message);throw e;}
}catch(e){return adminFailure(e);}}
