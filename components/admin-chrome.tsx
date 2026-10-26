'use client';
import Link from 'next/link';
import {useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {Brand} from '@/components/ratsmonitor/components/Brand';
import {useDarkMode} from '@/components/ratsmonitor/lib/useDarkMode';
import {ConfirmDialog} from '@/components/ratsmonitor/components/ConfirmDialog';
import {IconChevronDown} from '@/components/ratsmonitor/components/icons';
import {BRAND_NAME,DEFAULT_BRAND} from '@/components/ratsmonitor/lib/brands';
import {FOOT,PAGE_HEAD} from '@/components/admin-texts';
import {Icon} from '@/components/admin-icons';
import {RegionCatchUp} from '@/components/admin-catch-up';
import {AdminSignOut} from './admin-signout';

// Rahmen aller Adminseiten im Design der Startseite: Kopfzeile wie Header.tsx mit dem Menü wie MainMenu.tsx (Gruppen klappen
// auf, je Eintrag Symbol, Name und leise die Frage, die die Seite beantwortet), Inhalt mit der Seitenbreite der Startseite und
// eine Fußzeile. Die Seiten heißen in der Adresse nach ihrem Inhalt (?seite=abruf); frühere Namen und die Nummern 1 bis 3
// führen weiter (app/admin/page.tsx). Startseite des Adminbereichs ist das Cockpit (ohne Parameter).
export type AdminPage='start'|'abdeckung'|'atlas'|'nacht'|'abruf'|'pdf'|'verarbeitung'|'altbestand'|'regeltexte'|'pruefliste'|'bestand'|'steuerung'|'fehler'|'speicher'|'todo'|'hochrechnung'|'social'|'konten';
export type AdminEntry={id:AdminPage;label:string;icon:string;hint:string};
/** Gruppen des Menüs in der Reihenfolge der Arbeit: was erreichen wir, wie kommen die Daten herein, stimmt der Bestand,
    läuft der Server, was ist geplant. */
export const ADMIN_GROUPS:{id:string;label:string;icon:string;pages:AdminEntry[]}[]=[
 {id:'abdeckung',label:'Abdeckung',icon:'map',pages:[
  {id:'abdeckung',label:'Abdeckung',icon:'chart',hint:'Wie viel erreichen wir?'},
  {id:'atlas',label:'Lückenatlas',icon:'map',hint:'Wo fehlt was?'}]},
 {id:'pipeline',label:'Pipeline',icon:'download',pages:[
  {id:'nacht',label:'Letzte Nacht',icon:'moon',hint:'Lief alles?'},
  {id:'abruf',label:'Abruf',icon:'download',hint:'Was holen wir?'},
  {id:'pdf',label:'PDF-Import',icon:'file',hint:'Welche Unterlagen liegen vor?'},
  {id:'verarbeitung',label:'KI-Aufbereitung',icon:'tags',hint:'Was hat die KI bearbeitet?'},
  {id:'altbestand',label:'Altbestand',icon:'archive',hint:'Was holen wir nach?'}]},
 {id:'qualitaet',label:'Qualität',icon:'checklist',pages:[
  {id:'regeltexte',label:'Einordnungsmodell',icon:'text',hint:'Wie gut ist das Modell?'},
  {id:'pruefliste',label:'Prüfliste',icon:'checklist',hint:'Was braucht einen Blick?'},
  {id:'bestand',label:'Bestandsprüfung',icon:'database',hint:'Ist der Bestand stimmig?'}]},
 {id:'kunden',label:'Kunden',icon:'users',pages:[
  {id:'konten',label:'Konten',icon:'users',hint:'Wer nutzt Plenara, wer zahlt?'}]},
 {id:'betrieb',label:'Betrieb',icon:'server',pages:[
  {id:'steuerung',label:'Steuerung',icon:'clock',hint:'Was läuft, was starte ich?'},
  {id:'fehler',label:'Fehler & Server',icon:'alert',hint:'Was scheitert?'},
  {id:'speicher',label:'Speicher & Sicherungen',icon:'drive',hint:'Reicht der Platz?'}]},
 {id:'planung',label:'Planung',icon:'calculator',pages:[
  {id:'todo',label:'To-do-Liste',icon:'check',hint:'Was steht an?'},
  {id:'hochrechnung',label:'Hochrechnung',icon:'calculator',hint:'Wie viel fällt an?'},
  {id:'social',label:'Social Media',icon:'megaphone',hint:'Was posten wir?'}]},
];
export const START_PAGE:AdminPage='start';
const START:AdminEntry={id:'start',label:'Cockpit',icon:'gauge',hint:'Wie steht es?'};
/** Alle Seiten in Menüfolge, das Cockpit zuerst. */
export const ADMIN_PAGES:AdminEntry[]=[START,...ADMIN_GROUPS.flatMap(g=>g.pages)];
/** Seiten der Administration, lokal und auf dem Server gleich. */
export const VISIBLE_PAGES=ADMIN_PAGES;
/** Gruppe einer Seite (für Pfadzeile und Menü); das Cockpit hat keine. */
export const groupOf=(page:AdminPage)=>ADMIN_GROUPS.find(g=>g.pages.some(p=>p.id===page));
/** Adresse einer Adminseite, mit weiteren Parametern ("filter=issues"). */
export const adminHref=(page:AdminPage,params='')=>'/admin'+(page===START_PAGE?(params?'?'+params:''):'?seite='+page+(params?'&'+params:''));

const MENU_GAP=6;
/** Menü der Administration wie MainMenu.tsx: breite Bildschirme Cockpit und Gruppen in der Kopfzeile, jede Gruppe klappt
    als Liste auf; schmale ein Dreistrichmenü mit allen Gruppen untereinander, die der aktuellen Seite offen. */
function AdminMenu({page}:{page?:AdminPage}){
 const [open,setOpen]=useState<false|string>(false),[pos,setPos]=useState({top:60,left:8});
 const current=page?groupOf(page)?.id:undefined;
 const [openGroup,setOpenGroup]=useState(current||'');
 const btnRef=useRef<HTMLButtonElement>(null),panelRef=useRef<HTMLDivElement>(null);
 const close=useCallback(()=>setOpen(false),[]);
 // Seitenwechsel schließt das Menü
 const [openedAt,setOpenedAt]=useState(page);
 if(openedAt!==page){setOpenedAt(page);setOpen(false);}
 useEffect(()=>{
  if(!open)return;
  const onDown=(e:PointerEvent)=>{const t=e.target as Node;if(panelRef.current?.contains(t)||(t instanceof Element&&t.closest('[data-admin-menu]')))return;setOpen(false);};
  const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();setOpen(false);}};
  document.addEventListener('pointerdown',onDown);document.addEventListener('keydown',onKey);
  panelRef.current?.focus();
  return()=>{document.removeEventListener('pointerdown',onDown);document.removeEventListener('keydown',onKey);};
 },[open]);
 const toggle=(which:string,el:HTMLElement)=>{
  if(open===which)return close();
  const btn=el.getBoundingClientRect(),head=el.closest('header')?.getBoundingClientRect();
  setPos({top:Math.max(0,Math.round((head?.bottom??56)+MENU_GAP)),left:Math.max(8,Math.round(btn.left))});
  setOpen(which);
 };
 const show=(g:string)=>open==='all'?openGroup===g:open===g;
 const item=(p:AdminEntry)=><li key={p.id}><Link href={adminHref(p.id)} prefetch={false} className="ri-menu__sub" aria-current={page===p.id?'page':undefined} onClick={close}>
  <Icon name={p.icon} size={15}/><span className="shrink-0">{p.label}</span><span className="ml-auto min-w-0 truncate pl-5 text-[12px] font-normal text-slate-400 max-sm:hidden" title={p.hint}>{p.hint}</span></Link></li>;
 return <>
  <button ref={btnRef} type="button" data-admin-menu className="ri-burger" aria-label={open==='all'?'Menü schließen':'Menü öffnen'} aria-expanded={open==='all'} aria-controls="adminmenue" onClick={e=>toggle('all',e.currentTarget)}>
   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden="true"><path d="M4 6.5h16M4 12h12M4 17.5h8"/></svg>
  </button>
  <nav aria-label="Adminseiten" className="ri-topnav order-last !ml-6 hidden xl:flex">
   <Link href={adminHref(START_PAGE)} prefetch={false} aria-current={page===START_PAGE?'page':undefined}>Cockpit</Link>
   {ADMIN_GROUPS.map(g=><button key={g.id} type="button" data-admin-menu aria-expanded={open===g.id} aria-controls="adminmenue" className={current===g.id?'!font-medium !text-slate-900':''} onClick={e=>toggle(g.id,e.currentTarget)}>
    {g.label}<IconChevronDown size={14} className={open===g.id?'rotate-180':''}/></button>)}
  </nav>
  {open&&createPortal(<div className="ri-menu">
   <div className="ri-menu__bg" onClick={close} aria-hidden="true"/>
   <div ref={panelRef} id="adminmenue" tabIndex={-1} role="dialog" aria-label="Adminseiten" className={'ri-menu__panel outline-none'+(open!=='all'?' ri-menu__panel--flyout':'')} style={{top:pos.top,left:pos.left,maxHeight:`calc(100dvh - ${pos.top}px - 12px)`}}>
    <nav className="ri-menu__nav" aria-label="Menü">
     {open==='all'&&<ul className="ri-menu__subs">{item(START)}</ul>}
     {ADMIN_GROUPS.map(g=><div key={g.id}>
      {open==='all'&&<button type="button" className="ri-menu__main ri-menu__group" aria-expanded={openGroup===g.id} onClick={()=>setOpenGroup(openGroup===g.id?'':g.id)}>
       <span className="flex items-center gap-2.5"><Icon name={g.icon} size={18} className="text-teal-700"/>{g.label}</span><IconChevronDown size={16} className={'ri-menu__chev '+(openGroup===g.id?'rotate-180':'')}/></button>}
      {show(g.id)&&<ul className={'ri-menu__subs'+(open==='all'?' pl-7':'')}>{g.pages.map(item)}</ul>}
     </div>)}
    </nav>
   </div>
  </div>,document.body)}
 </>;
}

/** Kopfzeile wie Header.tsx der Startseite: 56 px, Linie unten, Logo und Menü links, Konto rechts. */
export function AdminBar({page,menu=true,displayName,signOutPath,accountSignOut}:{page?:AdminPage;menu?:boolean;displayName?:string;signOutPath?:string;accountSignOut?:boolean}){
 const [dark,setDark]=useDarkMode();
 const mode=dark?'Heller Modus':'Dunkler Modus';
 return <header className="sticky top-0 z-[1100] border-b border-slate-200 bg-white">
  <div className="flex h-[56px] items-center justify-between gap-4 px-4">
   <div className="flex min-w-0 items-center gap-3">{menu&&<AdminMenu page={page}/>}<Brand/><span className="hidden text-[14px] text-slate-500 sm:inline">Administration</span></div>
   <div className="flex min-w-0 items-center gap-2 text-[14px] text-slate-500">
    <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-slate-100" title={mode} aria-label={mode} aria-pressed={dark} onClick={()=>setDark(!dark)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{dark?<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>:<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>}</svg></button>
    {displayName&&<span className="hidden max-w-[240px] truncate md:inline">{displayName}</span>}
    {/* Abmelden nur mit ChatGPT-Anmeldung (app/admin/page.tsx); auf dem eigenen Server gibt es keinen Abmeldeweg. */}
    {signOutPath&&<a target="_top" href={signOutPath} className="btn-secondary btn-sm">Abmelden</a>}{!signOutPath&&accountSignOut&&<AdminSignOut/>}</div>
  </div>
 </header>;
}
/** Rahmen jeder Adminseite; steht in app/admin/page.tsx, damit Kopf und Menü beim Seitenwechsel stehen bleiben. */
export function AdminFrame({page,displayName,signOutPath,accountSignOut,tabs=true,children}:{page?:AdminPage;displayName?:string;signOutPath?:string;accountSignOut?:boolean;tabs?:boolean;children:ReactNode}){
 const label=ADMIN_PAGES.find(p=>p.id===page)?.label;
 useEffect(()=>{document.title=(label?label+' · ':'')+'Administration · '+BRAND_NAME[DEFAULT_BRAND];},[label]);
 return <div className="ratsmonitor admin-app">
  <AdminBar page={page} menu={tabs} displayName={displayName} signOutPath={signOutPath} accountSignOut={accountSignOut}/>
  {tabs&&<RegionCatchUp/>}
  <main id="inhalt" className="w-full px-[max(1vw,16px)] text-slate-900">{children}
   <footer className="mt-16 flex flex-wrap justify-between gap-x-6 gap-y-2 border-t border-slate-100 py-4 text-[12px] text-slate-500">
    {/* Über diese Seite: Einleitung und Grundlage (früher unter der Überschrift), wie die Methodik auf plenara.X */}
    {page?<div className="max-w-[820px]"><p className="m-0 text-[14px] font-semibold text-slate-700">Über diese Seite</p><p className="m-0 mt-1">{PAGE_HEAD[page].intro} {FOOT[page]}</p></div>:<span/>}
    {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- raus aus der Administration mit vollem Laden (eigenes Layout und eigene Stile) */}
    <span className="flex gap-5">{page&&<Link href={adminHref('abdeckung')+'#begriffe'} className="text-teal-600">Begriffe →</Link>}<a href="/" className="text-teal-600">Zur öffentlichen Website →</a></span>
   </footer>
  </main>
  <ConfirmDialog/>
 </div>;
}
