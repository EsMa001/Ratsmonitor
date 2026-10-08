import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
/* Titel und Beschreibung je Analyse für Link-Vorschauen (die Seite selbst setzt den Titel im Browser) */
const SEITEN:Record<string,[string,string]>={
 ueber:['plenara.X','Besser verstehen, was vor Ort beraten wird: Analysen auf dem gesamten Datenbestand der Räte.'],
 diffusion:['Diffusionsanalyse · plenara.X','Wann ein Thema in welchem Gebiet zum ersten Mal in den Räten auftauchte und wie es sich ausbreitet.'],
 graph:['Knowledge Graph · plenara.X','Womit ein Thema in den Räten zusammenhängt: verwandte Begriffe und Themenfelder als Netz.'],
 trends:['Trends und Frühindikatoren · plenara.X','Welche Begriffe in den Räten gerade aufkommen, zunehmen oder verschwinden.'],
 vergleich:['Gebietsvergleich · plenara.X','Zwei Orte nebeneinander: Themen, Verlauf und typische Begriffe.'],
 beschluesse:['Beschlüsse · plenara.X','Wie Gremien entscheiden: Beschlussquote, Vertagungen und Dauer.'],
 gremien:['Gremiennetz · plenara.X','Welchen Weg Vorgänge durch die Gremien nehmen und wo sie entschieden werden.'],
};
export async function generateMetadata({params}:{params:Promise<{section?:string[]}>}):Promise<Metadata>{
 const {section=[]}=await params;const s=SEITEN[section[0]||'ueber'];if(!s)return {};
 const bild={url:'/og.png',width:1200,height:630,alt:'plenara: Früher wissen, was vor Ort beraten wird.'};
 return {title:s[0],description:s[1],openGraph:{type:'website',locale:'de_DE',siteName:'plenara',title:s[0],description:s[1],images:[bild]},twitter:{card:'summary_large_image',title:s[0],description:s[1],images:['/og.png']}};
}
export default async function Page({params}:{params:Promise<{section?:string[]}>}){const {section=[]}=await params;if(section.length>1||(section[0]&&!SEITEN[section[0]]))notFound();return null;}
