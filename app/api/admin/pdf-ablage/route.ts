import {env} from 'cloudflare:workers';
import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {requireSameOrigin,AdminError} from '@/server/integrations/admin-access.mjs';
import {pdfStoreState,requestPdfJob,JOB_KINDS} from '@/server/integrations/pdf-store-admin.mjs';
// PDF-Ablage (server/integrations/pdf-store-admin.mjs): GET liest Stand und Auftrag, POST {kind:'run'|'retry'} legt einen
// Auftrag an; ausgeführt wird er auf dem Server von scripts/pdf-store/job.mjs.
export async function GET(){try{await requireAdmin();return Response.json(await pdfStoreState(env.DB),{headers:ADMIN_HEADERS});}catch(e){return adminFailure(e);}}
export async function POST(request:Request){try{
 requireSameOrigin(request);await requireAdmin();
 const text=await request.text();if(text.length>256)throw new AdminError(413,'Anfrage zu groß.');
 let kind:unknown;try{kind=JSON.parse(text)?.kind;}catch{throw new AdminError(400,'Ungültige Anfrage.');}
 if(typeof kind!=='string'||!JOB_KINDS.includes(kind))throw new AdminError(400,'Unbekannter Auftrag.');
 return Response.json(await requestPdfJob(env.DB,kind),{headers:ADMIN_HEADERS});
}catch(e){return adminFailure(e);}}
