import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {requireSameOrigin,AdminError} from '@/server/integrations/admin-access.mjs';
import {runSync} from '@/server/services/sync';
import {NRW_SOURCES} from '@/server/integrations/source-catalog.mjs';
import {SOURCES} from '@/server/integrations/regions.mjs';
export async function POST(request:Request){try{requireSameOrigin(request);await requireAdmin();const text=await request.text();if(text.length>1024)throw new AdminError(413,'Anfrage zu groß.');let body;try{body=JSON.parse(text);if(!body||typeof body!=='object'||Array.isArray(body))throw Error('object required');}catch{throw new AdminError(400,'Ungültige Anfrage.');}const region=body.region;if(typeof region!=='string'||!(region==='muenster'||[...SOURCES,...NRW_SOURCES].some(s=>s.id===region&&(!('method' in s)||s.method!=='pending'))))throw new AdminError(400,'Für dieses Gebiet ist kein Import eingerichtet.');const result=await runSync('metadata',region,'manual');return Response.json(result.data,{status:result.status,headers:ADMIN_HEADERS});}catch(e){return adminFailure(e);}}
