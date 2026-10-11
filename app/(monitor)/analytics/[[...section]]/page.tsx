import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
/* Titel und Beschreibung je Analyse für Link-Vorschauen (die Seite selbst setzt den Titel im Browser) */
const SEITEN:Record<string,[string,string]>={
 ueber:['plenara.X','Besser verstehen, was vor Ort beraten wird: Analysen auf dem gesamten Datenbestand der Räte.'],
 diffusion:['Ausbreitung · plenara.X','Wann ein Thema in welchem Gebiet zum ersten Mal in den Räten auftauchte und wie es sich ausbreitet.'],
 graph:['Themennetz · plenara.X','Womit ein Thema in den Räten zusammenhängt: verwandte Begriffe und Themenfelder als Netz.'],
 trends:['Trends · plenara.X','Welche Begriffe in den Räten gerade aufkommen, zunehmen oder verschwinden.'],
 vergleich:['Ortsvergleich · plenara.X','Zwei Orte nebeneinander: Themen, Verlauf und typische Begriffe.'],
 beschluesse:['Beschlüsse · plenara.X','Wie Gremien entscheiden: Beschlussquote, Vertagungen und Dauer.'],
 gremien:['Beratungswege · plenara.X','Welchen Weg Vorgänge durch die Gremien nehmen und wo sie entschieden werden.'],
 fraktionen:['Fraktionsprofil · plenara.X','Welche Fraktionen welche Themen beantragen und was aus ihren Anträgen wird.'],
 foerderung:['Förderradar · plenara.X','Welche Förderprogramme in den Ratsunterlagen wo beantragt und bewilligt werden.'],
 bauleitplanung:['Bauleitplanung · plenara.X','Welche Bauleitpläne in welchem Verfahrensschritt sind und wie viele Wohnungen entstehen sollen.'],
 kita:['Kita-Radar · plenara.X','Wo über Kita-Elternbeiträge entschieden wird und in welche Richtung.'],
 versorgung:['Versorgungsradar · plenara.X','Energie, Wärme, Wasser, Abwasser, Abfall, Stadtwerke und Breitband in den Ratsunterlagen.'],
 verkehr:['Verkehrsradar · plenara.X','Straßen, Radverkehr, Bus und Bahn, Tempo und Parken in den Ratsunterlagen.'],
 soziales:['Vereins- und Sozialradar · plenara.X','Vereinszuschüsse, Sport, Jugend, Senioren, Inklusion und Integration in den Ratsunterlagen.'],
 vergabe:['Vergaberadar · plenara.X','Ausschreibungen und Vergaben der Kommunen: Bau, Planung, Gutachten, Fahrzeuge und Dienstleistungen.'],
 klima:['Klima- und Energieradar · plenara.X','Wärmeplanung, Photovoltaik, Windenergie, Klimaschutz, Klimaanpassung und Ladeinfrastruktur in den Ratsunterlagen.'],
 finanzlage:['Haushalt und Steuern · plenara.X','Haushalt, Haushaltssicherung, Steuern und Hebesätze, Kredite, Jahresabschlüsse und Umlagen in den Ratsunterlagen.'],
 news:['Newsradar · plenara.X','Was in den Räten gerade berichtenswert ist: Vorgänge nach Nachrichtenwert, je Vorgang eine Meldung mit Zitat und Quelle.'],
 gebuehren:['Gebührenradar · plenara.X','Abfall-, Abwasser-, Niederschlagswasser- und Wassergebühren, Straßenreinigung, Friedhof, Parken und Ausbaubeiträge in den Ratsunterlagen.'],
 beteiligung:['Beteiligung · plenara.X','Einwohneranträge, Petitionen, Bürgerbegehren, Bürgerbeteiligung und Beiräte in den Ratsunterlagen.'],
 tools:['plenara.X Tools','Analysen, die mit jedem Suchbegriff funktionieren: Ausbreitung, Themennetz, Trends, Ortsvergleich, Beschlüsse, Beratungswege.'],
 politik:['plenara.X Politik','Wer entscheidet wie: Fraktionsprofil, Beteiligung und Newsradar, aus den Ratsunterlagen gelesen.'],
 finanzen:['plenara.X Finanzen','Wohin Geld fließt: Haushalt und Steuern, Gebühren, Fördermittel und Vergaben, aus den Ratsunterlagen gelesen.'],
 radar:['plenara.X Radar','Was gebaut und geplant wird: Bauleitplanung, Kitas, Versorgung, Verkehr, Vereine und Soziales, Klima und Energie.'],
};
export async function generateMetadata({params}:{params:Promise<{section?:string[]}>}):Promise<Metadata>{
 const {section=[]}=await params;const s=SEITEN[section[0]||'ueber'];if(!s)return {};
 const bild={url:'/og.png',width:1200,height:630,alt:'plenara: Besser verstehen, was vor Ort beraten wird.'};
 return {title:s[0],description:s[1],openGraph:{type:'website',locale:'de_DE',siteName:'plenara',title:s[0],description:s[1],images:[bild]},twitter:{card:'summary_large_image',title:s[0],description:s[1],images:['/og.png']}};
}
export default async function Page({params}:{params:Promise<{section?:string[]}>}){const {section=[]}=await params;if(section.length>1||(section[0]&&!SEITEN[section[0]]))notFound();return null;}
