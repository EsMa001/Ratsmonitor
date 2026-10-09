import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {requireSameOrigin,AdminError} from '@/server/integrations/admin-access.mjs';
import {getRefreshStatus,runRefreshStep} from '@/server/repositories/admin';
// Computing steps of the administration (server/integrations/admin-refresh.mjs). GET reads how many areas and builds
// are left; POST {action,target,restart?} runs one step of at most a few seconds and returns where it stopped.
export async function GET(){try{await requireAdmin();return Response.json(await getRefreshStatus(),{headers:ADMIN_HEADERS});}catch(e){return adminFailure(e);}}
export async function POST(request:Request){try{
 requireSameOrigin(request);await requireAdmin();
 const text=await request.text();if(text.length>1024)throw new AdminError(413,'Anfrage zu groß.');
 let body;try{body=JSON.parse(text);if(!body||typeof body!=='object'||Array.isArray(body))throw Error();}catch{throw new AdminError(400,'Ungültige Anfrage.');}
 const {action='step',target='regions',restart=false}=body;
 if(typeof action!=='string'||typeof target!=='string'||target.length>40||typeof restart!=='boolean')throw new AdminError(400,'Ungültige Anfrage.');
 return Response.json(await runRefreshStep({action,target,restart}),{headers:ADMIN_HEADERS});
}catch(e){return adminFailure(e);}}
