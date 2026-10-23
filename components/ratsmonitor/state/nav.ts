import {useCallback} from 'react';
import {usePathname,useRouter} from 'next/navigation';
export type View='overview'|'detail'|'konto'|'info';
const viewOf=(p:string):View=>p.startsWith('/beschluss/')?'detail':p.startsWith('/konto')?'konto':p==='/suche'?'overview':'info';
/* Seitenwechsel innerhalb der App seit dem Laden (App.tsx zählt jeden Pfad, der erste ist der Aufruf selbst). Nur dann
   führt „Zurück“ über den Browserverlauf; wer von außen kommt (Link aus E-Mail, Messenger, Suchmaschine), landet sonst dort. */
let routes=0;
export const noteRoute=()=>{routes++;};
export const cameFromApp=()=>routes>1;
/* Zuletzt gezeigte Suche dieses Tabs (/suche?…), geschrieben von SearchProvider (state/search.tsx); übersteht ein Neuladen */
const LAST_SEARCH='rm-last-search';
export const rememberSearchHref=(href:string)=>{try{sessionStorage.setItem(LAST_SEARCH,href);}catch{/* ohne Speicher */}};
export const lastSearchHref=()=>{try{const h=sessionStorage.getItem(LAST_SEARCH);if(h&&h.startsWith('/suche'))return h;}catch{/* ohne Speicher */}return '/suche';};
export const overviewScroll:{current:{y:number;list:number;id:string}|null;listEl:HTMLElement|null}={current:null,listEl:null};
export function useAppNav(){
 const router=useRouter(),view=viewOf(usePathname());
 const push=useCallback((to:string,id='')=>{if(view==='overview')overviewScroll.current={y:window.scrollY,list:(window.matchMedia('(max-width: 639px)').matches?document.querySelector<HTMLElement>('.rm-flat main')?.scrollTop:overviewScroll.listEl?.scrollTop)||0,id};router.push(to,{scroll:false});},[router,view]);
 const goOverview=useCallback(()=>router.push('/suche',{scroll:false}),[router]);
 /* „Zurück“ ohne eigenen Verlauf (Seite neu geladen, am Handy lädt Safari Tabs im Hintergrund oft neu): zur zuletzt gezeigten Suche
    mit ihren Filtern (lastSearchHref), nicht zur leeren Suche, sonst gingen Zeitraum und übrige Filter verloren */
 const goBack=useCallback(()=>router.push(lastSearchHref(),{scroll:false}),[router]);
 return {view,push,goBack,goOverview};
}
