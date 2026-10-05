import {notFound} from 'next/navigation';
import {brancheBySlug} from '@/components/ratsmonitor/info/content';
/** Der Inhalt kommt vom Rahmen (App.tsx); hier nur: unbekannte Branche liefert echten Status 404 statt 200 */
export default async function Page({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 if(!brancheBySlug(slug))notFound();
 return null;
}
