// Zustand für deploy.sh und Überwachung (Bearer IMPORT_TOKEN): Inhaltsdatei, Kontendatei, Migrationen, Postausgang, Zugang.
import {env} from 'cloudflare:workers';
import {validBearer} from '@/server/integrations/prepared-access.mjs';
import {accountsConfig} from '@/server/accounts/config.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 if(!await validBearer(request.headers.get('authorization'),env.IMPORT_TOKEN,16))return Response.json({error:'Nicht berechtigt.'},{status:401,headers:{'Cache-Control':'no-store'}});
 const cfg=accountsConfig(env);
 const out:Record<string,unknown>={content:!!env.DB,accounts:!!cfg.db,access:cfg.access??null,mailTransport:cfg.mail.transport,siteUrl:!!cfg.siteUrl,secret:!!cfg.secret};
 try{
  if(cfg.db){
   out.accountsMigrations=(await cfg.db.prepare('SELECT count(*) n FROM accounts_migrations').first() as {n:number}|null)?.n??0;
   const mails=await cfg.db.prepare("SELECT status,count(*) n FROM mail_outbox WHERE created_at>? GROUP BY status").bind(new Date(Date.now()-86400000).toISOString()).all();
   out.mails24h=Object.fromEntries((mails.results||[]).map((r:any)=>[r.status,r.n]));
  }
 }catch(error){out.error=error instanceof Error?error.message:String(error);}
 const ok=!!env.DB&&(!cfg.access||cfg.access==='open'||(!!cfg.db&&!!cfg.secret&&!!cfg.siteUrl))&&!out.error;
 return Response.json({ok,...out},{status:ok?200:503,headers:{'Cache-Control':'no-store'}});
}
