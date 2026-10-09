'use client';
import type {ReactNode} from 'react';
import type {Stand} from '@/shared/admin-types';
// One line under the heading of every admin view: when its data was computed, how much changed since, and the action
// that brings it up to date (requirements/admin-performance-konzept.md, 3.5).
const n=(x:number)=>x.toLocaleString('de-DE');
/** „08.10.26, 14:05“ (Europe/Berlin) */
export const standText=(iso?:string|null)=>iso?new Date(iso).toLocaleString('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}):'–';
const STALE_TITLE='Seit der Berechnung wurden Berichte gespeichert oder geändert. Die Zahlen stimmen für den genannten Stand; „Neu berechnen“ holt den Rest nach.';
const since=(s:Stand)=>s.pending>0?` · Kennzahlen für ${n(s.pending)} Gebiete werden nachgerechnet`
 :s.changes===null?' · Bestand seither geändert'
 :s.changes>10000?' · viele Änderungen seither'
 :s.changes>0?` · ≈ ${n(s.changes)} geänderte Datensätze seither`:' · Bestand unverändert';
/** stand undefined = lädt. action: „Neu berechnen“ (Server rechnet), „Aktualisieren“ (liest nur), „Neu zählen“ (Stichwörter). */
export function StandLine({stand,busy,action='Neu berechnen',onAction,extra,hint}:{stand:Stand|null|undefined;busy?:boolean;action?:string;onAction?:()=>void;extra?:ReactNode;hint?:string}){
 const b=stand?.build,pct=b?Math.round(100*b.done/Math.max(1,b.total)):0;
 const text=stand===undefined?'Stand wird geladen …'
  :!stand||stand.missing?'Vorberechnung noch nicht eingerichtet (Migration 0016 fehlt)'
  :stand.unbuilt>0?`Vorberechnung läuft: ${n(stand.total-stand.unbuilt)} von ${n(stand.total)} Gebieten`
  :b?.state==='running'?`Wird neu berechnet: ${pct} % (${n(b.done)} von ${n(b.total)} Gebieten)`
  :stand.computedAt===null?'Noch kein Stand gespeichert'
  :'Stand '+standText(stand.computedAt)+since(stand)+(b?.state==='paused'?` · angehalten bei ${pct} %`:'');
 return <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-slate-500">
  <span role="status" title={stand&&stand.stale?STALE_TITLE:undefined}>{text}{extra}</span>
  {onAction&&<button type="button" className="btn-secondary btn-sm" title={hint} disabled={busy||stand===undefined} onClick={onAction}>{busy?'Wird berechnet …':action+' →'}</button>}
 </div>;
}
