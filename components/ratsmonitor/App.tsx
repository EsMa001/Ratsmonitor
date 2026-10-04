'use client';
import {Footer} from "./components/Footer";
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';
import {Header} from './components/Header';
import {SaveSearchDialog} from './components/SaveSearchDialog';
import {GateDialog} from './components/GateDialog';
import {DevBrandSwitcher} from './components/DevBrandSwitcher';
import {useBrand} from './lib/brand';
import {pageTitle} from './lib/brands';
import {OverviewPage} from './pages/OverviewPage';
import {DetailPage} from './pages/DetailPage';
import {PersonalPage} from './pages/PersonalPage';
import {LegalPage} from './pages/LegalPage';
import {InfoPages,isInfoPath} from './info/InfoPages';
import {DataProvider} from './state/data';
import {SearchProvider} from './state/search';
import {AccountProvider} from './state/account';
import {ToastProvider} from './state/toast';
import {UiProvider} from './state/ui';
/** Browser-Tab trägt den Namen der gewählten Marke; nach jedem Seitenwechsel neu setzen, weil Next den Titel aus den Metadaten zurückschreiben kann */
function useBrandTitle(p:string){const {brand}=useBrand();useEffect(()=>{document.title=pageTitle(brand);},[brand,p]);}
function Content(){const p=usePathname();useBrandTitle(p);return <><Header/><OverviewPage active={p==='/'}/>{(p.startsWith('/beschluss/')||p.startsWith('/thema/'))&&<DetailPage/>}{p.startsWith('/konto')&&<PersonalPage/>}{(p==='/impressum'||p==='/datenschutz')&&<LegalPage kind={p.slice(1) as 'impressum'|'datenschutz'}/>}{isInfoPath(p)&&<InfoPages path={p}/>}<Footer/><SaveSearchDialog/><GateDialog/><DevBrandSwitcher/></>;}
export default function MonitorApp(){return <div className="ratsmonitor"><DataProvider><ToastProvider><SearchProvider><AccountProvider><UiProvider><Content/></UiProvider></AccountProvider></SearchProvider></ToastProvider></DataProvider></div>;}
