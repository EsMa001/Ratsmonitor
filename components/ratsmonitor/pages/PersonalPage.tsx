import {usePathname,useRouter} from 'next/navigation';
import {useEffect} from 'react';
import {SavedSearchesPage} from './SavedSearchesPage';
import {ProfilePage} from './ProfilePage';
import {SavedArticlesPage} from './SavedArticlesPage';
import {KalenderPage} from './KalenderPage';
import {PostfachPage} from './PostfachPage';
/** Kontoseiten im Layout der Info- und Branchenseiten. /konto und die frühere Hilfeseite führen auf das Profil
 *  (beim ersten Aufruf leitet schon der Server um, app/(monitor)/konto/[[...section]]/page.tsx). */
export function PersonalPage(){
 const path=usePathname(),router=useRouter();
 const page=path.split('/')[2]||'';
 const known=['artikel','profil','postfach','kalender','suchen'].includes(page);
 useEffect(()=>{if(!known)router.replace('/konto/profil');},[known,router]);
 if(page==='artikel')return <main id="inhalt" className="ri ri-konto"><SavedArticlesPage/></main>;
 if(page==='profil')return <main id="inhalt" className="ri"><ProfilePage/></main>;
 if(page==='postfach')return <main id="inhalt" className="ri"><PostfachPage/></main>;
 if(page==='kalender')return <main id="inhalt" className="ri ri-konto"><KalenderPage/></main>;
 if(page==='suchen')return <main id="inhalt" className="ri ri-konto"><SavedSearchesPage/></main>;
 return null;
}
