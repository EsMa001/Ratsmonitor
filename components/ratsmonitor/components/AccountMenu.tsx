import Link from 'next/link';
import {IconBookmark,IconHeart,IconUser} from './icons';
import {useSavedArticles} from '../lib/savedArticles';
import {useAccount} from '../state/account';

/** Drei Symbole rechts in der Kopfzeile: Admin, gespeicherte Suchen, Konto */
export function AccountMenu({currentPage}:{currentPage:string}){
 const {saved}=useAccount(),articles=useSavedArticles();
 const base='relative grid h-9 w-9 place-items-center rounded-lg transition-colors';
 const cls=(on:boolean)=>`${base} ${on?'bg-teal-50 text-teal-700':'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`;
 return <nav aria-label="Konto" className="flex items-center gap-0.5">
  <Link href="/admin" title="Administration" aria-label="Administration" className={cls(false)}>
   <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.3 7.5 9.5 4.3-1.2 7.5-5 7.5-9.5V6z"/><path d="m9 12 2 2 4-4"/></svg>
  </Link>
  <Link href="/konto/suchen" title="Gespeicherte Suchen" aria-label={`Gespeicherte Suchen (${saved.length})`} className={cls(currentPage==='suchen')}>
   <IconHeart size={19} filled={currentPage==='suchen'}/>
   {saved.length>0&&<span className="absolute right-0 top-0 grid h-[14px] min-w-[14px] ring-[1.5px] ring-white place-items-center rounded-full bg-teal-600 px-[3px] text-[12px] font-semibold leading-none text-white">{saved.length}</span>}
  </Link>
  <Link href="/konto/artikel" title="Gespeicherte Artikel" aria-label={`Gespeicherte Artikel (${articles.length})`} className={cls(currentPage==='artikel')}>
   <IconBookmark size={19} filled={currentPage==='artikel'}/>
   {articles.length>0&&<span className="absolute right-0 top-0 grid h-[14px] min-w-[14px] ring-[1.5px] ring-white place-items-center rounded-full bg-teal-600 px-[3px] text-[12px] font-semibold leading-none text-white">{articles.length}</span>}
  </Link>
  <Link href="/konto/profil" title="Konto" aria-label="Konto" className={cls(currentPage==='profil')}>
   <IconUser size={19}/>
  </Link>
 </nav>;
}
