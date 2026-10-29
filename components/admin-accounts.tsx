'use client';
import {useCallback,useEffect,useMemo,useState,type FormEvent} from 'react';
import {AdminPageHead,Befund,Zahlen,How,Fehler,Laden,Leer} from '@/components/admin-ui';
type Payment='paid'|'canceling'|'due'|'pending'|'ended';
type Sub={status:string;startedAt:string|null;periodEnd:string|null;cancelAt:string|null;canceledAt:string|null;endedAt:string|null;lastPaidAt:string|null};
type Row={id:string;email:string;status:string;createdAt:string;lastLoginAt:string|null;roles:string[];tier:string;tierSource:string|null;tierUntil:string|null;
 payment:Payment|null;subscription:Sub|null;searches:number;alerts:number;articles:number;sessions:number};
type Summary={accounts:number;rows:number;tiers:Record<string,number>;paid:number;canceling:number;due:number;pending:number;ended:number;
 blocked:number;admins:number;new7:number;new30:number;active30:number;invites:number};
type Data={at:string;summary:Summary;rows:Row[]};
type Full={id:string;email:string;name:string|null};
type Filter='alle'|'zahlend'|'offen'|'gekuendigt'|'test'|'kostenlos'|'gesperrt'|'admins';

const TIER:Record<string,string>={basic:'Kostenlos',plus:'Plus',pro:'Pro',enterprise:'Enterprise'};
const SOURCE:Record<string,string>={stripe:'Abo',beta:'Testzugang',manual:'von Hand'};
const PAYMENT:Record<Payment,{label:string;cls:string}>={
 paid:{label:'bezahlt',cls:'text-teal-700'},
 canceling:{label:'gekündigt',cls:'text-slate-600'},
 due:{label:'Zahlung offen',cls:'text-amber-800'},
 pending:{label:'erste Zahlung offen',cls:'text-amber-800'},
 ended:{label:'beendet',cls:'text-slate-500'},
};
const FILTERS:[Filter,string,(r:Row)=>boolean][]=[
 ['alle','Alle',()=>true],
 ['zahlend','Abo bezahlt',r=>r.payment==='paid'||r.payment==='canceling'],
 ['offen','Zahlung offen',r=>r.payment==='due'||r.payment==='pending'],
 ['gekuendigt','Gekündigt',r=>r.payment==='canceling'],
 ['test','Test & von Hand',r=>r.tierSource==='beta'||r.tierSource==='manual'],
 ['kostenlos','Kostenlos',r=>r.tier==='basic'],
 ['gesperrt','Gesperrt',r=>r.status==='blocked'],
 ['admins','Admins',r=>r.roles.includes('admin')],
];
/** „2026-10-26T14:07:41Z“ → „26.10.26“ */
const day=(s:string|null|undefined)=>s?s.slice(8,10)+'.'+s.slice(5,7)+'.'+s.slice(2,4):'–';
const num=(v:number)=>v.toLocaleString('de-DE');
/** Verlängerung oder Ende: gekündigt endet zum Kündigungstag, beendet am Abbruch, sonst nächste Abrechnung */
function next(r:Row){
 const s=r.subscription;
 if(!s)return r.tierSource&&r.tierUntil?'bis '+day(r.tierUntil):'–';
 if(r.payment==='canceling')return 'endet '+day(s.cancelAt);
 if(r.payment==='ended')return 'beendet '+day(s.endedAt);
 return day(s.periodEnd);
}

function Table({rows,full,pending,onReveal,highlight}:{rows:Row[];full:Record<string,Full>;pending:string;onReveal:(id:string)=>void;highlight?:string}){
 const th='pr-4 font-normal';
 return <div className="mt-4 overflow-x-auto" role="region" aria-label="Konten" tabIndex={0}>
  <table className="w-full min-w-[960px] border-collapse text-[14px]">
   <thead><tr className="border-b border-slate-200 text-left text-[12px] text-slate-500">
    <th className={'py-2 '+th}>Konto</th><th className={th}>Stufe</th><th className={th}>Zahlung</th><th className={th}>Abo seit</th>
    <th className={th}>Verlängert / endet</th><th className={th}>Letzte Zahlung</th><th className={th}>Angelegt</th><th className={th}>Zuletzt angemeldet</th>
    <th className="font-normal">Nutzung</th>
   </tr></thead>
   <tbody>{rows.map(r=>{
    const f=full[r.id],cell='py-2.5 pr-4 tabular-nums';
    return <tr key={r.id} className={'border-b border-slate-100 align-top '+(r.id===highlight?'bg-teal-50':'')}>
     <td className="py-2.5 pr-4">
      {f?<><span className="font-medium text-slate-900">{f.email}</span>{f.name&&<span className="block text-[12px] text-slate-500">{f.name}</span>}</>
       :<span className="text-slate-900">{r.email} <button type="button" disabled={pending===r.id} onClick={()=>onReveal(r.id)} className="ml-1 text-[12px] text-teal-700 hover:underline disabled:opacity-50">Adresse zeigen</button></span>}
      <span className="block text-[12px] text-slate-400">{r.id}{r.roles.includes('admin')&&' · Admin'}{r.status==='blocked'&&' · gesperrt'}</span>
     </td>
     <td className="py-2.5 pr-4">{TIER[r.tier]||r.tier}{r.tierSource&&<span className="block text-[12px] text-slate-500">{SOURCE[r.tierSource]||r.tierSource}</span>}</td>
     <td className={'py-2.5 pr-4 '+(r.payment?PAYMENT[r.payment].cls:'text-slate-400')}>{r.payment?PAYMENT[r.payment].label:'kein Abo'}</td>
     <td className={cell}>{day(r.subscription?.startedAt)}</td>
     <td className={cell}>{next(r)}</td>
     <td className={cell}>{day(r.subscription?.lastPaidAt)}</td>
     <td className={cell}>{day(r.createdAt)}</td>
     <td className={cell}>{day(r.lastLoginAt)}</td>
     <td className="py-2.5 text-slate-600">{r.searches} Suchen · {r.alerts} Glocken · {r.articles} Artikel</td>
    </tr>;})}
   </tbody>
  </table>
 </div>;
}

/** Konten: alle Konten mit Stufe, Zahlungsstand und Abo (server/accounts/admin-accounts.mjs). Adressen nur gekürzt; die volle
    Adresse je Konto auf Klick oder über die Suche nach der genauen Adresse, beides im Admin-Protokoll (konten-konzept.md 6.2). */
export function AdminAccounts(){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [filter,setFilter]=useState<Filter>('alle'),[full,setFull]=useState<Record<string,Full>>({}),[pending,setPending]=useState('');
 const [query,setQuery]=useState(''),[found,setFound]=useState<Full|null|undefined>(undefined),[searchError,setSearchError]=useState('');
 const load=useCallback(async()=>{
  setBusy(true);setError('');
  try{const r=await fetch('/api/admin/accounts',{cache:'no-store'});const d=await r.json() as Data&{error?:string};if(!r.ok)throw Error(d.error||'Die Konten konnten nicht geladen werden.');setData(d);}
  catch(e){setError(e instanceof Error?e.message:'Die Konten konnten nicht geladen werden.');}
  finally{setBusy(false);}
 },[]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- Abruf beim Öffnen; State wird erst nach dem await gesetzt
 useEffect(()=>{load();},[load]);
 const post=async(body:object)=>{
  const r=await fetch('/api/admin/accounts',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const d=await r.json() as {error?:string};
  if(!r.ok)throw Error(d.error||'Das hat nicht geklappt.');
  return d as unknown;
 };
 const reveal=async(id:string)=>{
  setPending(id);
  try{const d=await post({id}) as Full;setFull(s=>({...s,[id]:d}));}
  catch(e){setError(e instanceof Error?e.message:'Die Adresse konnte nicht geladen werden.');}
  finally{setPending('');}
 };
 const search=async(e:FormEvent)=>{
  e.preventDefault();setSearchError('');setFound(undefined);
  try{const {found:hit}=await post({email:query}) as {found:Full|null};if(hit)setFull(s=>({...s,[hit.id]:hit}));setFound(hit);}
  catch(err){setSearchError(err instanceof Error?err.message:'Die Suche hat nicht geklappt.');}
 };
 const counts=useMemo(()=>Object.fromEntries(FILTERS.map(([id,,test])=>[id,(data?.rows||[]).filter(test).length])),[data]);
 const rows=useMemo(()=>(data?.rows||[]).filter(FILTERS.find(f=>f[0]===filter)![2]),[data,filter]);
 const foundRow=found?data?.rows.find(r=>r.id===found.id):undefined;
 const sm=data?.summary;
 const paying=sm?sm.paid+sm.canceling:0,open=sm?sm.due+sm.pending:0;
 const chip=(on:boolean)=>'h-8 rounded-lg px-3 text-[14px] '+(on?'bg-teal-600 text-white':'bg-slate-100 text-slate-700 hover:bg-slate-200');
 return <>
  <AdminPageHead page="konten" figure={sm?{value:num(sm.accounts),label:'Konten',note:`${num(paying)} zahlen für Plus oder Pro`}:undefined}/>
  {error&&<Fehler onRetry={()=>void load()}>{error}</Fehler>}
  {!data&&!error&&<Laden/>}
  {sm&&<>
   <Befund stand={<>{busy?'Wird geladen …':'Stand '+new Date(data!.at).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})} · <button type="button" className="font-medium text-teal-700" onClick={()=>void load()}>Neu laden</button></>}>
    {num(sm.accounts)} Konten, davon {num(paying)} mit bezahltem Abo (Plus oder Pro){sm.canceling?` (${num(sm.canceling)} gekündigt)`:''}{open?`; bei ${num(open)} ist eine Zahlung offen`:''}.
   </Befund>
   <Zahlen items={[
    {value:num(sm.tiers.basic||0),label:'kostenlos'},{value:num(sm.tiers.plus||0),label:'Plus (auch Testzugänge)'},{value:num(sm.tiers.pro||0),label:'Pro (auch Testzugänge)'},
    ...(sm.tiers.enterprise?[{value:num(sm.tiers.enterprise),label:'Enterprise'}]:[]),
    {value:num(sm.new7),label:'neu in 7 Tagen'},{value:num(sm.new30),label:'neu in 30 Tagen'},{value:num(sm.active30),label:'in 30 Tagen angemeldet'},
    {value:num(sm.invites),label:'offene Einladungen'},{value:num(sm.blocked),label:'gesperrt'},{value:num(sm.admins),label:'mit Admin-Rolle'},
   ]}/>
   <How label="Was steht hier, was nicht?">
    <p>Die Stufe ist die wirksame Stufe wie auf der Kontoseite (höchste gültige Zeile in plan_grants). „Abo“ heißt bezahlt über Stripe, „Testzugang“ und „von Hand“ vergibt der Admin per Kommandozeile.</p>
    <p>Zahlung: bezahlt (Abo läuft), gekündigt (läuft bis zum genannten Tag), Zahlung offen (Folgezahlung fehlgeschlagen, Stripe versucht es erneut), erste Zahlung offen, beendet. „Abo seit“, Kündigung und letzte Zahlung kommen von Stripe (Meldungen und täglicher Abgleich).</p>
    <p>Adressen stehen gekürzt da (Datenminimierung, TA-25). „Adresse zeigen“ und die Suche nach der genauen Adresse zeigen sie vollständig; jeder solche Abruf steht mit Konto-ID im Admin-Protokoll. Ändern (Stufe, Sperre, Löschen) geht weiter nur per Kommandozeile.</p>
   </How>

   <form onSubmit={e=>void search(e)} role="search" aria-label="Konto nach Adresse suchen" className="mt-8 flex flex-wrap items-end gap-3 border-y border-slate-200 py-4">
    <label className="text-[12px] text-slate-500">Konto zur genauen E-Mail-Adresse
     <input type="email" required autoComplete="off" value={query} onChange={e=>setQuery(e.target.value)} className="mt-1 block h-9 w-[320px] max-w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900"/>
    </label>
    <button type="submit" className="h-9 rounded-full bg-teal-700 px-4 text-[14px] font-medium text-white hover:opacity-85">Suchen →</button>
    {found===null&&<p role="status" className="m-0 text-[14px] text-slate-600">Kein Konto mit dieser Adresse.</p>}
    {found&&!foundRow&&<p role="status" className="m-0 text-[14px] text-slate-600">Gefunden: {found.email} ({found.id}), nicht unter den gezeigten Konten.</p>}
    {searchError&&<p role="alert" className="m-0 text-[14px] text-amber-800">{searchError}</p>}
   </form>
   {foundRow&&<Table rows={[foundRow]} full={full} pending={pending} onReveal={id=>void reveal(id)} highlight={foundRow.id}/>}

   <div role="group" aria-label="Konten filtern" className="mt-8 flex flex-wrap gap-1.5">
    {FILTERS.map(([id,label])=><button key={id} type="button" aria-pressed={filter===id} className={chip(filter===id)} onClick={()=>setFilter(id)}>{label} <span className="tabular-nums opacity-80">{counts[id]}</span></button>)}
   </div>
   {sm.rows<sm.accounts&&<p className="mt-2 text-[14px] text-slate-500">Gezeigt werden die {num(sm.rows)} neuesten von {num(sm.accounts)} Konten; ältere über die Suche.</p>}
   {rows.length?<Table rows={rows} full={full} pending={pending} onReveal={id=>void reveal(id)} highlight={found?.id}/>
    :<Leer>Kein Konto in dieser Auswahl.</Leer>}
  </>}
 </>;
}
