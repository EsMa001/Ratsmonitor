import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {claimAdmin,requireSameOrigin,AdminError} from '@/server/integrations/admin-access.mjs';
import {adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {accountsConfig} from '@/server/accounts/config.mjs';
export async function POST(request:Request){try{
 // Nur auf dem alten Weg (ChatGPT-Kopfzeilen); mit Konten vergibt die Kommandozeile die Rolle admin
 if(!accountsConfig(env).legacyHeader)return Response.json({error:'Nicht gefunden.'},{status:404,headers:ADMIN_HEADERS});requireSameOrigin(request);const text=await request.text();if(text.length>1024)throw new AdminError(413,'Anfrage zu groß.');let body;try{body=JSON.parse(text);if(!body||typeof body!=='object'||Array.isArray(body))throw Error('object required');}catch{throw new AdminError(400,'Ungültige Anfrage.');}return Response.json(await claimAdmin(env.DB,await getChatGPTUser(),body.code,env.ADMIN_SETUP_HASH),{headers:ADMIN_HEADERS});}catch(e){return adminFailure(e);}}
