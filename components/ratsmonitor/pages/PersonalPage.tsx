import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useState} from 'react';
import {useAccount} from '../state/account';
import {useSearch} from '../state/search';
import {useAppNav} from '../state/nav';
import {SavedSearchesPage} from './SavedSearchesPage';
import {ProfilePage} from './ProfilePage';
import {SavedArticlesPage} from './SavedArticlesPage';
import {KalenderPage} from './KalenderPage';
import {PostfachPage} from './PostfachPage';
export function PersonalPage(){
 const path=usePathname(),savedPage=path.endsWith('/suchen'),{saved,ready,removeSaved}=useAccount(),search=useSearch(),{goOverview}=useAppNav(),[error,setError]=useState('');
 /* Kontoseiten im Layout der Info- und Branchenseiten: Kopfbereich und Band */
 if(path.endsWith('/artikel'))return <main id="inhalt" className="ri"><SavedArticlesPage/></main>;
 if(path.endsWith('/profil'))return <main id="inhalt" className="ri"><ProfilePage/></main>;
 if(path.endsWith('/postfach'))return <main id="inhalt" className="ri"><PostfachPage/></main>;
 if(path.endsWith('/kalender'))return <main id="inhalt" className="ri"><KalenderPage/></main>;
 if(savedPage)return <main id="inhalt" className="ri"><SavedSearchesPage/></main>;
 return <main id="inhalt" className="mx-auto max-w-page py-[12px]"><section>
 <h1 className="text-[28px] font-bold tracking-tight">{savedPage?'Gespeicherte Suchen':'Hilfe & Datenquellen'}</h1>
 {savedPage?<><p className="mt-3 text-slate-600">Ihre Suchen bleiben in diesem Browser gespeichert. Kein Benutzerkonto erforderlich; keine Synchronisierung und kein E-Mail-Versand.</p>{error&&<p role="alert" className="mt-4 text-rose-700">{error}</p>}{ready&&!saved.length&&<div className="card-shell mt-6 p-8"><h2 className="text-[18px] font-semibold">Noch keine gespeicherten Suchen</h2><p className="mt-2 text-slate-500">Stelle deine Filter in der Übersicht ein und wähle „Suche speichern“.</p><Link className="btn-primary mt-5" href="/">Suche öffnen</Link></div>}{saved.map(s=><article key={s.id} className="card-shell mt-4 p-5"><h2 className="text-[18px] font-semibold">{s.name}</h2><p className="mt-2 text-[14px] text-slate-500">{s.level==='district'?'Kreise':'Städte & Gemeinden'} · {s.text||'Alle Themen'}{s.monat?' · '+s.monat:''}</p><div className="mt-4 flex gap-3"><button className="btn-primary" onClick={()=>{if(search.applySaved(s))goOverview();else setError('Die Karte für die Umkreissuche lädt noch. Bitte erneut versuchen.');}}>Suche öffnen</button><button className="btn-secondary" onClick={()=>{try{removeSaved(s.id);}catch{setError('Die Änderung konnte nicht gespeichert werden.');}}}>Entfernen</button></div></article>)}</>:<div className="card-shell mt-6 space-y-6 p-6">
 <section><h2 className="text-[18px] font-semibold">Was wird hier gezeigt?</h2><p className="mt-2 text-slate-600">Öffentlich erfasste Vorlagen, Beratungen und Entscheidungen. Ein angekündigter Vorgang ist noch kein Beschluss. Maßgeblich bleiben die verlinkten Originalquellen.</p></section>
 <section><h2 className="text-[18px] font-semibold">Karte und Umkreis</h2><p className="mt-2 text-slate-600">Suche nach einem Ort oder wähle ein Gebiet auf der Karte. Die Umkreissuche berücksichtigt Gebiete, deren Fläche den Kreis berührt. Kommunale und Kreisvorgänge werden getrennt gefiltert. Schraffierte Flächen haben keinen gespeicherten Bestand; sie belegen keine fehlende politische Aktivität.</p></section>
 <section><h2 className="text-[18px] font-semibold">Datenlücken und KI</h2><p className="mt-2 text-slate-600">Die Daten sind keine vollständige Erhebung. Fehlende Inhalte und veraltete Analysen bleiben sichtbar. KI-Zusammenfassungen können Fehler enthalten; die Detailseite zeigt Quellen und Bearbeitungsstand.</p><Link className="link-btn mt-3 inline-block" href="/quellen">Quellen und Abdeckung prüfen</Link></section>
 <section className="max-sm:hidden"><h2 className="text-[18px] font-semibold">Administration</h2><p className="mt-2 text-slate-600">Datenabruf, Regelverarbeitung, manuelle KI-Aufträge und Datenbanksicherung stehen in der geschützten Projektsteuerung bereit.</p><Link className="btn-primary mt-4" href="/admin">Admin-Projektsteuerung öffnen</Link></section>
 <p className="border-t border-slate-200 pt-4 text-[14px] text-slate-500">Ein Kontakt- oder E-Mail-Dienst ist noch nicht eingerichtet. Es werden keine Supportanfragen oder Benachrichtigungen vorgetäuscht.</p></div>}
 </section></main>;
}
