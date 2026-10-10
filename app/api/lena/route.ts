import {env} from 'cloudflare:workers';
import {REGIONS} from '@/shared/regions';
import {answer} from '@/server/integrations/lena.mjs';
// Lena: regelbasierte Antworten aus den Daten (docs/produkt/lena-konzept.md). Kein Modell, keine externe Schnittstelle.
// Begrenzung je Absender: 30 Fragen je Minute im Speicher des laufenden Workers (Tarifgrenzen folgen mit der Oberfläche).
const WINDOW=60000,MAX=30;
const calls=new Map<string,number[]>();
function limited(key:string,now:number){
 const list=(calls.get(key)||[]).filter(t=>now-t<WINDOW);
 if(list.length>=MAX){calls.set(key,list);return true;}
 list.push(now);calls.set(key,list);
 if(calls.size>5000)for(const [k,v] of calls)if(!v.some(t=>now-t<WINDOW))calls.delete(k);
 return false;
}
export async function POST(request:Request){
 const now=Date.now();
 const key=request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')||'anonym';
 if(limited(key,now))return Response.json({error:'Bitte einen Moment warten, dann erneut fragen.'},{status:429,headers:{'Cache-Control':'no-store','Retry-After':'60'}});
 let q='';
 try{const body=await request.json() as {q?:unknown};q=typeof body?.q==='string'?body.q:'';}catch{return Response.json({error:'Bitte eine Frage als JSON {q} senden.'},{status:400,headers:{'Cache-Control':'no-store'}});}
 q=q.normalize('NFKC').replace(/\s+/g,' ').trim();
 if(!q||q.length>200)return Response.json({error:'Bitte eine Frage mit höchstens 200 Zeichen stellen.'},{status:400,headers:{'Cache-Control':'no-store'}});
 try{return Response.json(await answer(env.DB,REGIONS,q,{now}),{headers:{'Cache-Control':'no-store'}});}
 catch{return Response.json({error:'Der Datenbestand ist gerade nicht erreichbar. Bitte erneut versuchen.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
