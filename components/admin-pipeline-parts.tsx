'use client';
import {Fragment} from 'react';
import {FLOWS,PHASES,STEPS,isStep,CLASS_TERMS,HOST_TERMS,RESULT_TERMS,stepName,displayStep} from '@/shared/pipeline-terms.mjs';
import {n,day,when,clock,dur} from '@/components/admin-format';

/* Bausteine der Seiten „Pipeline-Debug“ und „Altbestand“ (vorübergehend): Begriffe, lesbare Zusammenfassungen der Schritte,
   Zeitachse, Fehlertabelle nach Stufen. Alle Namen aus shared/pipeline-terms.mjs. */
export {day};
export type Step={name:string;seconds:number;ok:boolean;summary?:Record<string,unknown>|null};
export type FailRow={range:string;step:string;phase:string;class:string;n:number;final:number;due:number};
type Counter=Record<string,number>;

/** Kopf jeder Seite: drei Abläufe, drei Stufen, Grenze des Tagesbereichs */
export function Glossary({boundary,since}:{boundary:string;since:string}){
 return <div className="mt-4 grid max-w-[1100px] gap-6 text-[14px] md:grid-cols-2">
  <div><h3 className="text-[16px] font-semibold">Drei Abläufe</h3><dl className="m-0 mt-1 space-y-1">
   {Object.entries(FLOWS).map(([k,f])=><div key={k}><dt className="inline font-medium">{f.name}: </dt><dd className="inline text-slate-700">{f.what}</dd></div>)}
  </dl><p className="mt-2 text-slate-500">Tagesbereich heute: Sitzungen ab {day(boundary)}{boundary!==since?` (nie vor dem ${day(since)})`:''}. Alles Ältere und alle Fehler von vor dem {day(since)} sind Altbestand.</p></div>
  <div><h3 className="text-[16px] font-semibold">Drei Stufen je Bericht</h3><ol className="m-0 mt-1 list-none space-y-1 p-0">
   {Object.entries(PHASES).map(([k,p],i)=><li key={k}><span className="font-medium">{i+1}. {p.name}: </span><span className="text-slate-700">{p.what}</span>
    <span className="block text-[12px] text-slate-500">{STEPS.filter(s=>s.phase===k).map(s=>s.name).join(' · ')}</span></li>)}
  </ol></div>
 </div>;
}

/** Ein Satz zu dem, was ein Schritt getan hat (aus seiner Zusammenfassung im Protokoll); leer, wenn es nichts zu sagen gibt */
function stepSentence(s:Step):string{
 const x=(s.summary||{}) as Record<string,unknown>,num=(k:string)=>Number(x[k]||0);
 if(x.skipped&&typeof x.skipped==='string')return 'ausgelassen: '+x.skipped;
 if(isStep(s.name,'pdf')||isStep(s.name,'others'))return `${n(num('ok'))} geladen, ${n(num('error'))} gescheitert, ${n(num('unsupported'))} kein PDF${num('skipped')?`, ${n(num('skipped'))} von wartenden Servern ausgelassen`:''}`;
 if(isStep(s.name,'text'))return num('files')+num('failed')?`${n(num('files'))} Dateien gelesen${num('waiting')?`, davon ${n(num('waiting'))} mit Scan-Seiten für die OCR`:''}${num('failed')?`, ${n(num('failed'))} nicht lesbar`:''}`:'nichts Neues zu lesen';
 if(s.name.startsWith('OCR'))return `${n(num('files'))} Dateien (${n(num('pages'))} Seiten) gelesen${num('failed')?`, ${n(num('failed'))} gescheitert`:''}${num('slow')?`, ${n(num('slow'))} zu langsam`:''}${num('open')?`, ${n(num('open'))} noch offen`:''}`;
 if(isStep(s.name,'rules')&&typeof x.read==='number')return `${n(num('read'))} Berichte gelesen, ${n(num('withText'))} davon mit Text, ${n(num('summaries'))} Regel-Zusammenfassungen${num('crashed')?`, ${n(num('crashed'))} mit Fehler im eigenen Code`:''}`;
 if(isStep(s.name,'xcases')&&typeof x.cases==='number')return `${n(num('cases'))} Vorgänge gezählt`;
 if(isStep(s.name,'trace')&&typeof x.week==='number')return `${n(num('week'))} Berichte der letzten 7 Tage gezählt`;
 return '';
}
/** Schritte eines Laufs: Name, Dauer, Satz */
export function StepList({steps}:{steps:Step[]}){
 return <ol className="m-0 mt-1 list-none space-y-1 p-0 text-[14px]">{steps.map((s,i)=>{const t=stepSentence(s);return <li key={i} className="grid grid-cols-[150px_70px_minmax(0,1fr)] gap-x-3">
  <span className={s.ok?'':'font-medium text-slate-900'}>{displayStep(s.name)}{s.ok?'':' (Fehler)'}</span><span className="tabular-nums text-slate-500">{dur(s.seconds)}</span><span className="min-w-0 text-slate-700">{t}</span>
 </li>;})}</ol>;
}
export const result=(r?:string|null)=>r?RESULT_TERMS[r as keyof typeof RESULT_TERMS]||r:'–';

type Job={id:string;label:string;flow?:string};
type LogRun={job:string;start:string;end:string;seconds:number;result:string;trigger:string};
const BAR:Record<string,string>={ok:'bg-teal-600',failed:'bg-slate-900',stopped:'bg-slate-400'};
/** Zeitachse der letzten 24 Stunden, Zeilen nach Ablauf gruppiert, volle Stunden als Marken */
export function Timeline({at,jobs,log}:{at:string;jobs:Job[];log:LogRun[]}){
 const end=Date.parse(at),start=end-24*3600000,x=(t:number)=>Math.max(0,Math.min(100,(t-start)/(end-start)*100));
 const firstHour=Math.ceil(start/3600000)*3600000,ticks=Array.from({length:24},(_,i)=>firstHour+i*3600000).filter(t=>t<end&&new Date(t).getHours()%3===0);
 const groups=Object.entries(FLOWS).map(([k,f])=>({k,name:f.name,rows:jobs.filter(j=>(j.flow||'altbestand')===k)}));
 return <div className="mt-4 max-w-[1100px] overflow-x-auto"><div className="min-w-[680px]">
  <div className="relative ml-[190px] h-5 text-[12px] text-slate-500">{ticks.map(h=><span key={h} className="absolute -translate-x-1/2 tabular-nums" style={{left:`${x(h)}%`}}>{String(new Date(h).getHours()).padStart(2,'0')}:00</span>)}</div>
  {groups.map(g=><Fragment key={g.k}><p className="mt-3 text-[12px] font-medium uppercase tracking-wide text-slate-500">{g.name}</p>
   <ul className="m-0 mt-1 list-none space-y-1.5 p-0">{g.rows.map(j=>{const runs=log.filter(r=>r.job===j.id&&Date.parse(r.end)>=start);return <li key={j.id} className="grid grid-cols-[190px_minmax(0,1fr)] items-center text-[14px]">
    <span className="truncate pr-3">{j.label}</span>
    <span className="relative h-5 rounded bg-slate-50">
     {ticks.map(h=><i key={h} className="absolute top-0 h-full w-px bg-slate-200" style={{left:`${x(h)}%`}}/>)}
     {runs.map(r=>{const a=x(Date.parse(r.start)),b=x(Date.parse(r.end));return <i key={r.start} title={`${when(r.start)} bis ${clock(r.end)}, ${dur(r.seconds)}: ${result(r.result)}${r.trigger==='jetzt'?' (von Hand angestoßen)':''}`}
      className={'absolute top-0.5 h-4 rounded '+(BAR[r.result]||'bg-slate-400')} style={{left:`${a}%`,width:`${Math.max(0.35,b-a)}%`}}/>;})}
    </span></li>;})}</ul></Fragment>)}
  <p className="mt-2 text-[12px] text-slate-500">Balken: ein Lauf, von Start bis Ende; Petrol fertig, schwarz mit Fehler, grau angehalten. Fährt man darüber, stehen Zeiten und Ergebnis da. Läufe, in denen nichts zu tun war, fehlen. Uhrzeit Ihres Geräts.</p>
 </div></div>;
}

/** Fehlertabelle eines Bereichs, nach Stufen gegliedert. onRetry(phase, cls?) für die Knöpfe; ohne onRetry keine Knöpfe */
export function FailureTable({rows,range,onRetry,busy}:{rows:FailRow[];range:'daily'|'backlog';onRetry?:(phase:string,cls?:string)=>void;busy?:boolean}){
 const mine=rows.filter(r=>r.range===range);
 if(!mine.length)return <p className="mt-2 text-[14px] text-slate-500">Keine Einträge.</p>;
 const btn='text-[14px] font-medium text-teal-700 hover:text-teal-600 disabled:opacity-40';
 return <table className="mt-3 w-full max-w-[1100px] border-collapse text-[14px]">
  <thead><tr className="border-b border-slate-200 text-left text-slate-500"><th className="py-1 pr-3 font-normal">Schritt</th><th className="pr-3 font-normal">Grund</th><th className="pr-3 font-normal">was dann geschieht</th><th className="pr-3 text-right font-normal">jetzt fällig</th><th className="pr-3 text-right font-normal">wartet</th><th className="pr-3 text-right font-normal">kein Versuch mehr</th><th/></tr></thead>
  <tbody>{Object.entries(PHASES).map(([k,p])=>{const list=mine.filter(r=>r.phase===k);if(!list.length)return null;const total=list.reduce((a,r)=>a+r.n,0);
   return <Fragment key={k}><tr><td colSpan={7} className="pt-3 pb-1"><span className="font-semibold">{p.name}</span> <span className="text-slate-500">· {n(total)} {total===1?'Eintrag':'Einträge'}</span>
    {onRetry&&<button type="button" className={btn+' ml-3'} disabled={busy} onClick={()=>onRetry(k)}>Stufe jetzt erneut versuchen →</button>}</td></tr>
    {list.map(r=>{const c=CLASS_TERMS[r.class as keyof typeof CLASS_TERMS];return <tr key={r.step+r.class} className="border-b border-slate-100 align-top">
     <td className="py-1 pr-3">{stepName(r.step)}</td><td className="pr-3">{c?.name||r.class}</td><td className="pr-3 text-slate-500">{c?.then||''}</td>
     <td className="pr-3 text-right tabular-nums">{n(r.due)}</td><td className="pr-3 text-right tabular-nums">{n(r.n-r.due-r.final)}</td><td className="pr-3 text-right tabular-nums">{n(r.final)}</td>
     <td className="text-right">{onRetry&&r.n-r.due>0&&<button type="button" className={btn} disabled={busy} onClick={()=>onRetry(k,r.class)}>erneut →</button>}</td>
    </tr>;})}</Fragment>;})}</tbody>
 </table>;
}

type Host={host:string;state:string;level:number;next_try_at:string|null;reason:string|null;entries:number};
/** Server, die warten, mit Knopf „freigeben“ */
export function HostTable({hosts,onRelease,busy}:{hosts:Host[];onRelease:(h:string)=>void;busy?:boolean}){
 return <table className="mt-2 w-full max-w-[1100px] border-collapse text-[14px]"><thead><tr className="border-b border-slate-200 text-left text-slate-500"><th className="py-1 pr-3 font-normal">Server</th><th className="pr-3 font-normal">Stufe</th><th className="pr-3 font-normal">nächste Stichprobe</th><th className="pr-3 text-right font-normal">Einträge</th><th className="pr-3 font-normal">zuletzt</th><th/></tr></thead>
  <tbody>{hosts.map(h=><tr key={h.host} className="border-b border-slate-100 align-top">
   <td className="max-w-[260px] break-all py-1 pr-3">{h.host}</td><td className="pr-3">{HOST_TERMS[h.state as keyof typeof HOST_TERMS]||h.state}{h.level>1&&<span className="text-slate-500"> ({h.level}. Mal)</span>}</td>
   <td className="pr-3 tabular-nums">{h.next_try_at?when(h.next_try_at):'nur von Hand'}</td><td className="pr-3 text-right tabular-nums">{n(h.entries)}</td><td className="max-w-[300px] break-words pr-3 text-slate-500">{h.reason}</td>
   <td className="text-right"><button type="button" className="text-[14px] font-medium text-teal-700 hover:text-teal-600 disabled:opacity-40" disabled={busy} onClick={()=>onRelease(h.host)}>freigeben →</button></td>
  </tr>)}</tbody></table>;
}
export type {Counter};
