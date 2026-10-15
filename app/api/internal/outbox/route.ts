// Postausgang der Kontomails abarbeiten: serve.mjs ruft das beim Start und jede Minute auf (Bearer IMPORT_TOKEN).
import {env} from 'cloudflare:workers';
import {validBearer} from '@/server/integrations/prepared-access.mjs';
import {accountsConfig} from '@/server/accounts/config.mjs';
import {processOutbox} from '@/server/accounts/mail.mjs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 if(!await validBearer(request.headers.get('authorization'),env.IMPORT_TOKEN,16))return Response.json({error:'Nicht berechtigt.'},{status:401,headers:{'Cache-Control':'no-store'}});
 const cfg=accountsConfig(env);
 if(!cfg.db)return Response.json({accounts:false},{headers:{'Cache-Control':'no-store'}});
 try{return Response.json(await processOutbox(cfg.db,cfg,{site:cfg.siteUrl}),{headers:{'Cache-Control':'no-store'}});}
 catch(error){console.error('[konten] Postausgang:',error instanceof Error?error.message:String(error));return Response.json({error:'Postausgang nicht verarbeitet.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
