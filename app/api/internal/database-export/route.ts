import {env} from 'cloudflare:workers';
import {validPreparedToken} from '@/server/integrations/prepared-access.mjs';
import {exportRequest} from '@/server/integrations/database-transfer.mjs';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'};
// Separate, read-only export credential; never authorizes imports or analysis.
export async function GET(request:Request){
 if(!await validPreparedToken(request.headers.get('authorization'),env.DATA_EXPORT_TOKEN))return Response.json({error:'Nicht autorisiert'},{status:401,headers});
 try{const result=await exportRequest(env.DB,new URL(request.url));return Response.json(result.data,{status:result.status,headers});}
 catch{return Response.json({error:'Export nicht verfügbar'},{status:503,headers});}
}
