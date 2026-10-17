import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {brancheBySlug} from '@/components/ratsmonitor/info/content';
/* Titel und Beschreibung je Anwenderseite für Link-Vorschauen und Suchmaschinen */
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
 const {slug}=await params;const b=brancheBySlug(slug);if(!b)return {};
 const title=`${b.name}: ${b.title} · plenara`,description=b.intro;
 return {title,description,openGraph:{type:'website',locale:'de_DE',siteName:'plenara',title,description,images:[{url:`/og/anwender-${slug}.png`,width:1200,height:630}]},twitter:{card:'summary_large_image',title,description,images:[`/og/anwender-${slug}.png`]}};
}
/** Der Inhalt kommt vom Rahmen (App.tsx); hier nur: unbekannte Branche liefert echten Status 404 statt 200 */
export default async function Page({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 if(!brancheBySlug(slug))notFound();
 return null;
}
