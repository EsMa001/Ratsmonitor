import type {Metadata} from 'next';
import {preload} from 'react-dom';
/* Startseite: die Seite selbst baut App.tsx im Browser. Drei ihrer Abfragen hängen nicht vom Datum ab und gehen hier schon mit dem
   HTML als <link rel="preload"> hinaus, statt erst nach dem Seitenaufbau (Messung 17.10.2026: Start erst nach 0,6 bis 2,2 s,
   docs/qualitaet/frontend-effizienz-2026-10-17.md, Befund 5). Die Adressen müssen genau denen in StartseitePage.tsx entsprechen,
   crossOrigin wie fetch() (mode cors, Cookies mitgeschickt), sonst lädt der Browser doppelt. Die datierte Zählung der letzten 30
   Tage bleibt beim Seitenaufbau, weil ein vorgerendertes HTML kein Tagesdatum kennt. */
/* Startseite: Marke und Slogan im Titel (Slogan fest, docs/produkt/slogan.json), canonical auf / */
export const metadata:Metadata={title:'plenara · Besser verstehen, was vor Ort beraten wird.',alternates:{canonical:'/'}};
export default function Page(){
 for(const url of ['/api/search?part=facets','/api/search/coverage?level=city','/api/startseite-trends'])preload(url,{as:'fetch',crossOrigin:'anonymous'});
 return null;
}
