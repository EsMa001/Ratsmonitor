'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState,type ReactNode} from 'react';
import {IconChevronDown} from '@/components/ratsmonitor/components/icons';
import {PageBand} from '@/components/ratsmonitor/pages/analytics/PageBand';
import {FilterSelect} from '@/components/ratsmonitor/components/FilterSelect';
import {HELP,PAGE_HEAD} from '@/components/admin-texts';
import {ADMIN_PAGES,adminHref,groupOf,type AdminPage} from '@/components/admin-chrome';
export {StandLine,standText} from '@/components/admin-stand';

// Bausteine der Adminseiten im Design der Startseite und der Plenara.X-Seiten (requirements/admin-performance-konzept.md, 5.2).

/** „06.10.2026“ → „06.10.26“ (reportDate des Atlas) */
export const short=(s:string)=>s.replace(/\.(\d{2})(\d{2})$/,'.$2');

/** Kopfband einer Seite wie auf den plenara.X-Seiten (XKopf): Pfadzeile, Titel links, in der Mitte die Kennzahl der Seite
    groß (figure) oder sonst ihre Leitfrage. Die Einleitung steht unten in „Über diese Seite“ (AdminFrame). Als Kind die Stand-Zeile. */
export function AdminPageHead({page,figure,children}:{page:AdminPage;figure?:{value:ReactNode;label:string;note?:ReactNode};children?:ReactNode}){
 const h=PAGE_HEAD[page],group=groupOf(page)?.label,hint=ADMIN_PAGES.find(p=>p.id===page)?.hint;
 // Am Desktop ist das Band wie auf plenara.X eine dünne feste Zeile (analytics.css: Pfad, Titel, Zahl nebeneinander); dafür
 // löst sich das Raster dort auf (sm:contents) und die Mitte trägt rm-band-mid. Ohne compact (pl-top gehört dem Atlas).
 return <PageBand>
  <p className="text-[14px] text-slate-500"><Link href="/admin" className="text-teal-600">Administration</Link>{group?` / ${group}`:''}</p>
  <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 max-md:grid-cols-1 sm:contents">
   <h1 className="text-[28px] font-semibold leading-tight">{h.title}</h1>
   {figure?<div className="rm-band-mid text-left">
    <p className="m-0 flex items-baseline gap-2 leading-none"><span className="whitespace-nowrap text-[44px] font-semibold tabular-nums max-sm:text-[28px]">{figure.value}</span><span className="text-[16px]">{figure.label}</span></p>
    {figure.note&&<p className="m-0 mt-1.5 text-[14px] opacity-80">{figure.note}</p>}
   </div>:<p className="rm-band-mid m-0 text-[22px] opacity-90 max-md:text-[18px]">{hint}</p>}
  </div>
  {children&&<div className="mt-3 text-[14px] sm:order-4 sm:mt-0 sm:ml-auto">{children}</div>}
 </PageBand>;
}
/** Der Befund der Seite in einem Satz, vor den Zahlen (wie Befund.tsx auf plenara.X); darunter der Stand */
export function Befund({children,stand}:{children:ReactNode;stand?:ReactNode}){
 return <div className="mt-2">
  <p className="m-0 max-w-[900px] text-[18px] font-semibold leading-snug text-slate-900 max-sm:text-[16px]">{children}</p>
  {stand&&<div className="mt-1.5 flex flex-wrap items-center gap-x-1 text-[14px] text-slate-500">{stand}</div>}
 </div>;
}
/** Weitere Zahlen der Seite ruhig in einer Zeile (wie Kennzahlen rest); mit href als Link zu ihrer Seite */
export function Zahlen({items}:{items:{value:ReactNode;label:string;href?:string}[]}){
 return <p className="m-0 mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[16px] text-slate-500">{items.map(k=>{
  const inner=<><b className="font-semibold tabular-nums text-slate-900">{k.value}</b> {k.label}</>;
  return <span key={k.label}>{k.href?<Link href={k.href} className="hover:text-teal-700">{inner}</Link>:inner}</span>;})}</p>;
}
/** Offen/zu eines aufklappbaren Abschnitts je Betrachter merken (nur Bequemlichkeit; ohne Speicher gilt der Vorgabewert) */
function useOpen(key:string|undefined,initial:boolean,force=false):[boolean,(v:boolean)=>void]{
 const [open,setOpen]=useState(initial);
 // Gemerktes erst nach dem ersten Zeichnen lesen: Server und Browser zeichnen zuerst gleich (sonst Hydration-Fehler)
 useEffect(()=>{if(force||!key)return;let v:string|null=null;try{v=localStorage.getItem('admin-open:'+key);}catch{/* ohne Speicher */}
  // eslint-disable-next-line react-hooks/set-state-in-effect -- einmal nach dem Einhängen aus dem Speicher des Browsers
  if(v!==null)setOpen(v==='1');},[key,force]);
 return [open,(v:boolean)=>{setOpen(v);if(key)try{localStorage.setItem('admin-open:'+key,v?'1':'0');}catch{/* ohne Speicher */}}];
}
/** Abschnitt einer Seite: Überschrift 22 px, Unterzeile, rechts optional Bedienung (Umschalter, Link). Mit open (true/false)
    klappt er auf und zu: Was man nicht auf den ersten Blick braucht, steht zu (Konzept B2); gemerkt wird je id. */
export function Abschnitt({id,title,sub,aside,open,force,children}:{id?:string;title:ReactNode;sub?:ReactNode;aside?:ReactNode;open?:boolean;/** offen, egal was gemerkt ist (Sprung hierher) */force?:boolean;children?:ReactNode}){
 const [isOpen,setOpen]=useOpen(open===undefined?undefined:id,force||(open??true),force);
 const head=<div className="min-w-0"><h2 className="m-0 flex items-center gap-2 text-[22px] font-semibold">{open!==undefined&&<IconChevronDown size={18} className={'shrink-0 text-teal-700 transition-transform '+(isOpen?'':'-rotate-90')}/>}{title}</h2>
  {sub&&<p className="m-0 mt-1 max-w-[820px] text-[14px] font-normal text-slate-500">{sub}</p>}</div>;
 return <section id={id} aria-label={typeof title==='string'?title:undefined} className="mt-12 scroll-mt-24 first:mt-8">
  <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
   {open===undefined?head:<button type="button" aria-expanded={isOpen} onClick={()=>setOpen(!isOpen)} className="min-w-0 cursor-pointer text-left">{head}</button>}
   {isOpen&&aside}</div>
  {isOpen&&children}
 </section>;
}
/** Zeile, die Einzelheiten aufklappt (Schritte eines Laufs, Listen): Titel und Kurzangabe immer, der Rest auf Klick */
export function Aufklapp({title,note,aside,children}:{title:ReactNode;note?:ReactNode;aside?:ReactNode;children?:ReactNode}){
 const [open,setOpen]=useState(false);
 return <div className="border-b border-slate-200">
  <div className="flex flex-wrap items-baseline justify-between gap-x-4 py-2.5">
   <button type="button" aria-expanded={children?open:undefined} disabled={!children} onClick={()=>setOpen(!open)} className="flex min-w-0 items-baseline gap-2 text-left text-slate-900 disabled:cursor-default disabled:opacity-100">
    {children?<IconChevronDown size={14} className={'shrink-0 self-center text-teal-700 transition-transform '+(open?'':'-rotate-90')}/>:<span className="w-[14px] shrink-0"/>}
    <span className="text-[16px] font-semibold">{title}</span>{note&&<span className="text-[14px] text-slate-500">{note}</span>}</button>
   {aside}</div>
  {open&&children&&<div className="pb-3 pl-[22px]">{children}</div>}
 </div>;
}
/** Hinweis, der Handeln braucht (amber), wie Fehler.tsx auf plenara.X mit Linie links */
export function Hinweis({children}:{children:ReactNode}){
 return <div role="alert" className="mt-4 max-w-[900px] border-l-2 border-amber-500 py-1 pl-4 text-[14px] text-slate-700">{children}</div>;
}
/** Fehler beim Laden: gleiche Form wie auf plenara.X, mit „Noch einmal“ */
export function Fehler({children,onRetry}:{children:ReactNode;onRetry?:()=>void}){
 return <div role="alert" className="mt-4 max-w-[760px] border-l-2 border-amber-500 py-1 pl-4">
  <p className="m-0 text-[16px] font-medium text-slate-900">{children}</p>
  {onRetry&&<button type="button" onClick={onRetry} className="mt-2 inline-flex h-8 items-center rounded-full border border-teal-700 px-3 text-[14px] font-medium text-teal-700 hover:bg-teal-50">Noch einmal</button>}
 </div>;
}
/** Nichts da: ein Satz, was fehlt, darunter optional, was man tun kann */
export function Leer({children,tipp}:{children:ReactNode;tipp?:ReactNode}){
 return <div role="status" className="mt-4 max-w-[760px] border-l-2 border-slate-300 py-1 pl-4"><p className="m-0 text-[16px] text-slate-700">{children}</p>{tipp&&<p className="m-0 mt-1 text-[14px] text-slate-500">{tipp}</p>}</div>;
}
/** Solange die Seite lädt: ihre Form (Satz, Zahlen, Fläche) statt drei Punkten */
export function Laden(){
 return <div className="mt-2 animate-pulse" role="status" aria-label="wird geladen">
  <div className="h-6 w-[min(640px,90%)] rounded-full bg-slate-100"/><div className="mt-3 h-4 w-[min(300px,60%)] rounded-full bg-slate-100"/>
  <div className="mt-10 h-48 rounded-[20px] bg-slate-100"/>
 </div>;
}
/** Lese-Seiten lösen nichts aus: Starten, Anhalten und Zeitpläne liegen auf der Steuerung (Konzept B1a) */
export function SteuernLink({job,label='Steuern'}:{job:string;label?:string}){
 return <Link href={adminHref('zeitplaene','job='+job)+'#job-'+job} className="whitespace-nowrap text-[14px] text-teal-700">{label} →</Link>;
}

export type Kpi={label:string;value?:ReactNode;of?:ReactNode;note?:ReactNode;title?:string};
/** Kennzahlen wie Plenara.X (BeschluessePage.tsx). value undefined = lädt (drei Punkte). */
export function Kpis({label,items}:{label:string;items:Kpi[]}){
 const colsOf:Record<number,string>={5:'sm:grid-cols-5',6:'sm:grid-cols-3 lg:grid-cols-6'};
 return <dl aria-label={label} className={'grid grid-cols-2 gap-y-6 '+(colsOf[items.length]||'sm:grid-cols-4')}>
  {items.map((k,i)=><div key={k.label} title={k.title} className={'min-w-0 px-4 '+(i%2?'border-l border-slate-200 ':'max-sm:pl-0 ')+(i?'sm:border-l sm:border-slate-200':'sm:pl-0')}>
   <dt className="text-[12px] text-slate-500">{k.label}</dt>
   <dd className="mt-1 text-[22px] font-semibold tabular-nums">{k.value===undefined?<span className="rm-dots" aria-label="wird geladen"><i/><i/><i/></span>:k.value}
    {k.of!==undefined&&k.value!==undefined&&<span className="text-[14px] font-normal text-slate-500"> / {k.of}</span>}</dd>
   {k.note&&<dd className="mt-1 text-[12px] leading-[1.45] text-slate-500">{k.note}</dd>}
  </div>)}
 </dl>;
}
export function How({label='Wie wird gezählt?',children}:{label?:string;children:ReactNode}){
 return <details className="mt-2 max-w-[820px] text-[14px] text-slate-500"><summary className="w-fit cursor-pointer text-teal-600">{label}</summary><div className="mt-2 space-y-2">{children}</div></details>;
}
/** Unterzeile und aufklappbare Erklärung eines Abschnitts; direkt unter dem Überschriften-Block. */
export function SectionHelp({id}:{id:string}){
 const h=HELP[id];if(!h)return null;
 return <>{h.sub&&<p className="mt-1 max-w-[820px] text-[14px] text-slate-500">{h.sub}</p>}
  {h.how?.length?<How label={h.howLabel}>{h.how.map(t=><p key={t}>{t}</p>)}</How>:null}</>;
}
/** „Was tun?“-Links eines Abschnitts; am Ende des Abschnitts. */
export function SectionTodo({id}:{id:string}){
 const t=HELP[id]?.todo;if(!t?.length)return null;
 return <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[14px]">{t.map(x=><Link key={x.href} href={x.href} className="text-teal-600">{x.label} →</Link>)}</p>;
}
export const Skeleton=({h=240}:{h?:number})=><div aria-hidden="true" className="w-full animate-pulse rounded-lg bg-slate-100" style={{height:h}}/>;
/** Solange Daten fehlen: Abschnitte mit Überschrift und Erklärung, darunter graue Flächen. [HELP-ID, Höhe in px] */
export function PageSkeleton({sections}:{sections:[string,number][]}){
 return <>{sections.map(([id,h])=><section key={id} className="admin-section"><div className="admin-section-heading"><h2>{HELP[id]?.title}</h2></div><SectionHelp id={id}/><div className="mt-5"><Skeleton h={h}/></div></section>)}</>;
}
export function Legend({items}:{items:[string,string][]}){
 return <ul className="m-0 mt-3 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-[12px] text-slate-500">{items.map(([c,l])=><li key={l} className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm" style={{background:c}}/>{l}</li>)}</ul>;
}
export function Alert({children,onRetry}:{children:ReactNode;onRetry?:()=>void}){
 return <p role="alert" className="mt-3 max-w-[820px] text-[14px] text-amber-700">{children}{onRetry&&<> <button type="button" className="link-btn" onClick={onRetry}>Erneut laden</button></>}</p>;
}
/** Ersetzt die lokalen Choice-Helfer (shadcn Select). Kurze Listen bis ca. 30 Einträge. */
export function AdminChoice({id,label,value,onChange,items,help}:{id:string;label:string;value:string;onChange:(v:string)=>void;items:[string,string][];help?:string}){
 return <div className="min-w-0"><label htmlFor={id} className="field-label mb-1 block">{label}</label>
  <FilterSelect id={id} label={label} allLabel="" value={value} options={items.map(([v,l])=>({value:v,label:l}))} onChange={onChange} size="sm" highlight={false} className="w-full"/>
  {help&&<p className="field-help mt-1">{help}</p>}</div>;
}
/** Gebietswahl für lange Listen (3.500–5.300 Gebiete): Suchfeld, höchstens 20 Treffer. */
export function AdminAreaPick({id,label,value,onChange,options,allLabel,disabled}:{id:string;label:string;value:string;onChange:(v:string)=>void;options:{id:string;name:string}[];allLabel:string;disabled?:boolean}){
 const [q,setQ]=useState('');
 const current=value==='all'?allLabel:options.find(o=>o.id===value)?.name||value;
 const hits=useMemo(()=>{const s=q.trim().toLocaleLowerCase('de-DE');return s?options.filter(o=>o.name.toLocaleLowerCase('de-DE').includes(s)).slice(0,20):[];},[q,options]);
 const pick=(v:string)=>{onChange(v);setQ('');};
 return <div className="relative min-w-0"><label htmlFor={id} className="field-label mb-1 block">{label}</label>
  <input id={id} type="search" autoComplete="off" className="field-input" value={q} disabled={disabled} placeholder={current}
   onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&hits[0]){e.preventDefault();pick(hits[0].id);}if(e.key==='Escape')setQ('');}}/>
  {q&&<ul className="popover absolute left-0 right-0 z-20 m-0 mt-1 max-h-[320px] list-none overflow-auto p-1.5">
   {[{id:'all',name:allLabel},...hits].map(o=><li key={o.id}><button type="button" className="w-full rounded-lg px-3 py-2 text-left text-[14px] hover:bg-slate-100" onClick={()=>pick(o.id)}>{o.name}</button></li>)}
   {!hits.length&&<li className="px-3 py-2 text-[14px] text-slate-500">Kein Gebiet gefunden.</li>}</ul>}
  <p className="field-help mt-1">Gewählt: {current}</p></div>;
}
