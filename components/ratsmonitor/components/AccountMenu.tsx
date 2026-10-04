import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {IconBookmark,IconCalendar,IconHeart,IconUser} from './icons';
import {useSavedArticles} from '../lib/savedArticles';
import {useAccount} from '../state/account';
import {IS_DEV,setTier,useTier} from '../lib/tier';

/** Symbole rechts in der Kopfzeile: Admin, gespeicherte Suchen, Kalender, gespeicherte Artikel, Konto (mit kleinem Menü) */
export function AccountMenu({currentPage}:{currentPage:string}){
 const {saved}=useAccount(),articles=useSavedArticles(),{tier}=useTier();
 const [open,setOpen]=useState(false);
 const ref=useRef<HTMLDivElement>(null);
 /* Konto-Menü schließt bei Klick daneben und mit Escape */
 useEffect(()=>{
  if(!open)return;
  const down=(e:MouseEvent)=>{if(!ref.current?.contains(e.target as Node))setOpen(false);};
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false);};
  document.addEventListener('mousedown',down);document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('mousedown',down);document.removeEventListener('keydown',key);};
 },[open]);
 const base='relative grid h-9 w-9 place-items-center rounded-lg transition-colors';
 const cls=(on:boolean)=>`${base} ${on?'bg-teal-50 text-teal-700':'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`;
 const badge='absolute right-0 top-0 grid h-[14px] min-w-[14px] ring-[1.5px] ring-white place-items-center rounded-full bg-teal-600 px-[3px] text-[12px] font-semibold leading-none text-white';
 const item='block rounded-lg px-3 py-2 text-[14px] text-slate-900 no-underline hover:bg-slate-100';
 const loggedIn=tier!=='guest';
 const logout=()=>{setOpen(false);if(IS_DEV)setTier('guest');else window.location.href='/signout-with-chatgpt?return_to=/';};
 return <nav aria-label="Konto" className="flex items-center gap-0.5">
  <Link href="/admin" title="Administration" aria-label="Administration" className={cls(false)}>
   <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.3 7.5 9.5 4.3-1.2 7.5-5 7.5-9.5V6z"/><path d="m9 12 2 2 4-4"/></svg>
  </Link>
  <Link href="/konto/suchen" title="Gespeicherte Suchen" aria-label={`Gespeicherte Suchen (${saved.length})`} className={cls(currentPage==='suchen')}>
   <IconHeart size={19} filled={currentPage==='suchen'}/>
   {saved.length>0&&<span className={badge}>{saved.length}</span>}
  </Link>
  <Link href="/konto/kalender" title="Kalender" aria-label="Kalender" className={cls(currentPage==='kalender')}>
   <IconCalendar size={19}/>
  </Link>
  <Link href="/konto/artikel" title="Gespeicherte Artikel" aria-label={`Gespeicherte Artikel (${articles.length})`} className={cls(currentPage==='artikel')}>
   <IconBookmark size={19} filled={currentPage==='artikel'}/>
   {articles.length>0&&<span className={badge}>{articles.length}</span>}
  </Link>
  <div ref={ref} className="relative">
   <button type="button" title="Konto" aria-label="Konto" aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(o=>!o)} className={cls(currentPage==='profil'||open)}>
    <IconUser size={19}/>
   </button>
   {open&&<div role="menu" className="absolute right-0 top-[calc(100%+6px)] z-[1100] w-[220px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-pop">
    <p className="m-0 px-3 pb-1 pt-1.5 text-[12px] text-slate-500">{loggedIn?'Angemeldet':'Nicht angemeldet'}</p>
    {!loggedIn&&<>
     <Link role="menuitem" href="/anmelden" className={item} onClick={()=>setOpen(false)}>Anmelden</Link>
     <Link role="menuitem" href="/registrieren" className={item} onClick={()=>setOpen(false)}>Registrieren</Link>
    </>}
    <Link role="menuitem" href="/konto/profil" className={item} onClick={()=>setOpen(false)}>Konto</Link>
    {loggedIn&&<button role="menuitem" type="button" onClick={logout} className={`${item} w-full text-left`}>Abmelden</button>}
   </div>}
  </div>
 </nav>;
}
