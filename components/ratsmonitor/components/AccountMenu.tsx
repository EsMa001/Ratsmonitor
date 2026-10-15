import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect,useRef,useState} from 'react';
import {IconBookmark,IconCalendar,IconHeart,IconUser} from './icons';
import {useDarkMode} from '../lib/useDarkMode';
import {useSavedArticles} from '../lib/savedArticles';
import {useAccount} from '../state/account';
import {logout,useMe} from '../lib/account';
import {IS_DEV} from '../lib/tier';

/** Symbole rechts in der Kopfzeile: Admin (nur mit Admin-Recht hier), gespeicherte Suchen, Kalender, gespeicherte Artikel, Konto (mit kleinem Menü) */
export function AccountMenu({currentPage}:{currentPage:string}){
 const {saved}=useAccount(),articles=useSavedArticles(),me=useMe();
 const router=useRouter();
 const [dark,setDark]=useDarkMode();
 const [open,setOpen]=useState(false);
 const ref=useRef<HTMLDivElement>(null);
 /* Konto-Menü schließt bei Klick daneben und mit Escape */
 useEffect(()=>{
  if(!open)return;
  const down=(e:MouseEvent)=>{if(!ref.current?.contains(e.target as Node))setOpen(false);};
  const key=(e:KeyboardEvent)=>{if(e.key!=='Escape')return;setOpen(false);/* Fokus zurück auf den Konto-Knopf */if(ref.current?.contains(document.activeElement))ref.current.querySelector<HTMLElement>('button[aria-haspopup]')?.focus();};
  document.addEventListener('mousedown',down);document.addEventListener('keydown',key);
  /* Fokus auf den ersten Eintrag, damit die Pfeiltasten gleich wirken (Tastatur und Bildschirmleser) */
  ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  return()=>{document.removeEventListener('mousedown',down);document.removeEventListener('keydown',key);};
 },[open]);
 const base='relative grid h-9 w-9 max-sm:h-11 max-sm:w-11 place-items-center rounded-lg transition-colors';
 const cls=(on:boolean)=>`${base} ${on?'bg-teal-50 text-teal-700':'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`;
 const badge='absolute right-0 top-0 grid h-[14px] min-w-[14px] ring-[1.5px] ring-white place-items-center rounded-full bg-teal-700 px-[3px] text-[12px] font-semibold leading-none text-white';
 const item='block rounded-lg px-3 py-2 text-[14px] text-slate-900 no-underline hover:bg-slate-100';
 const loggedIn=!!me.user;
 const signOut=async()=>{setOpen(false);await logout();router.push('/');};
 return <nav aria-label="Konto" className="flex items-center gap-0.5">
  {me.adminHere&&<Link href="/admin" title="Administration" aria-label="Administration" className={cls(false)}>
   <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.3 7.5 9.5 4.3-1.2 7.5-5 7.5-9.5V6z"/><path d="m9 12 2 2 4-4"/></svg>
  </Link>}
  <button type="button" title={dark?'Heller Modus':'Dunkler Modus'} aria-label={dark?'Heller Modus':'Dunkler Modus'} aria-pressed={dark} onClick={()=>setDark(!dark)} className={cls(false)}>
   <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{dark?<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>:<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>}</svg>
  </button>
  <Link href="/konto/suchen" title="Gespeicherte Suchen" aria-label={`Gespeicherte Suchen (${saved.length})`} className={`${cls(currentPage==='suchen')} max-sm:hidden`}>
   <IconHeart size={19} filled={currentPage==='suchen'}/>
   {saved.length>0&&<span className={badge}>{saved.length}</span>}
  </Link>
  <Link href="/konto/kalender" title="Kalender" aria-label="Kalender" className={`${cls(currentPage==='kalender')} max-sm:hidden`}>
   <IconCalendar size={19}/>
  </Link>
  <Link href="/konto/artikel" title="Gespeicherte Artikel" aria-label={`Gespeicherte Artikel (${articles.length})`} className={`${cls(currentPage==='artikel')} max-sm:hidden`}>
   <IconBookmark size={19} filled={currentPage==='artikel'}/>
   {articles.length>0&&<span className={badge}>{articles.length}</span>}
  </Link>
  <div ref={ref} className="relative">
   <button type="button" title="Konto" aria-label="Konto" aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(o=>!o)} className={cls(currentPage==='profil'||open)}>
    <IconUser size={19}/>
   </button>
   {open&&<div role="menu" onKeyDown={e=>{const items=[...e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')],i=items.indexOf(document.activeElement as HTMLElement);if(e.key==='ArrowDown'){e.preventDefault();items[(i+1)%items.length]?.focus();}else if(e.key==='ArrowUp'){e.preventDefault();items[(i-1+items.length)%items.length]?.focus();}}} className="absolute right-0 top-[calc(100%+13px)] z-[1100] w-[220px] max-sm:w-[190px] sm:top-[calc(100%+17px)] rounded-2xl border border-slate-200 bg-white p-1.5 shadow-pop">
    {loggedIn&&<p className="m-0 truncate px-3 pb-1 pt-2 text-[12px] text-slate-500" title={me.user?.email}>{me.user?.email}</p>}
    {!loggedIn&&me.accounts&&<Link role="menuitem" href="/anmelden" className={item} onClick={()=>setOpen(false)}>Anmelden</Link>}
    <Link role="menuitem" href="/konto/profil" className={item} onClick={()=>setOpen(false)}>Konto</Link>
    {IS_DEV&&<Link role="menuitem" href="/konto/postfach" className={item} onClick={()=>setOpen(false)}>Dev-Postfach</Link>}
    {loggedIn&&<button role="menuitem" type="button" onClick={()=>void signOut()} className={`${item} w-full text-left`}>Abmelden</button>}
   </div>}
  </div>
 </nav>;
}
