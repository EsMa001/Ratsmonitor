import type {Metadata} from 'next';
import {getTopic} from '@/server/repositories/topics';
import {REGIONS} from '@/shared/regions';
import {BRAND_NAME,DEFAULT_BRAND} from '@/components/ratsmonitor/lib/brands';
import {STATUS as SOURCE_STATUS} from '@/shared/types';

/* Vorschau beim Teilen (WhatsApp, LinkedIn, Slack …): Titel, Ort und Stand des Vorgangs */
export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{
 const {id}=await params;
 try{
  const t=await getTopic(id);
  if(!t)return {};
  const place=REGIONS.find(r=>r.id===t.regionId)?.name;
  const status=(SOURCE_STATUS as Record<string,{label:string}>)[t.status as string]?.label;
  const title=`${t.title}`,brand=BRAND_NAME[DEFAULT_BRAND];
  const description=[place,status,t.shortSummary].filter(Boolean).join(' · ').slice(0,280);
  return {title:`${title} · ${brand}`,description,openGraph:{title,description,siteName:brand,type:'article',locale:'de_DE'},twitter:{card:'summary',title,description}};
 }catch{return {};}
}
export default function Page(){return null;}
