import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {claimAdmin,requireSameOrigin,AdminError} from '@/server/integrations/admin-access.mjs';
import {adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
export async function POST(request:Request){try{requireSameOrigin(request);const text=await request.text();if(text.length>1024)throw new AdminError(413,'Anfrage zu groß.');let body;try{body=JSON.parse(text);if(!body||typeof body!=='object'||Array.isArray(body))throw Error('object required');}catch{throw new AdminError(400,'Ungültige Anfrage.');}return Response.json(await claimAdmin(env.DB,await getChatGPTUser(),body.code,env.ADMIN_SETUP_HASH),{headers:ADMIN_HEADERS});}catch(e){return adminFailure(e);}}
