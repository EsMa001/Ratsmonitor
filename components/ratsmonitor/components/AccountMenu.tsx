import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect,useRef,useState} from 'react';
import {IconBell,IconBookmark,IconCalendar,IconHeart,IconStar,IconUser} from './icons';
import {useDarkMode} from '../lib/useDarkMode';
import {useSavedArticles} from '../lib/savedArticles';
import {useAccount} from '../state/account';
import {logout,setViewTier,useMe} from '../lib/account';
import {IS_DEV,TIER_LABEL,type Tier} from '../lib/tier';

/** Aufklappmenü: schließt bei Klick daneben, mit Escape (Fokus zurück auf den Knopf) und wenn der Fokus es per Tab verlässt; setzt den Fokus auf den ersten Eintrag */
function useMenu(){
 const [open,setOpen]=useState(false);
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!open)return;
  const down=(e:MouseEvent)=>{if(!ref.current?.contains(e.target as Node))setOpen(false);};
  const key=(e:KeyboardEvent)=>{if(e.key!=='Escape')return;setOpen(false);if(ref.current?.contains(document.activeElement))ref.current.querySelector<HTMLElement>('button[aria-haspopup]')?.focus();};
  const out=(e:FocusEvent)=>{const next=e.relatedTarget as Node|null;if(next&&!ref.current?.contains(next))setOpen(false);};
  const box=ref.current;
  document.addEventListener('mousedown',down);document.addEventListener('keydown',key);box?.addEventListener('focusout',out);
  box?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus();
  return()=>{document.removeEventListener('mousedown',down);document.removeEventListener('keydown',key);box?.removeEventListener('focusout',out);};
 },[open]);
 return {open,setOpen,ref};
}
const arrowKeys=(e:React.KeyboardEvent<HTMLDivElement>)=>{const items=[...e.currentTarget.querySelectorAll<HTMLElement>('[role^="menuitem"]')],i=items.indexOf(document.activeElement as HTMLElement);if(e.key==='ArrowDown'){e.preventDefault();items[(i+1)%items.length]?.focus();}else if(e.key==='ArrowUp'){e.preventDefault();items[(i-1+items.length)%items.length]?.focus();}};

/** Symbole rechts in der Kopfzeile: Admin (nur für Konten mit der Rolle admin; die Administration fragt bei Bedarf den
 *  zweiten Faktor ab), gespeicherte Suchen, Kalender, gespeicherte Artikel, Konto (mit kleinem Menü, für Admins „Ansehen als“) */
export function AccountMenu({currentPage}:{currentPage:string}){
 const {saved}=useAccount(),articles=useSavedArticles(),me=useMe();
 const router=useRouter();
 const [dark,setDark]=useDarkMode();
 const {open,setOpen,ref}=useMenu();
 const {open:mineOpen,setOpen:setMineOpen,ref:mineRef}=useMenu();
 const base='relative grid h-9 w-9 max-sm:h-11 max-sm:w-11 place-items-center rounded-lg transition-colors';
 const cls=(on:boolean)=>`${base} ${on?'bg-teal-50 text-teal-700':'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`;
 const badge='absolute right-0 top-0 grid h-[14px] min-w-[14px] ring-[1.5px] ring-white place-items-center rounded-full bg-teal-700 px-[3px] text-[12px] font-semibold leading-none text-white';
 const item='block rounded-lg px-3 py-2 text-[14px] text-slate-900 no-underline hover:bg-slate-100';
 const loggedIn=!!me.user;
 const isAdmin=me.roles.includes('admin');
 const VIEWS:[Tier|null,string][]=[[null,'eigene Stufe'],['guest','ohne Stufe (wie Gast)'],['basic',TIER_LABEL.basic],['pro',TIER_LABEL.pro],['enterprise',TIER_LABEL.enterprise]];
 const signOut=async()=>{setOpen(false);await logout();router.push('/');};
 return <nav aria-label="Konto" className="flex items-center gap-0.5">
  {isAdmin&&<Link href="/admin" title={me.adminHere?'Administration':'Administration (Code aus der Authenticator-App nötig)'} aria-label="Administration" className={cls(false)}>
   <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.3 7.5 9.5 4.3-1.2 7.5-5 7.5-9.5V6z"/><path d="m9 12 2 2 4-4"/></svg>
  </Link>}
  {/* Desktop: Suchen, Benachrichtigungen, Kalender und Artikel in einem Menü „Favoriten“ (am Handy übernimmt das Blatt der unteren Leiste) */}
  <div ref={mineRef} className="relative max-sm:hidden">
   <button type="button" title="Favoriten" aria-label={`Favoriten (${saved.length+articles.length})`} aria-haspopup="menu" aria-expanded={mineOpen} onClick={()=>setMineOpen(o=>!o)} className={cls(['suchen','benachrichtigungen','kalender','artikel'].includes(currentPage)||mineOpen)}>
    <IconStar size={19} filled={['suchen','benachrichtigungen','kalender','artikel'].includes(currentPage)}/>
    {saved.length+articles.length>0&&<span className={badge}>{saved.length+articles.length}</span>}
   </button>
   {mineOpen&&<div role="menu" onKeyDown={arrowKeys} className="absolute right-0 top-full z-[1200] mt-1 w-[248px] rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
    {([['suchen','Meine Suchen',<IconHeart key="h" size={17}/>,saved.length],['benachrichtigungen','Benachrichtigungen',<IconBell key="b" size={17}/>,0],['kalender','Kalender',<IconCalendar key="c" size={17}/>,0],['artikel','Gespeicherte Artikel',<IconBookmark key="a" size={17}/>,articles.length]] as [string,string,React.ReactNode,number][]).map(([page,label,icon,count])=>
     <Link key={page} role="menuitem" href={`/konto/${page}`} onClick={()=>setMineOpen(false)} aria-current={currentPage===page?'page':undefined} className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] no-underline hover:bg-slate-100 ${currentPage===page?'font-medium text-teal-700':'text-slate-900'}`}>
      <span className="text-slate-500" aria-hidden="true">{icon}</span><span className="flex-1">{label}</span>{count>0&&<span className="tabular-nums text-slate-500">{count}</span>}
     </Link>)}
   </div>}
  </div>
  <div ref={ref} className="relative">
   <button type="button" title="Konto" aria-label="Konto" aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(o=>!o)} className={cls(currentPage==='profil'||open)}>
    <IconUser size={19} className="max-sm:!h-[23px] max-sm:!w-[23px]"/>
   </button>
   {open&&<div role="menu" onKeyDown={e=>{const items=[...e.currentTarget.querySelectorAll<HTMLElement>('[role^="menuitem"]')],i=items.indexOf(document.activeElement as HTMLElement);if(e.key==='ArrowDown'){e.preventDefault();items[(i+1)%items.length]?.focus();}else if(e.key==='ArrowUp'){e.preventDefault();items[(i-1+items.length)%items.length]?.focus();}}} className="absolute right-0 top-[calc(100%+13px)] z-[1100] w-[220px] max-sm:w-[230px] sm:top-[calc(100%+17px)] rounded-2xl border border-slate-200 bg-white p-1.5 shadow-pop">
    {loggedIn&&<p className="m-0 truncate px-3 pb-1 pt-2 text-[12px] text-slate-500" title={me.user?.email}>{me.user?.email}</p>}
    {!loggedIn&&me.accounts&&<Link role="menuitem" href="/anmelden" className={item} onClick={()=>setOpen(false)}>Anmelden</Link>}
    <Link role="menuitem" href="/konto/profil" className={item} onClick={()=>setOpen(false)}>Konto</Link>
    {/* Preise stehen am Desktop im Menü der Kopfzeile; Hell/Dunkel gilt überall hier */}
    <Link role="menuitem" href="/preise" className={`${item} sm:hidden`} onClick={()=>setOpen(false)}>Preise</Link>
    <button role="menuitemcheckbox" type="button" aria-checked={dark} onClick={()=>setDark(!dark)} className={`${item} flex w-full items-center justify-between text-left`}>
     Dunkler Modus
     <span className={`h-5 w-9 rounded-full p-0.5 transition-colors ${dark?'bg-teal-700':'bg-slate-300'}`} aria-hidden="true"><span className={`block h-4 w-4 rounded-full bg-white transition-transform ${dark?'translate-x-4':''}`}/></span>
    </button>
    {isAdmin&&<div className="border-t border-slate-100 px-3 pb-1 pt-2">
     <label htmlFor="view-tier" className="block text-[12px] text-slate-500">Ansehen als</label>
     <select id="view-tier" className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[14px] max-sm:text-[16px] text-slate-900" value={me.viewTier??''}
      onChange={e=>{const v=e.target.value;void setViewTier(v?(v as Tier):null);}}>
      {VIEWS.map(([t,label])=><option key={label} value={t??''}>{label}</option>)}
     </select>
     {me.viewTier&&<p className="m-0 mt-1 text-[12px] text-amber-700">Ansicht: {me.viewTier==='guest'?'ohne Stufe':TIER_LABEL[me.viewTier]}</p>}
    </div>}
    {IS_DEV&&<Link role="menuitem" href="/konto/postfach" className={item} onClick={()=>setOpen(false)}>Dev-Postfach</Link>}
    {loggedIn&&<button role="menuitem" type="button" onClick={()=>void signOut()} className={`${item} w-full text-left`}>Abmelden</button>}
   </div>}
  </div>
 </nav>;
}
