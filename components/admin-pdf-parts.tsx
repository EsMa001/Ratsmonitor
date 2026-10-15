'use client';
import {isStep,RUN_KIND_TERMS} from '@/shared/pipeline-terms.mjs';
import {useState} from 'react';
import {Icon} from '@/components/admin-icons';

/* Bausteine des Reiters „PDF-Import“ (components/admin-pdf.tsx): Zahlenformate, Monatsbalken, Platzbalken, Prozessablauf,
   Server-Liste, Protokoll der Läufe. */
export const n=(v?:number|null)=>(v??0).toLocaleString('de-DE');
export const pct=(a:number,b:number)=>b?(Math.round((a/b)*1000)/10).toLocaleString('de-DE')+' %':'–';
export const gb=(b?:number|null)=>b==null?'–':(b/1073741824).toLocaleString('de-DE',{maximumFractionDigits:1})+' GB';
/** Größe mit passender Einheit (KB, MB, GB), für kleine Dateien neben großen */
export const size=(b?:number|null)=>b==null?'–':b<1048576?`${Math.max(1,Math.round(b/1024)).toLocaleString('de-DE')} KB`:b<1073741824?`${(b/1048576).toLocaleString('de-DE',{maximumFractionDigits:1})} MB`:gb(b);
export const when=(d?:string|null)=>d?new Date(d).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}):'–';
export const clock=(d?:string|null)=>d?new Date(d).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}):'–';
export const day=(d?:string|null)=>d?d.slice(8,10)+'.'+d.slice(5,7)+'.'+d.slice(2,4):'–';
export const month=(m?:string|null)=>m&&/^\d{4}-\d{2}$/.test(m)?m.slice(5,7)+'.'+m.slice(2,4):m||'–';
export const dur=(s?:number|null)=>s==null?'–':s<90?`${s} s`:s<5400?`${Math.round(s/60)} min`:`${(s/3600).toLocaleString('de-DE',{maximumFractionDigits:1})} h`;
/** Arten der Läufe und Aufträge */
export const KIND:Record<string,string>=RUN_KIND_TERMS;

export type MonthRow={month:string;linked:number;ok:number;textOnly:number;failed:number;open:number;openBlocked?:number};
const SEG:[keyof MonthRow,string,string][]=[['ok','bg-teal-600','als PDF'],['textOnly','bg-teal-300','nur Text'],['failed','bg-slate-400','fehlgeschlagen'],['open','bg-slate-200','offen']];
/** Abdeckung je Sitzungsmonat: gestapelte Säulen, neueste links; Klick zeigt die Zahlen */
export function MonthBars({rows,label}:{rows:MonthRow[];label:string}){
 const [pick,setPick]=useState<string|null>(null);
 const list=rows.filter(r=>r.month!=='ohne Datum'),max=Math.max(1,...list.map(r=>r.linked)),sel=list.find(r=>r.month===pick);
 if(!list.length)return null;
 return <div className="mt-6">
  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-500">{SEG.map(([,c,l])=><span key={l} className="inline-flex items-center gap-1.5"><i className={'inline-block h-2.5 w-2.5 rounded-sm '+c}/>{l}</span>)}<span>Sitzungsmonat, neueste links; Säule antippen für Zahlen</span></div>
  <div role="list" aria-label={label} className="scroll-thin mt-2 flex items-end gap-1 overflow-x-auto pb-1">
   {list.map(r=><button key={r.month} role="listitem" type="button" onClick={()=>setPick(pick===r.month?null:r.month)} aria-pressed={pick===r.month}
    title={`${month(r.month)}: ${n(r.linked)} verlinkt, ${n(r.ok)} als PDF, ${n(r.textOnly)} nur Text, ${n(r.failed)} fehlgeschlagen, ${n(r.open)} offen`}
    className={'flex w-[30px] shrink-0 flex-col items-center gap-1 rounded '+(pick===r.month?'bg-slate-100':'hover:bg-slate-50')}>
    <span className="flex h-[120px] w-[16px] flex-col-reverse overflow-hidden rounded-sm bg-slate-50">
     <span className="flex w-full flex-col-reverse" style={{height:`${Math.max(2,r.linked/max*100)}%`}}>
      {SEG.map(([k,c])=>{const v=Number(r[k])||0;return v?<i key={k} className={'block w-full '+c} style={{height:`${v/r.linked*100}%`}}/>:null;})}
     </span>
    </span>
    <span className="text-[12px] tabular-nums text-slate-500">{month(r.month)}</span>
   </button>)}
  </div>
  {sel&&<p role="status" className="mt-2 text-[14px] text-slate-700"><b className="font-semibold">{month(sel.month)}</b>: {n(sel.linked)} verlinkt · {n(sel.ok)} als PDF ({pct(sel.ok,sel.linked)}) · {n(sel.textOnly)} nur Text · {n(sel.failed)} fehlgeschlagen · {n(sel.open)} offen{sel.openBlocked?`, davon ${n(sel.openBlocked)} bei ausgelassenen Servern`:''}</p>}
 </div>;
}

/** Ein Balken für die feste Grenze: Teile in Bytes, Rest frei */
export function SpaceBar({parts,limit}:{parts:[string,number,string][];limit:number}){
 const used=parts.reduce((a,p)=>a+p[1],0),free=Math.max(0,limit-used);
 return <div className="mt-4 max-w-[820px]">
  <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={parts.map(p=>`${p[0]} ${gb(p[1])}`).join(', ')+`, frei ${gb(free)}`}>
   {parts.map(([l,b,c])=>b>0?<i key={l} className={'block h-full '+c} style={{width:`${Math.min(100,b/limit*100)}%`}}/>:null)}
  </div>
  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[14px] text-slate-700">
   {parts.map(([l,b,c])=><span key={l} className="inline-flex items-center gap-1.5"><i className={'inline-block h-2.5 w-2.5 rounded-sm '+c}/>{l} <b className="font-semibold tabular-nums">{gb(b)}</b></span>)}
   <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-100"/>frei <b className="font-semibold tabular-nums">{gb(free)}</b></span>
  </div>
 </div>;
}

/* Prozessablauf: je Schritt Symbol, was passiert, Regeln, Grenzen, aktueller Wert */
type Step={icon:string;title:string;what:string;rules:string[];limits?:string[];value?:string};
export function ProcessFlow({steps,when:timing}:{steps:Step[];when:string[]}){
 return <div className="mt-4 max-w-[980px]">
  <ol className="m-0 list-none p-0">
   {steps.map((s,i)=><li key={s.title} className="relative grid grid-cols-[40px_minmax(0,1fr)] gap-x-4 pb-7 last:pb-0">
    {i<steps.length-1&&<span aria-hidden="true" className="absolute bottom-0 left-[19px] top-[44px] w-px bg-slate-200"/>}
    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-teal-600"><Icon name={s.icon}/></span>
    <div className="min-w-0 pt-1.5">
     <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h3 className="text-[18px] font-semibold"><span className="mr-2 text-slate-500 tabular-nums">{i+1}</span>{s.title}</h3>
      {s.value&&<span className="text-[14px] tabular-nums text-slate-700">{s.value}</span>}
     </div>
     <p className="mt-1 text-[14px] text-slate-700">{s.what}</p>
     <ul className="m-0 mt-2 list-none space-y-1 p-0 text-[14px] text-slate-500">
      {s.rules.map(r=><li key={r} className="flex gap-2"><Icon name="check" size={16} className="mt-[2px] text-slate-400"/><span>{r}</span></li>)}
      {s.limits?.map(r=><li key={r} className="flex gap-2 text-slate-700"><Icon name="clock" size={16} className="mt-[2px] text-teal-600"/><span>{r}</span></li>)}
     </ul>
    </div>
   </li>)}
  </ol>
  <h3 className="mt-8 text-[18px] font-semibold">Wann läuft was?</h3>
  <ul className="m-0 mt-2 list-none space-y-1.5 p-0 text-[14px] text-slate-700">
   {timing.map(t=><li key={t} className="flex gap-2"><Icon name="clock" size={16} className="mt-[2px] text-teal-600"/><span>{t}</span></li>)}
  </ul>
 </div>;
}

export type Host={host:string;n:number;bad:number;open:number;lastOk:string|null;reason:string|null;blocked:boolean;state?:string;next?:string|null};
/** Server mit Fehlern, nach offenen Dokumenten */
export function HostList({hosts,total,blocked,stages=false}:{hosts:Host[];total:number;blocked:number;stages?:boolean}){
 const [all,setAll]=useState(false),shown=all?hosts:hosts.slice(0,15);
 return <div className="mt-4 max-w-[1100px]">
  <p className="text-[14px] text-slate-500">{n(total)} Server mit Fehlern, davon {n(blocked)} gerade ausgelassen {stages?'(sie bremsen oder sind gesperrt und werden nach ihrer Wartezeit mit drei Dokumenten geprüft; freigeben auf der Seite Pipeline-Debug)':'(mindestens 10 Abrufe, davon mindestens 90 % fehlgeschlagen)'}. Sortiert nach offenen Dokumenten.</p>
  <div className="mt-3 hidden grid-cols-[minmax(0,2fr)_90px_90px_90px_minmax(0,2fr)_90px] gap-x-3 border-b border-slate-200 pb-2 text-[12px] text-slate-500 md:grid">
   <span>Server</span><span className="text-right">Abrufe</span><span className="text-right">Fehler</span><span className="text-right">offen</span><span>häufigster Grund</span><span className="text-right">zuletzt ok</span>
  </div>
  <ul className="m-0 list-none p-0">
   {shown.map(h=><li key={h.host} className="grid grid-cols-2 gap-x-3 gap-y-0.5 border-b border-slate-200 py-2.5 text-[14px] md:grid-cols-[minmax(0,2fr)_90px_90px_90px_minmax(0,2fr)_90px] md:items-baseline">
    <span className="col-span-2 min-w-0 break-all font-medium md:col-span-1">{h.host}{h.blocked&&<span className="ml-2 text-[12px] font-normal text-slate-500" title={h.next?'nächste Prüfung '+when(h.next):undefined}>{h.state==='gesperrt'?'gesperrt, ':h.state==='pruefen'?'prüfen, ':h.state==='bremsen'?'bremst, ':''}ausgelassen</span>}</span>
    <span className="tabular-nums text-slate-500 md:text-right md:text-slate-900"><span className="md:hidden">Abrufe </span>{n(h.n)}</span>
    <span className="tabular-nums text-slate-500 md:text-right md:text-slate-900"><span className="md:hidden">Fehler </span>{pct(h.bad,h.n)}</span>
    <span className="tabular-nums text-slate-500 md:text-right md:text-slate-900"><span className="md:hidden">offen </span>{n(h.open)}</span>
    <span className="min-w-0 text-slate-500">{h.reason||'–'}</span>
    <span className="tabular-nums text-slate-500 md:text-right"><span className="md:hidden">zuletzt ok </span>{day(h.lastOk)}</span>
   </li>)}
  </ul>
  {hosts.length>15&&<button type="button" className="mt-3 text-[14px] text-teal-600" onClick={()=>setAll(!all)}>{all?'Weniger zeigen':`Alle ${hosts.length} zeigen`} →</button>}
 </div>;
}

export type RunStep={name:string;seconds:number;ok:boolean;summary?:Record<string,unknown>|null};
export type Run={kind:string;startedAt:string;finishedAt:string;result:'done'|'failed'|'stopped';failed:string[];steps:RunStep[];sizeGb:number|null;quality?:{score:number|null;text:number|null;at?:string;thisRun?:boolean}|null};
const RESULT={done:'fertig',failed:'mit Fehlern',stopped:'angehalten'};
const num=(v:unknown)=>typeof v==='number'?v:0;
/** Kurzfassung eines Schritts aus seiner Zusammenfassung */
function stepText(s:RunStep){
 const x=s.summary||{};
 if(typeof x.skipped==='string')return 'übersprungen: '+x.skipped;
 if(isStep(s.name,'pdf')||isStep(s.name,'others')){const k=(x.keeper||{}) as Record<string,number>;return `${n(num(x.ok))} geladen, ${n(num(x.error))} Fehler${x.keeper?`; Grenze: ${n(k.kept)} behalten, ${n(k.swapped)} verdrängt, ${n(k.rejected)} nicht besser`:''}${x.lastMonth?`; bis ${month(String(x.lastMonth))}`:''}`;}
 if(s.name==='OCR')return `${n(num(x.files))} Dateien${x.primary!=null?` (${n(num(x.primary))} Hauptdokumente)`:''}, ${n(num(x.pages))} Seiten${num(x.fetched)?`, ${n(num(x.fetched))} kurz nachgeladen`:''}${num(x.slow)?`, ${n(num(x.slow))} über der Zeitgrenze`:''}${num(x.open)?`, ${n(num(x.open))} offen`:''}${num(x.dropped)?`, ${n(num(x.dropped))} zu große PDFs gelöscht`:''}`;
 if(isStep(s.name,'text'))return `${n(num(x.files))} Dateien${num(x.waiting)?`, ${n(num(x.waiting))} mit Seiten für OCR`:''}${num(x.dropped)?`, ${n(num(x.dropped))} zu große PDFs gelöscht`:''}`;
 if(s.name==='Zusammenfassungen')return `${n(num(x.summaries))} neue von ${n(num(x.withText))} mit Text`;
 return '';
}
/** Protokoll der Läufe, je Lauf aufklappbar mit den Schritten */
export function RunList({runs}:{runs:Run[]}){
 if(!runs.length)return <p className="mt-3 text-[14px] text-slate-500">Noch keine Läufe protokolliert (das Protokoll beginnt mit dem ersten Lauf nach dem Ausrollen).</p>;
 return <ul className="m-0 mt-3 max-w-[980px] list-none border-t border-slate-200 p-0">
  {runs.slice(0,20).map(r=>{const load=r.steps.find(s=>isStep(s.name,'pdf')),secs=(Date.parse(r.finishedAt)-Date.parse(r.startedAt))/1000;
   return <li key={r.startedAt} className="border-b border-slate-200">
    <details>
     <summary className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-2.5 text-[14px] md:grid-cols-[150px_140px_80px_minmax(0,1fr)_110px]">
      <span className="font-medium">{KIND[r.kind]||r.kind}</span>
      <span className="text-right tabular-nums text-slate-500 md:text-left">{when(r.startedAt)}</span>
      <span className="tabular-nums text-slate-500">{dur(Math.round(secs))}</span>
      <span className="min-w-0 text-slate-500">{r.quality&&(r.quality.score!=null||r.quality.text!=null)&&<span className="mr-2 whitespace-nowrap font-medium text-slate-900">{r.quality.score!=null&&`Ø Qualität ${Math.round(r.quality.score*100)} %`}{r.quality.score!=null&&r.quality.text!=null&&' · '}{r.quality.text!=null&&`Text ${Math.round(r.quality.text*100)} %`}</span>}{load?stepText(load):''}</span>
      <span className={r.result==='done'?'text-slate-700':'font-medium text-slate-900'}>{RESULT[r.result]}{r.failed.length?`: ${r.failed.join(', ')}`:''}</span>
     </summary>
     <ul className="m-0 mb-3 list-none space-y-1 p-0 pl-4 text-[14px]">
      {r.steps.map(s=><li key={s.name} className="grid grid-cols-[150px_70px_minmax(0,1fr)] gap-x-3"><span className={s.ok?'':'font-medium'}>{s.name}{s.ok?'':' (Fehler)'}</span><span className="tabular-nums text-slate-500">{dur(s.seconds)}</span><span className="text-slate-500">{stepText(s)}</span></li>)}
      {r.sizeGb!=null&&<li className="text-slate-500">Ablage danach: {r.sizeGb.toLocaleString('de-DE')} GB</li>}
      {r.quality&&<li className="text-slate-500">Ø Qualität der Ablage {r.quality.score!=null?`${Math.round(r.quality.score*100)} %`:'–'}, Hauptdokumente mit Text {r.quality.text!=null?`${(Math.round(r.quality.text*1000)/10).toLocaleString('de-DE')} %`:'–'} ({r.quality.thisRun?'gezählt am Ende dieses Laufs':`aus der Zählung vom ${when(r.quality.at)}`})</li>}
     </ul>
    </details>
   </li>;})}
 </ul>;
}

/** Qualität der Ablage (stats.mjs, storeQuality in scripts/pdf-store/store-lib.mjs) */
type QPart={files:number;bytes:number;avg:number|null};
export type Quality=QPart&{primary:QPart;others:QPart;formal:number;scans:number;types:(QPart&{type:string})[];bands:(QPart&{lo:number;hi:number|null})[];textOnly:{files:number;avg:number|null}};
const TYPE_NAME:Record<string,string>={paper:'Vorlagen',decision:'Beschlüsse',minutes:'Niederschriften',attachment:'Anlagen',other:'Sonstige',invitation:'Einladungen'};
/** Score 0–1 als Prozent */
export const scorePct=(v?:number|null)=>v==null?'–':`${Math.round(v*100)} %`;
const band=(b:{lo:number;hi:number|null})=>b.hi==null?`Qualität ab ${scorePct(b.lo)}`:b.lo===0?`Qualität unter ${scorePct(b.hi)}`:`Qualität ${Math.round(b.lo*100)} bis unter ${scorePct(b.hi)}`;
export function QualityTable({q}:{q:Quality}){
 const rows:[string,QPart][]=[...q.types.map(t=>[TYPE_NAME[t.type]??t.type,t] as [string,QPart]),...q.bands.map(b=>[band(b),b] as [string,QPart])];
 return <div className="mt-5 max-w-[820px]">
  <div className="hidden grid-cols-[minmax(0,1.4fr)_90px_90px_80px_minmax(0,1fr)] gap-x-3 border-b border-slate-200 pb-2 text-[12px] text-slate-500 md:grid"><span>Dokumentart, Qualitätsstufe</span><span className="text-right">Dateien</span><span className="text-right">Platz</span><span className="text-right">Ø Qualität</span><span>Anteil am Platz</span></div>
  <ul className="m-0 list-none p-0">{rows.map(([label,r],i)=><li key={label} className={'grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-b border-slate-200 py-2 text-[14px] md:grid-cols-[minmax(0,1.4fr)_90px_90px_80px_minmax(0,1fr)] md:items-center'+(i===q.types.length?' mt-4 border-t':'')}>
   <span className="truncate">{label}</span>
   <span className="text-right tabular-nums text-slate-500 md:text-slate-900">{n(r.files)}<span className="md:hidden"> · {gb(r.bytes)} · Ø {scorePct(r.avg)}</span></span>
   <span className="hidden text-right tabular-nums md:block">{gb(r.bytes)}</span>
   <span className="hidden text-right font-semibold tabular-nums md:block">{scorePct(r.avg)}</span>
   <span className="col-span-2 block h-[8px] overflow-hidden rounded-full bg-slate-100 md:col-span-1"><span className="block h-full rounded-full bg-teal-600" style={{width:`${q.bytes?Math.max(1,r.bytes/q.bytes*100):0}%`}}/></span>
  </li>)}</ul>
 </div>;
}
