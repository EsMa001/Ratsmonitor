'use client';
import Link from 'next/link';
import {useMemo,useState,type ReactNode} from 'react';
import {PageBand} from '@/components/ratsmonitor/pages/analytics/PageBand';
import {FilterSelect} from '@/components/ratsmonitor/components/FilterSelect';
import {HELP,PAGE_HEAD} from '@/components/admin-texts';
import type {AdminPage} from '@/components/admin-chrome';
export {StandLine,standText} from '@/components/admin-stand';

// Bausteine der Adminseiten im Design der Startseite und der Plenara.X-Seiten (requirements/admin-performance-konzept.md, 5.2).

/** „2026-10-08“ → „08.10.26“ */
export const dd=(d?:string|null)=>d?d.slice(8,10)+'.'+d.slice(5,7)+'.'+d.slice(2,4):'–';
/** „2026-10…“ → „10.26“ */
export const mm=(d?:string|null)=>d?d.slice(5,7)+'.'+d.slice(2,4):'–';
/** „06.10.2026“ → „06.10.26“ (reportDate des Atlas) */
export const short=(s:string)=>s.replace(/\.(\d{2})(\d{2})$/,'.$2');

/** Kopfband einer Seite: Pfadzeile, Überschrift, Einleitung; als Kind die Stand-Zeile. */
export function AdminPageHead({page,children}:{page:AdminPage;children?:ReactNode}){
 const h=PAGE_HEAD[page];
 return <PageBand>
  <p className="text-[14px] text-slate-500"><Link href="/admin" className="text-teal-600">Administration</Link> / {h.title}</p>
  <h1 className="mt-1 text-[28px] font-semibold leading-tight sm:text-[44px]">{h.title}</h1>
  <p className="mt-2 max-w-[680px] text-[16px] text-slate-500">{h.intro}</p>
  {children&&<div className="mt-4">{children}</div>}
 </PageBand>;
}
export type Kpi={label:string;value?:ReactNode;of?:ReactNode;note?:ReactNode;title?:string};
/** Kennzahlen wie Plenara.X (BeschluessePage.tsx). value undefined = lädt (drei Punkte). */
export function Kpis({label,items}:{label:string;items:Kpi[]}){
 return <dl aria-label={label} className={'grid grid-cols-2 gap-y-6 '+(items.length===5?'sm:grid-cols-5':'sm:grid-cols-4')}>
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
 return <p role="alert" className="mt-3 max-w-[820px] text-[14px] text-rose-700">{children}{onRetry&&<> <button type="button" className="link-btn" onClick={onRetry}>Erneut laden</button></>}</p>;
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
