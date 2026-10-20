import {ImageResponse} from 'next/og';
import {headers} from 'next/headers';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {getTopic} from '@/server/repositories/topics';
import {REGIONS} from '@/shared/regions';
import {STATUS as SOURCE_STATUS} from '@/shared/types';

/* Vorschaubild beim Teilen eines Vorgangs (WhatsApp, LinkedIn, Slack …): Titel, Ort und Stand auf Petrol.
 * Drei Stufen, damit die Vorschau immer ein Bild hat:
 *  A  mit IBM Plex (Schrift aus public/fonts)
 *  B  dieselbe Karte mit der Standardschrift von @vercel/og (wenn die Schrift nicht lesbar ist)
 *  C  das feste Bild /og.png (wenn das Zeichnen scheitert oder der Vorgang fehlt) */
export const alt='plenara: Besser verstehen, was vor Ort beraten wird.';
export const size={width:1200,height:630};
export const contentType='image/png';

const PETROL='#268478',WEISS='#ffffff';
const cut=(s:string,n:number)=>s.length>n?s.slice(0,n-1).trimEnd()+'…':s;

/* Schrift lesen: im Node-Server aus dem Ordner public, sonst (Entwicklung, Worker) von der eigenen Adresse; scheitert beides, folgt Stufe B */
const font=async(file:string)=>{
 for(const base of [process.cwd(),path.join(process.cwd(),'dist','standalone')]){
  try{return await readFile(path.join(base,'public','fonts',file));}catch{/* nächster Ort */}
 }
 const h=await headers(),host=h.get('x-forwarded-host')||h.get('host');
 if(!host)throw new Error('Schrift nicht lesbar: '+file);
 const res=await fetch(`${h.get('x-forwarded-proto')||'http'}://${host}/fonts/${file}`);
 if(!res.ok)throw new Error(`Schrift nicht lesbar: ${file} (${res.status})`);
 return await res.arrayBuffer();
};

const card=(title:string,line:string,family?:string)=>(
 <div style={{display:'flex',flexDirection:'column',justifyContent:'space-between',width:'100%',height:'100%',background:PETROL,color:WEISS,padding:'64px 72px',fontFamily:family}}>
  <div style={{display:'flex',fontSize:44,fontWeight:600,letterSpacing:'-0.02em'}}>plenara.</div>
  <div style={{display:'flex',flexDirection:'column'}}>
   <div style={{display:'flex',fontSize:cutSize(title),fontWeight:600,lineHeight:1.15,letterSpacing:'-0.02em'}}>{title}</div>
   {line&&<div style={{display:'flex',marginTop:28,fontSize:32,opacity:0.88}}>{line}</div>}
  </div>
  <div style={{display:'flex',fontSize:28,opacity:0.8}}>Besser verstehen, was vor Ort beraten wird.</div>
 </div>
);
/* Längere Titel etwas kleiner, damit sie in drei bis vier Zeilen passen */
function cutSize(t:string){return t.length>90?46:t.length>60?54:64;}

export default async function Image({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 let title='',line='',errA='';
 try{
  const t=await getTopic(id);
  if(!t)return fallback('Vorgang nicht gefunden');
  const place=REGIONS.find(r=>r.id===t.regionId)?.name;
  const status=(SOURCE_STATUS as Record<string,{label:string}>)[t.status as string]?.label;
  title=cut(t.title,130);line=cut([place,status].filter(Boolean).join(' · '),90);
 }catch(e){console.warn('og-image: Vorgang nicht lesbar',e);return fallback('Vorgang nicht lesbar: '+why(e));}
 try{
  const [regular,bold]=await Promise.all([font('IBMPlexSans-Regular.ttf'),font('IBMPlexSans-SemiBold.ttf')]);
  return await render(card(title,line,'IBM Plex Sans'),[{name:'IBM Plex Sans',data:regular,weight:400,style:'normal'},{name:'IBM Plex Sans',data:bold,weight:600,style:'normal'}]);
 }catch(e){console.warn('og-image: Stufe A gescheitert, weiter mit Standardschrift',e);errA=why(e);/* Stufe B */}
 try{return await render(card(title,line));}catch(e){console.warn('og-image: Stufe B gescheitert, festes Bild',e);return fallback('Stufe B: '+why(e)+(errA?' | Stufe A: '+errA:''));}
}

type Fonts=NonNullable<ConstructorParameters<typeof ImageResponse>[1]>['fonts'];
/* Gezeichnet wird zu Ende gelesen, damit ein Fehler hier schon abgefangen wird (nicht erst beim Ausliefern) */
async function render(el:React.ReactElement,fonts?:Fonts){
 const res=new ImageResponse(el,{...size,...(fonts?{fonts}:{})});
 const body=await res.arrayBuffer();
 return new Response(body,{headers:{'content-type':contentType,'cache-control':'public, max-age=86400, s-maxage=86400'}});
}
/* Stufe C: das feste Bild */
/* Der Grund steht im Kopf x-og-grund (nur zur Fehlersuche) */
function fallback(grund=''){return new Response(null,{status:302,headers:{location:'/og.png','cache-control':'public, max-age=3600',...(grund?{'x-og-grund':grund.replace(/[^\x20-\x7e]/g,'?').slice(0,300)}:{})}});}
const why=(e:unknown)=>e instanceof Error?e.message:String(e);
