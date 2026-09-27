import {env} from 'cloudflare:workers';
import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {requireSameOrigin,AdminError} from '@/server/integrations/admin-access.mjs';
import {analysePending} from '@/server/integrations/manual-analysis.mjs';
import {validRegion} from '@/shared/regions';
import {runSync} from '@/server/services/sync';
export async function POST(request:Request){try{
 requireSameOrigin(request);await requireAdmin();
 const text=await request.text();if(text.length>1024)throw new AdminError(413,'Anfrage zu groß.');
 let body;try{body=JSON.parse(text);if(!body||typeof body!=='object'||Array.isArray(body))throw Error();}catch{throw new AdminError(400,'Ungültige Anfrage.');}
 const {region,mode}=body;
 if(typeof region!=='string'||!(region==='all'||validRegion(region))||!['analysis','summaries'].includes(mode)||mode==='summaries'&&region==='all')throw new AdminError(400,'Bitte einen gültigen Analysemodus und ein Gebiet wählen.');
 if(mode==='summaries'&&!env.OPENAI_API_KEY)throw new AdminError(409,'Für KI-Zusammenfassungen ist kein API-Zugang eingerichtet.');
 const result=mode==='analysis'?await analysePending(env.DB,region):await runSync('summaries',region,'manual');
 return Response.json(result.data,{status:result.status,headers:ADMIN_HEADERS});
 }catch(e){return adminFailure(e);}}
