import {env} from 'cloudflare:workers';
import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {requireSameOrigin} from '@/server/integrations/admin-access.mjs';
import bundle from '@/server/data/billerbeck-content-v1.json';
import {importPreparedAnalysis} from '@/server/integrations/prepared-analysis.mjs';
export async function POST(request:Request){try{
 requireSameOrigin(request);await requireAdmin();
 const result=await importPreparedAnalysis(env.DB,bundle);
 return Response.json(result.data,{status:result.status,headers:ADMIN_HEADERS});
}catch(e){return adminFailure(e);}}
