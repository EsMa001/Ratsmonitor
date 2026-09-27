import {env} from 'cloudflare:workers';
import bundle from '@/server/data/billerbeck-content-v1.json';
import {importPreparedAnalysis} from '@/server/integrations/prepared-analysis.mjs';
import {validPreparedToken} from '@/server/integrations/prepared-access.mjs';
// Fixed, versioned results only. No request-supplied articles, SQL or model calls.
export async function POST(request:Request){
 if(!await validPreparedToken(request.headers.get('authorization'),env.PREPARED_ANALYSIS_TOKEN))return Response.json({error:'Nicht autorisiert'},{status:401,headers:{'Cache-Control':'no-store'}});
 try{const result=await importPreparedAnalysis(env.DB,bundle);return Response.json(result.data,{status:result.status,headers:{'Cache-Control':'no-store'}});}
 catch{return Response.json({error:'Übernahme fehlgeschlagen. Bereits gespeicherte Ergebnisse bleiben erhalten; Importverlauf prüfen.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
