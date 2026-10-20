import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
/* Titel und Beschreibung je Analyse für Link-Vorschauen (die Seite selbst setzt den Titel im Browser) */
const SEITEN:Record<string,[string,string]>={
 graph:['Themennetz · plenara.X','Womit ein Thema in den Räten zusammenhängt: verwandte Begriffe und Themenfelder als Netz.'],
 trends:['Trends · plenara.X','Was in den Räten gerade aufkommt und wie es sich über die Gebiete ausbreitet: Begriffe, die zunehmen, und die Gebiete, die sie zum ersten Mal beraten.'],
 vergleich:['Vergleich · plenara.X','Zwei Orte nebeneinander: Themen, Verlauf und typische Begriffe.'],
 beschluesse:['Beschlusslage · plenara.X','Wie Vorgänge ausgehen: beschlossen, abgelehnt, vertagt, und wie lange es dauert.'],
 gremien:['Gremien · plenara.X','Welchen Weg Vorgänge durch die Gremien nehmen und wo sie entschieden werden.'],
 fraktionen:['Fraktionen · plenara.X','Welche Fraktionen welche Themen beantragen und was aus ihren Anträgen wird.'],
 news:['Nachrichten · plenara.X','Was in den Räten gerade berichtenswert ist: Vorgänge nach Nachrichtenwert, je Vorgang eine Meldung mit Zitat und Quelle.'],
 ausschreibungen:['Ausschreibungen · plenara.X','Welche Aufträge Kommunen ausschreiben und vergeben, nach Leistung und Schritt, aus den Beschlüssen der Räte gelesen, mit Quelle.'],
 signale:['Projekte · plenara.X','Wo gerade etwas entsteht: neue Baugebiete, Windparks, Wärmeplanung und mehr, aus den Vorlagen der Räte gelesen, mit Stand.'],
 fakten:['Werte · plenara.X','Hebesätze, Gebühren, Jahresergebnisse und Preise aus den Vorlagen der Räte, je Gemeinde auf der Karte.'],
 atlas:['Themenatlas · plenara.X','Worüber die Räte beraten, nach den 10 Themen der Suche: Unterthemen, wo ein Thema viel Raum hat und ein Ort im Vergleich mit ähnlichen Gemeinden.'],
};
export async function generateMetadata({params}:{params:Promise<{section?:string[]}>}):Promise<Metadata>{
 const {section=[]}=await params;const s=section[0]?SEITEN[section[0]]:undefined;if(!s)return {};
 const bild={url:'/og.png',width:1200,height:630,alt:'plenara: Besser verstehen, was vor Ort beraten wird.'};
 return {title:s[0],description:s[1],alternates:{canonical:`/analytics/${section[0]}`},openGraph:{type:'website',locale:'de_DE',siteName:'plenara',url:`/analytics/${section[0]}`,title:s[0],description:s[1],images:[bild]},twitter:{card:'summary_large_image',title:s[0],description:s[1],images:['/og.png']}};
}
export default async function Page({params}:{params:Promise<{section?:string[]}>}){const {section=[]}=await params;if(section.length!==1||!SEITEN[section[0]])notFound();return null;}
