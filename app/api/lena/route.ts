import {guard,requestTier} from '@/server/services/session';
import {clientIp} from '@/server/accounts/http.mjs';
import {env} from 'cloudflare:workers';
import {REGIONS} from '@/shared/regions';
import {answer} from '@/server/integrations/lena.mjs';
// Lena: regelbasierte Antworten aus den Daten (docs/produkt/lena-konzept.md). Kein Modell, keine externe Schnittstelle.
// Begrenzung je Konto oder Absender im Speicher des laufenden Prozesses, nach Stufe (Gast 10, Basic und Pro 30, Enterprise 60 je Minute).
const WINDOW=60000;
const calls=new Map<string,number[]>();
function limited(key:string,now:number,max:number){
 const list=(calls.get(key)||[]).filter(t=>now-t<WINDOW);
 if(list.length>=max){calls.set(key,list);return true;}
 list.push(now);calls.set(key,list);
 if(calls.size>5000)for(const [k,v] of calls)if(!v.some(t=>now-t<WINDOW))calls.delete(k);
 return false;
}
export async function POST(request:Request){
 const now=Date.now();
 const denied=await guard(request);if(denied)return denied;
 // Grenze je Stufe (shared/plans.mjs, lenaPerMin), je Konto oder Client-Adresse (letzter X-Forwarded-For-Eintrag von Caddy)
 const tier=await requestTier(request);
 const key=tier.userId?'u:'+tier.userId:'ip:'+clientIp(request);
 if(limited(key,now,tier.accounts?tier.features.lenaPerMin:30))return Response.json({error:'Bitte einen Moment warten, dann erneut fragen.'},{status:429,headers:{'Cache-Control':'no-store','Retry-After':'60'}});
 let q='';
 try{const body=await request.json() as {q?:unknown};q=typeof body?.q==='string'?body.q:'';}catch{return Response.json({error:'Bitte eine Frage als JSON {q} senden.'},{status:400,headers:{'Cache-Control':'no-store'}});}
 q=q.normalize('NFKC').replace(/\s+/g,' ').trim();
 if(!q||q.length>200)return Response.json({error:'Bitte eine Frage mit höchstens 200 Zeichen stellen.'},{status:400,headers:{'Cache-Control':'no-store'}});
 try{return Response.json(await answer(env.DB,REGIONS,q,{now}),{headers:{'Cache-Control':'no-store'}});}
 catch{return Response.json({error:'Der Datenbestand ist gerade nicht erreichbar. Bitte erneut versuchen.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
