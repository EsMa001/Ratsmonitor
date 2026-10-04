import {useCallback} from 'react';
import {usePathname,useRouter} from 'next/navigation';
export type View='overview'|'detail'|'konto'|'info';
export const viewOf=(p:string):View=>p.startsWith('/beschluss/')||p.startsWith('/thema/')?'detail':p.startsWith('/konto')?'konto':p==='/'?'overview':'info';
export const overviewScroll:{current:{y:number;list:number;id:string}|null;listEl:HTMLElement|null}={current:null,listEl:null};
export function useAppNav(){
 const router=useRouter(),view=viewOf(usePathname());
 const push=useCallback((to:string,id='')=>{if(view==='overview')overviewScroll.current={y:window.scrollY,list:overviewScroll.listEl?.scrollTop||0,id};router.push(to,{scroll:false});},[router,view]);
 const goOverview=useCallback(()=>router.push('/',{scroll:false}),[router]);
 const openKonto=useCallback((page:'profil'|'suchen'|'hilfe')=>push('/konto/'+page),[push]);
 return {view,push,goBack:goOverview,goOverview,openKonto};
}
