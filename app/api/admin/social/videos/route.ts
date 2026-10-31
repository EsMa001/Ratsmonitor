import {env} from 'cloudflare:workers';
import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {requireSameOrigin,AdminError} from '@/server/integrations/admin-access.mjs';
import {videoInfo,readVideo,setRelease} from '@/server/integrations/social-videos.mjs';
// Social-Videos zu den Vorschlägen (Job „social-videos“, server/integrations/social-videos.mjs). GET ohne Parameter: Stand je
// Vorschlag (fertig, unvollständig, gescheitert, Freigabe). GET ?id=<Vorgang>: das Video selbst. POST {id,on,key}: Freigabe
// setzen oder zurücknehmen; die Freigabe gilt für genau die Fassung mit dieser Prüfsumme. Mehr entscheidet die Administration nicht.
export async function GET(request:Request){try{
 await requireAdmin();if(!env.DB)throw new AdminError(503,'Datenbank fehlt.');
 const id=new URL(request.url).searchParams.get('id');
 if(!id){
  try{return Response.json({videos:await videoInfo(env.DB)},{headers:ADMIN_HEADERS});}
  catch{return Response.json({videos:{},missing:'0049'},{headers:ADMIN_HEADERS});} // Migration noch nicht eingespielt
 }
 const v=await readVideo(env.DB,id,request.headers.get('range'));
 if(!v)throw new AdminError(404,'Zu diesem Vorschlag gibt es kein fertiges Video.');
 return new Response(v.body as unknown as BodyInit,{status:v.status,headers:{...ADMIN_HEADERS,'Content-Type':'video/mp4',...v.headers}});
}catch(e){return adminFailure(e);}}
export async function POST(request:Request){try{
 requireSameOrigin(request);const user=await requireAdmin();if(!env.DB)throw new AdminError(503,'Datenbank fehlt.');
 const text=await request.text();if(text.length>2000)throw new AdminError(413,'Anfrage zu groß.');
 let b:{id?:unknown;on?:unknown;key?:unknown};try{b=JSON.parse(text)||{};}catch{throw new AdminError(400,'Ungültige Anfrage.');}
 if(typeof b.id!=='string'||!b.id||typeof b.on!=='boolean')throw new AdminError(400,'Ungültige Anfrage.');
 const r=await setRelease(env.DB,b.id,{on:b.on,by:(user as {id?:string})?.id||'',key:typeof b.key==='string'?b.key:undefined}) as {ok:boolean;error?:string};
 if(!r.ok)throw new AdminError(409,r.error||'Nicht möglich.');
 return Response.json(r,{headers:ADMIN_HEADERS});
}catch(e){return adminFailure(e);}}
