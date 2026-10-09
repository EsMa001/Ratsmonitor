'use client';
import Link from 'next/link';
import {useEffect,type ReactNode} from 'react';
import {Brand} from '@/components/ratsmonitor/components/Brand';
import {useDarkMode} from '@/components/ratsmonitor/lib/useDarkMode';
import {ConfirmDialog} from '@/components/ratsmonitor/components/ConfirmDialog';
import {BRAND_NAME,DEFAULT_BRAND} from '@/components/ratsmonitor/lib/brands';
import {FOOT} from '@/components/admin-texts';
import {RegionCatchUp} from '@/components/admin-catch-up';

// Rahmen aller Adminseiten im Design der Startseite: Kopfzeile wie Header.tsx, darunter Reiter, Inhalt mit der Seitenbreite der
// Startseite und eine Fußzeile. Die Seiten heißen in der Adresse nach ihrem Inhalt (?seite=abruf); die alten Nummern 1 bis 4
// führen weiter dorthin. Die Startseite des Adminbereichs ist die To-do-Liste (ohne Parameter).
export type AdminPage='todo'|'uebersicht'|'abruf'|'atlas'|'qualitaet'|'hochrechnung'|'stichwoerter';
export const ADMIN_PAGES:{id:AdminPage;label:string}[]=[{id:'todo',label:'To-do-Liste'},{id:'uebersicht',label:'Übersicht'},{id:'abruf',label:'Abruf & Verarbeitung'},{id:'atlas',label:'Lückenatlas'},{id:'qualitaet',label:'Qualität & Betrieb'},{id:'hochrechnung',label:'Hochrechnung'},{id:'stichwoerter',label:'Stichwörter'}];
/** Adresse einer Adminseite, mit weiteren Parametern ("filter=issues"). */
export const adminHref=(page:AdminPage,params='')=>'/admin'+(page==='todo'?(params?'?'+params:''):'?seite='+page+(params?'&'+params:''));

/** Kopfzeile wie Header.tsx der Startseite: 56 px, Linie unten, Logo links, Konto rechts. */
export function AdminBar({displayName,signOutPath}:{displayName?:string;signOutPath?:string}){
 const [dark,setDark]=useDarkMode();
 const mode=dark?'Heller Modus':'Dunkler Modus';
 return <header className="sticky top-0 z-[1100] border-b border-slate-200 bg-white">
  <div className="flex h-[56px] items-center justify-between gap-4 px-4">
   <div className="flex min-w-0 items-center gap-3"><Brand/><span className="hidden text-[14px] text-slate-500 sm:inline">Administration</span></div>
   <div className="flex min-w-0 items-center gap-2 text-[14px] text-slate-500">
    <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-slate-100" title={mode} aria-label={mode} aria-pressed={dark} onClick={()=>setDark(!dark)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{dark?<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>:<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>}</svg></button>
    {signOutPath&&<>
    {displayName&&<span className="hidden max-w-[240px] truncate md:inline">{displayName}</span>}
    <a target="_top" href={signOutPath} className="btn-secondary btn-sm">Abmelden</a></>}</div>
  </div>
 </header>;
}
/** Seitenreiter in der Optik von .ri-topnav; Text bündig mit dem Inhalt (x = 16 px). */
export function AdminTabs({page}:{page:AdminPage}){
 return <nav aria-label="Adminseiten" className="border-b border-slate-200 bg-white px-[max(1vw,16px)]">
  <div className="scroll-thin -mx-2.5 flex gap-1 overflow-x-auto py-1.5">
   {ADMIN_PAGES.map(p=><Link key={p.id} href={adminHref(p.id)} prefetch={false} aria-current={page===p.id?'page':undefined}
    className="inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-lg px-2.5 text-[14px] text-slate-500 hover:bg-slate-100 hover:text-slate-900 aria-[current=page]:font-medium aria-[current=page]:text-slate-900">{p.label}</Link>)}
  </div>
 </nav>;
}
/** Rahmen jeder Adminseite; steht in app/admin/page.tsx, damit Kopf und Reiter beim Seitenwechsel stehen bleiben. */
export function AdminFrame({page,displayName,signOutPath,tabs=true,children}:{page?:AdminPage;displayName?:string;signOutPath?:string;tabs?:boolean;children:ReactNode}){
 const label=ADMIN_PAGES.find(p=>p.id===page)?.label;
 useEffect(()=>{document.title=(label?label+' · ':'')+'Administration · '+BRAND_NAME[DEFAULT_BRAND];},[label]);
 return <div className="ratsmonitor admin-app">
  <AdminBar displayName={displayName} signOutPath={signOutPath}/>
  {tabs&&page&&<AdminTabs page={page}/>}
  {tabs&&<RegionCatchUp/>}
  <main id="inhalt" className="w-full px-[max(1vw,16px)] text-slate-900">{children}
   <footer className="mt-16 flex flex-wrap justify-between gap-x-6 gap-y-2 border-t border-slate-100 py-4 text-[12px] text-slate-500">
    <span className="max-w-[820px]">{page?FOOT[page]:null}</span>
    <span className="flex gap-5">{page&&<Link href={adminHref('uebersicht')+'#begriffe'} className="text-teal-600">Begriffe →</Link>}<a href="/" className="text-teal-600">Zur öffentlichen Website →</a></span>
   </footer>
  </main>
  <ConfirmDialog/>
 </div>;
}
