import {cache} from 'react';
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {getTopic} from '@/server/repositories/topics';
import {REGIONS} from '@/shared/regions';
import {BRAND_NAME,DEFAULT_BRAND} from '@/components/ratsmonitor/lib/brands';
import {STATUS as SOURCE_STATUS} from '@/shared/types';
import {TopicSeed} from '@/components/ratsmonitor/components/TopicSeed';

/* Einmal je Anfrage lesen, für Vorschau und Seite; Lesefehler zählen als „nicht da“ nur für die Vorschau */
const readTopic=cache((id:string)=>getTopic(id));

/* Vorschau beim Teilen (WhatsApp, LinkedIn, Slack …): Titel, Ort und Stand des Vorgangs */
export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{
 const {id}=await params;
 try{
  const t=await readTopic(id);
  if(!t)return {};
  const place=REGIONS.find(r=>r.id===t.regionId)?.name;
  const status=(SOURCE_STATUS as Record<string,{label:string}>)[t.status as string]?.label;
  const title=`${t.title}`,brand=BRAND_NAME[DEFAULT_BRAND];
  const description=[place,status,t.shortSummary].filter(Boolean).join(' · ').slice(0,280);
  return {title:`${title} · ${brand}`,description,openGraph:{title,description,siteName:brand,type:'article',locale:'de_DE'},twitter:{card:'summary_large_image',title,description}};
 }catch{return {};}
}
/* Den Vorgang auf dem Server lesen und mitgeben: DetailPage (in components/ratsmonitor/App.tsx) steht damit im HTML.
 * Unbekannte Vorgänge antworten mit 404. Bei einem Lesefehler lädt die Seite im Browser wie bisher. */
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 let t;
 try{t=await readTopic(id);}catch{return null;}
 if(!t){notFound();}
 return <TopicSeed id={id} topic={t}/>;
}
