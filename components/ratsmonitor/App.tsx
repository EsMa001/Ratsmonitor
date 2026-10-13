'use client';
import {Footer} from "./components/Footer";
import {useEffect,lazy,Suspense,type ComponentType} from 'react';
// Merker im Browser: nach einem fehlenden Seitenteil wurde schon einmal neu geladen (pageModule).
const RELOADED='rm-chunk-reload';
import {usePathname,useRouter} from 'next/navigation';
import {Header} from './components/Header';
import {SaveSearchDialog} from './components/SaveSearchDialog';
import {GateDialog} from './components/GateDialog';
import {ConfirmDialog} from './components/ConfirmDialog';
// DevBrandSwitcher (Logo-Umschalter) ist nicht eingebunden; zum Wiedereinschalten importieren und im JSX von Content rendern.
import {useBrand} from './lib/brand';
import {tabTitle} from './lib/pageTitle';
import {brancheBySlug} from './info/content';
import {setFavicon} from './lib/favicon';
import {useData} from './state/data';
import {useSearchResults} from './state/search';
import {OverviewPage} from './pages/OverviewPage';
import {isInfoPath,isAnalyticsPath} from './lib/routes';
// Nur die Startseite liegt im Startpaket. Detail (mit Export), Konto, Rechtliches, Info- und Analyse-Seiten werden im
// Browser beim ersten Aufruf nachgeladen (pageModule).
const DetailPage=pageModule(()=>import('./pages/DetailPage'),m=>m.DetailPage,p=>p.startsWith('/beschluss/')||p.startsWith('/thema/'));
const PersonalPage=pageModule(()=>import('./pages/PersonalPage'),m=>m.PersonalPage,p=>p.startsWith('/konto'));
const LegalPage=pageModule(()=>import('./pages/LegalPage'),m=>m.LegalPage,p=>p==='/impressum'||p==='/datenschutz');
const InfoPages=pageModule(()=>import('./info/InfoPages'),m=>m.InfoPages,isInfoPath);
const AnalyticsPages=pageModule(()=>import('./pages/analytics/AnalyticsPages'),m=>m.AnalyticsPages,isAnalyticsPath);
/**
 * Eine nachgeladene Seite. Auf dem Server wird das Modul gleich beim Start geladen und danach synchron geliefert: ein
 * Thenable, das sofort erfüllt, lässt React.lazy ohne Suspense-Platzhalter rendern. So steht der Inhalt im HTML selbst
 * (Suchmaschinen, Vorschauen, Lesen ohne JavaScript), nicht als Nachtrag. Im Browser: fehlt ein Teil nach einem neuen
 * Stand auf dem Server (alter Tab, Datei gibt es nicht mehr), lädt die Seite einmal neu. here: Adressen dieser Seite.
 */
function pageModule<M,P extends object>(load:()=>Promise<M>,pick:(m:M)=>ComponentType<P>,here:(path:string)=>boolean){
 let loaded:M|undefined;
 const fetchModule=()=>load().then(m=>{loaded=m;try{sessionStorage.removeItem(RELOADED);}catch{/* ohne Speicher */}return m;},e=>{
  if(typeof window!=='undefined'){let again=false;try{again=!sessionStorage.getItem(RELOADED);if(again)sessionStorage.setItem(RELOADED,'1');}catch{/* ohne Speicher kein Neuladen */}if(again)location.reload();}
  throw e;
 });
 // Auf dem Server immer, im Browser schon beim Start, wenn die aufgerufene Adresse diese Seite zeigt (Hydrierung ohne Umweg).
 if(typeof window==='undefined'||here(location.pathname))void fetchModule().catch(()=>{});
 return lazy<ComponentType<P>>(()=>(loaded!==undefined?{then:(done:(v:{default:ComponentType<P>})=>void)=>done({default:pick(loaded as M)})}:fetchModule().then(m=>({default:pick(m)}))) as Promise<{default:ComponentType<P>}>);
}
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
 const count=!res.loading&&!res.totalPending&&what?`${res.total.toLocaleString('de-DE')} Treffer`:'';
 useEffect(()=>{
  // Analyse-Seiten setzen ihren Titel selbst („Ausbreitung · plenara.X“); ein Überschreiben hier würde ihn zurücksetzen
  // … ebenso die Detailseite (Titel des Vorgangs, wie ihn auch der Server schickt)
  if(!notFound&&(isAnalyticsPath(p)||p.startsWith('/beschluss/')||p.startsWith('/thema/')))return;
  document.title=notFound?`Seite nicht gefunden · ${name}`:p==='/suche'?[what,count,name].filter(Boolean).join(' · '):tabTitle(p,name,p.startsWith('/anwender/')?brancheBySlug(p.slice(10))?.name:undefined);
 },[brand,name,p,notFound,what,count]);
 useEffect(()=>{setFavicon(logo);},[logo,p]);
}
/** Adressen, die eine der Seiten unten bedient; alles andere zeigt die 404-Seite */
const isKnownPath=(p:string)=>p==='/'||p==='/suche'||p.startsWith('/beschluss/')||p.startsWith('/thema/')||p.startsWith('/konto')||p==='/impressum'||p==='/datenschutz'||isAnalyticsPath(p)||isInfoPath(p);
function Content(){const p=usePathname();const router=useRouter();useEffect(()=>{if(p!=='/')return;const q=new URLSearchParams(window.location.search);if(q.get('q')||q.get('suche')||q.get('region'))router.replace('/suche'+window.location.search);},[p,router]);useEffect(()=>{document.documentElement.classList.toggle('rm-search',p==='/suche');document.documentElement.classList.toggle('rm-analytics',isAnalyticsPath(p));},[p]);const notFound=!isKnownPath(p);useBrandTitle(p,notFound);return <><Header/>{notFound?<NotFoundPage/>:<OverviewPage active={p==='/suche'}/>}<Suspense fallback={<div className="min-h-[60vh]" aria-busy="true"/>}>{(p.startsWith('/beschluss/')||p.startsWith('/thema/'))&&<DetailPage/>}{p.startsWith('/konto')&&<PersonalPage/>}{(p==='/impressum'||p==='/datenschutz')&&<LegalPage kind={p.slice(1) as 'impressum'|'datenschutz'}/>}{isAnalyticsPath(p)&&<AnalyticsPages path={p}/>}{isInfoPath(p)&&<InfoPages path={p}/>}</Suspense><Footer/><SaveSearchDialog/><GateDialog/><ConfirmDialog/></>;}
export default function MonitorApp(){return <div className="ratsmonitor"><DataProvider><ToastProvider><SearchProvider><AccountProvider><UiProvider><Content/></UiProvider></AccountProvider></SearchProvider></ToastProvider></DataProvider></div>;}
