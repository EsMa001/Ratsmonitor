import {env} from 'cloudflare:workers';
import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {exportRequest} from '@/server/integrations/database-transfer.mjs';
export async function GET(request:Request){
 try{await requireAdmin();const result=await exportRequest(env.DB,new URL(request.url));return Response.json(result.data,{status:result.status,headers:ADMIN_HEADERS});}
 catch(error){return adminFailure(error);}
}
