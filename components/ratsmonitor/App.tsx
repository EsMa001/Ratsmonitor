'use client';
import {Footer} from "./components/Footer";
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';
import {Header} from './components/Header';
import {SaveSearchDialog} from './components/SaveSearchDialog';
import {GateDialog} from './components/GateDialog';
import {ConfirmDialog} from './components/ConfirmDialog';
import {DevBrandSwitcher} from './components/DevBrandSwitcher';
import {useBrand} from './lib/brand';
import {pageTitle} from './lib/brands';
import {setFavicon} from './lib/favicon';
import {useData} from './state/data';
import {useSearchResults} from './state/search';
import {OverviewPage} from './pages/OverviewPage';
import {DetailPage} from './pages/DetailPage';
import {PersonalPage} from './pages/PersonalPage';
import {LegalPage} from './pages/LegalPage';
import {InfoPages,isInfoPath} from './info/InfoPages';
import {NotFoundPage} from './info/NotFoundPage';
import {DataProvider} from './state/data';
import {SearchProvider} from './state/search';
import {AccountProvider} from './state/account';
import {ToastProvider} from './state/toast';
import {UiProvider} from './state/ui';
/** Browser-Tab: Titel und Symbol der gewählten Marke. Startseite nur mit dem Markennamen, mit Suche „Begriff in Ort · n Treffer · Marke“;
 *  nach jedem Seitenwechsel neu setzen, weil Next den Titel aus den Metadaten zurückschreiben kann */
function useBrandTitle(p:string,notFound:boolean){
 const {brand,logo,name}=useBrand();const {geo}=useData();const res=useSearchResults();
 const text=res.snapshot.text.trim(),area=res.snapshot.area;
 const place=area&&geo?geo.info(area).name:'';
 const what=[text&&`„${text}“`,place&&(text?`in ${place}`:place)].filter(Boolean).join(' ');
 const count=!res.loading&&what?`${res.total.toLocaleString('de-DE')} Treffer`:'';
 useEffect(()=>{
  document.title=notFound?`Seite nicht gefunden · ${name}`:p==='/'?[what,count,name].filter(Boolean).join(' · '):pageTitle(brand);
 },[brand,name,p,notFound,what,count]);
 useEffect(()=>{setFavicon(logo);},[logo]);
}
/** Adressen, die eine der Seiten unten bedient; alles andere zeigt die 404-Seite */
const isKnownPath=(p:string)=>p==='/'||p.startsWith('/beschluss/')||p.startsWith('/thema/')||p.startsWith('/konto')||p==='/impressum'||p==='/datenschutz'||isInfoPath(p);
function Content(){const p=usePathname();const notFound=!isKnownPath(p);useBrandTitle(p,notFound);return <><Header/>{notFound?<NotFoundPage/>:<OverviewPage active={p==='/'}/>}{(p.startsWith('/beschluss/')||p.startsWith('/thema/'))&&<DetailPage/>}{p.startsWith('/konto')&&<PersonalPage/>}{(p==='/impressum'||p==='/datenschutz')&&<LegalPage kind={p.slice(1) as 'impressum'|'datenschutz'}/>}{isInfoPath(p)&&<InfoPages path={p}/>}<Footer/><SaveSearchDialog/><GateDialog/><ConfirmDialog/><DevBrandSwitcher/></>;}
export default function MonitorApp(){return <div className="ratsmonitor"><DataProvider><ToastProvider><SearchProvider><AccountProvider><UiProvider><Content/></UiProvider></AccountProvider></SearchProvider></ToastProvider></DataProvider></div>;}
