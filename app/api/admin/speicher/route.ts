import {env} from 'cloudflare:workers';
import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {requireSameOrigin,AdminError} from '@/server/integrations/admin-access.mjs';
import {storageState,requestDiskCount} from '@/server/integrations/server-storage.mjs';
// Speicher & Sicherungen (server/integrations/server-storage.mjs): GET liest die letzte Messung, POST {action:'count',tables?}
// legt den Wunsch „Neu messen“ ab (ausgeführt von scripts/pdf-store/job.mjs auf dem Server).
export async function GET(){try{await requireAdmin();return Response.json(await storageState(env.DB),{headers:ADMIN_HEADERS});}catch(e){return adminFailure(e);}}
export async function POST(request:Request){try{
 requireSameOrigin(request);await requireAdmin();
 const text=await request.text();if(text.length>256)throw new AdminError(413,'Anfrage zu groß.');
 let body:{action?:unknown;tables?:unknown};try{body=JSON.parse(text)||{};}catch{throw new AdminError(400,'Ungültige Anfrage.');}
 if(body.action!=='count')throw new AdminError(400,'Unbekannte Aktion.');
 return Response.json(await requestDiskCount(env.DB,body.tables===true),{headers:ADMIN_HEADERS});
}catch(e){return adminFailure(e);}}
