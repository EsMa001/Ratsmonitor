import {env} from 'cloudflare:workers';
import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {requireSameOrigin,AdminError} from '@/server/integrations/admin-access.mjs';
import {createAiJob,getAiJob,applyAiResults,cancelAiJob} from '@/server/integrations/ai-jobs.mjs';
export async function GET(){try{await requireAdmin();return Response.json(await getAiJob(env.DB),{headers:ADMIN_HEADERS});}catch(e){return adminFailure(e);}}
export async function POST(request:Request){try{
 requireSameOrigin(request);await requireAdmin();const text=await request.text();if(text.length>3000000)throw new AdminError(413,'Ergebnisdatei zu groß.');let body;try{body=JSON.parse(text);if(!body||typeof body!=='object'||Array.isArray(body))throw Error();}catch{throw new AdminError(400,'Ungültige Anfrage.');}
 let result;if(body.action==='create')result=await createAiJob(env.DB,body);else if(body.action==='apply')result=await applyAiResults(env.DB,await getAiJob(env.DB),body.result);else if(body.action==='cancel')result=await cancelAiJob(env.DB,body.id);else throw new AdminError(400,'Ungültige Aktion.');
 return Response.json(result,{headers:ADMIN_HEADERS});
 }catch(e){return adminFailure(e);}}
