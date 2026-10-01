import {env} from 'cloudflare:workers';
import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {requireSameOrigin,AdminError} from '@/server/integrations/admin-access.mjs';
import {createAiJob,getAiJob,applyAiResults,cancelAiJob} from '@/server/integrations/ai-jobs.mjs';
export async function GET(request:Request){try{
 await requireAdmin();const params=new URL(request.url).searchParams;
 const offset=params.get('offset')||'0';
 if(!/^\d+$/.test(offset)||Number(offset)>10000000)throw new AdminError(400,'Ungültige Auftragsseite.');
 return Response.json(await getAiJob(env.DB,{id:params.get('id')||undefined,offset:Number(offset),limit:100}),{headers:ADMIN_HEADERS});
}catch(e){return adminFailure(e);}}
export async function POST(request:Request){try{
 requireSameOrigin(request);await requireAdmin();const text=await request.text();if(new TextEncoder().encode(text).byteLength>3000000)throw new AdminError(413,'Ergebnispaket zu groß.');let body;try{body=JSON.parse(text);if(!body||typeof body!=='object'||Array.isArray(body))throw Error();}catch{throw new AdminError(400,'Ungültige Anfrage.');}
 let result;if(body.action==='create')result=await createAiJob(env.DB,body,{metadataOnly:true});else if(body.action==='apply'){
  if(!Array.isArray(body.result?.articles)||body.result.articles.length>100)throw new AdminError(400,'Höchstens 100 Artikel je Ergebnispaket.');
  result=await applyAiResults(env.DB,await getAiJob(env.DB,{metadataOnly:true}),body.result);
 }else if(body.action==='cancel')result=await cancelAiJob(env.DB,body.id);else throw new AdminError(400,'Ungültige Aktion.');
 return Response.json(result,{headers:ADMIN_HEADERS});
 }catch(e){return adminFailure(e);}}
