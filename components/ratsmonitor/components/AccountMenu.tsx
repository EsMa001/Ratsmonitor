import Link from 'next/link';
import {IconUser} from './icons';
import {useAccount} from '../state/account';
export function AccountMenu({currentPage}:{currentPage:string}){
 const {saved}=useAccount();
 return <details className="relative [grid-area:account]"><summary aria-label="Navigation öffnen" className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"><IconUser size={18}/><span className="hidden sm:inline">Mein Bereich</span></summary><nav id="account-menu" aria-label="Hauptnavigation" className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-pop">
 {[['/','Übersicht'],['/konto/suchen',`Gespeicherte Suchen (${saved.length})`],['/analysen','Analysen & Vergleiche'],['/quellen','Quellen & Datenabdeckung'],['/mitteilungen','Push-Mitteilungen'],['/konto/hilfe','Hilfe'],['/admin','Admin-Projektsteuerung']].map(([href,title])=><Link onClick={e=>e.currentTarget.closest('details')?.removeAttribute('open')} className="block rounded-lg px-3 py-2.5 text-sm hover:bg-teal-50 hover:text-teal-800" key={href} href={href}>{title}</Link>)}
 <p className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500">Suchen werden in diesem Browser gespeichert.</p></nav></details>;
}
