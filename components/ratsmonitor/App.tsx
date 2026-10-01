'use client';
import {usePathname} from 'next/navigation';
import {Header} from './components/Header';
import {SaveSearchDialog} from './components/SaveSearchDialog';
import {OverviewPage} from './pages/OverviewPage';
import {DetailPage} from './pages/DetailPage';
import {PersonalPage} from './pages/PersonalPage';
import {DataProvider} from './state/data';
import {SearchProvider} from './state/search';
import {AccountProvider} from './state/account';
import {ToastProvider} from './state/toast';
import {UiProvider} from './state/ui';
function Content(){const p=usePathname();return <><Header/><OverviewPage active={p==='/'}/>{(p.startsWith('/beschluss/')||p.startsWith('/thema/'))&&<DetailPage/>}{p.startsWith('/konto')&&<PersonalPage/>}<SaveSearchDialog/></>;}
export default function MonitorApp(){return <div className="ratsmonitor"><DataProvider><ToastProvider><SearchProvider><AccountProvider><UiProvider><Content/></UiProvider></AccountProvider></SearchProvider></ToastProvider></DataProvider></div>;}
