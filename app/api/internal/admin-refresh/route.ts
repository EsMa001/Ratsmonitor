import {env} from 'cloudflare:workers';
import {refreshStep,refreshStatus} from '@/server/integrations/admin-refresh.mjs';
import {AdminError} from '@/server/integrations/admin-access.mjs';
// Computing steps of the administration for the external runner (scripts/run-imports.mjs), with the import token
// instead of the admin sign-in: POST {action,target,restart?} runs one step, GET reads the status.
const authorized=(request:Request)=>!!env.IMPORT_TOKEN&&request.headers.get('authorization')==='Bearer '+env.IMPORT_TOKEN;
const failure=(e:unknown)=>e instanceof AdminError?Response.json({error:e.message},{status:(e as AdminError&{status:number}).status,headers:{'Cache-Control':'no-store'}}):Response.json({error:'Schritt fehlgeschlagen.'},{status:503,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){
 if(!authorized(request))return Response.json({error:'Nicht autorisiert'},{status:401});
 try{return Response.json(await refreshStatus(env.DB),{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}
}
export async function POST(request:Request){
 if(!authorized(request))return Response.json({error:'Nicht autorisiert'},{status:401});
 try{
  const body=await request.json().catch(()=>null) as {action?:unknown;target?:unknown;restart?:unknown}|null;
  if(!body||typeof body!=='object')throw new AdminError(400,'Ungültige Anfrage.');
  const target=typeof body.target==='string'?body.target:'regions',action=typeof body.action==='string'?body.action:'step';
  return Response.json(await refreshStep(env.DB,{action,target,restart:body.restart===true,budgetMs:target==='regions'?5000:8000}),{headers:{'Cache-Control':'no-store'}});
 }catch(e){return failure(e);}
}
