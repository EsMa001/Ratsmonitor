import {useCallback} from 'react';
import {usePathname,useRouter} from 'next/navigation';
export type View='overview'|'detail'|'konto'|'info';
export const viewOf=(p:string):View=>p.startsWith('/beschluss/')?'detail':p.startsWith('/konto')?'konto':p==='/suche'?'overview':'info';
/* Seitenwechsel innerhalb der App seit dem Laden (App.tsx zählt jeden Pfad, der erste ist der Aufruf selbst). Nur dann
   führt „Zurück“ über den Browserverlauf; wer von außen kommt (Link aus E-Mail, Messenger, Suchmaschine), landet sonst dort. */
let routes=0;
export const noteRoute=()=>{routes++;};
export const cameFromApp=()=>routes>1;
export const overviewScroll:{current:{y:number;list:number;id:string}|null;listEl:HTMLElement|null}={current:null,listEl:null};
export function useAppNav(){
 const router=useRouter(),view=viewOf(usePathname());
 const push=useCallback((to:string,id='')=>{if(view==='overview')overviewScroll.current={y:window.scrollY,list:(window.matchMedia('(max-width: 639px)').matches?document.querySelector<HTMLElement>('.rm-flat main')?.scrollTop:overviewScroll.listEl?.scrollTop)||0,id};router.push(to,{scroll:false});},[router,view]);
 const goOverview=useCallback(()=>router.push('/suche',{scroll:false}),[router]);
 return {view,push,goBack:goOverview,goOverview};
}
