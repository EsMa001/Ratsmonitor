import {env} from 'cloudflare:workers';
import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {REGIONS} from '@/shared/regions';
import {POPULATION} from '@/shared/catalog.mjs';
import deRegions from '@/shared/de-regions.json';
import {socialTopics} from '@/server/integrations/social-topics.mjs';
// Themenvorschläge für Social Media (regelbasiert, letzte 30 Tage). Die Rechnung liest rund 200.000 Suchkarten;
// das Ergebnis bleibt je Tag im Speicher des Workers. ?neu=1 rechnet neu.
const bkg=deRegions as unknown as {districts:[string,number,string][];areas:[string,number,string][]};
const extraNames:[string,string][]=[...bkg.areas,...bkg.districts].map(a=>['de-'+a[0],a[2]]);
let kept:{day:string;at:string;data:unknown}|null=null;
export async function GET(request:Request){
 try{
  await requireAdmin();
  if(!env.DB)throw Error('Datenbank fehlt');
  const today=new Date().toISOString().slice(0,10);
  if(!kept||kept.day!==today||new URL(request.url).searchParams.has('neu')){
   kept={day:today,at:new Date().toISOString(),data:await socialTopics(env.DB,REGIONS,{today,extraNames,population:POPULATION as Record<string,number>})};
  }
  return Response.json({computedAt:kept.at,...(kept.data as object)},{headers:ADMIN_HEADERS});
 }catch(e){return adminFailure(e);}
}
