'use client';
import {usePathname} from 'next/navigation';
import {Header} from './components/Header';
import {SaveSearchDialog} from './components/SaveSearchDialog';
import {OverviewPage} from './pages/OverviewPage';
import {DetailPage} from './pages/DetailPage';
import {PersonalPage} from './pages/PersonalPage';
import {LegalPage} from './pages/LegalPage';
import {DataProvider} from './state/data';
import {SearchProvider} from './state/search';
import {AccountProvider} from './state/account';
import {ToastProvider} from './state/toast';
import {UiProvider} from './state/ui';
function Content(){const p=usePathname();return <><Header/><OverviewPage active={p==='/'}/>{(p.startsWith('/beschluss/')||p.startsWith('/thema/'))&&<DetailPage/>}{p.startsWith('/konto')&&<PersonalPage/>}{(p==='/impressum'||p==='/datenschutz')&&<LegalPage kind={p.slice(1) as 'impressum'|'datenschutz'}/>}<footer className="mx-auto flex max-w-page flex-wrap justify-center gap-4 pb-6 pt-2 text-[13px] text-slate-500"><a href="/impressum" className="hover:text-slate-900">Impressum</a><a href="/datenschutz" className="hover:text-slate-900">Datenschutz</a></footer><SaveSearchDialog/></>;}
export default function MonitorApp(){return <div className="ratsmonitor"><DataProvider><ToastProvider><SearchProvider><AccountProvider><UiProvider><Content/></UiProvider></AccountProvider></SearchProvider></ToastProvider></DataProvider></div>;}
