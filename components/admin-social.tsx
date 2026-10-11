'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {AdminPageHead,Alert,Kpis} from '@/components/admin-ui';
type Draft={text:string;question:string;hashtags:string[];party:string|null};
type Fit={percent:number;parts:{key:string;label:string;points:number;max:number}[];evidence:string[]};
type Summary={count:number;avgFit:number|null;strong:number;daysWithTopic:number;days:number;minFit:number};
type Topic={fit:Fit;draft:Draft|null;id:string;title:string;date:string;status:string;region:string;regionId:string;gremium:string;group:string;term:string;score:number;why:string[];otherPlaces:number;link:string;search:string};
type Day={date:string;topics:Topic[]};
type Data={summary:Summary;computedAt:string;from:string;to:string;scanned:number;matched:number;days:Day[];error?:string};
type Sort='datum'|'eignung';
const full=(d:Draft)=>d.text+'\n'+d.question+'\n'+d.hashtags.join(' ');
/** Textvorschlag mit Kopieren-Knopf; feste Vorlagen, Zahlen und Namen stammen aus dem Eintrag. */
function DraftBox({d}:{d:Draft}){
 const [done,setDone]=useState(false);
 const copy=async()=>{try{await navigator.clipboard.writeText(full(d));setDone(true);setTimeout(()=>setDone(false),1500);}catch{/* Zwischenablage nicht erlaubt */}};
 return <div className="mt-3 rounded-lg bg-slate-50 p-3 text-[14px] leading-snug">
  <p className="font-medium">{d.text}</p>
  <p className="mt-1 text-slate-600">{d.question}</p>
  <p className="mt-1 text-[12px] text-teal-700">{d.hashtags.join(' ')}</p>
  <button type="button" onClick={copy} className="mt-2 text-[12px] text-teal-600">{done?'Kopiert ✓':'Text kopieren →'}</button>
 </div>;
}
const fitClass=(p:number)=>p>=70?'bg-teal-50 text-teal-700':p>=50?'bg-slate-100 text-slate-700':'bg-amber-50 text-amber-700';
const dmy=(d:string)=>d.slice(8,10)+'.'+d.slice(5,7)+'.'+d.slice(0,4);
const WEEKDAY=['So','Mo','Di','Mi','Do','Fr','Sa'];
const dayName=(d:string)=>WEEKDAY[new Date(d+'T12:00:00Z').getUTCDay()]+', '+dmy(d);
const STATUS:Record<string,string>={approved:'beschlossen',recommended:'empfohlen',rejected:'abgelehnt',consulting:'in Beratung',announced:'angekündigt',info:'zur Kenntnis',postponed:'vertagt'};
const store={get(k:string){try{return window.localStorage.getItem(k);}catch{return null;}},set(k:string,v:string){try{window.localStorage.setItem(k,v);}catch{/* ohne Speicher geht es auch */}}};

function TopicCard({t,showDate}:{t:Topic;showDate:boolean}){
 return <li className="rounded-xl border border-slate-200 bg-white p-4">
  <div className="flex items-baseline justify-between gap-2">
   <h3 className="text-[18px] font-semibold">{t.region}</h3>
   <span className={'shrink-0 rounded px-2 py-0.5 text-[13px] font-semibold tabular-nums '+fitClass(t.fit.percent)} title={t.fit.parts.map(p=>p.max?p.label+' '+p.points+' von '+p.max:p.label+' '+p.points).join('\n')}>{t.fit.percent} %</span>
  </div>
  <p className="mt-1 text-[12px] text-slate-500">{showDate&&dayName(t.date)+' · '}{t.group} · Eignung für Social Media</p>
  <p className="mt-2 text-[15px] leading-snug"><a className="text-teal-600" href={t.link}>{t.title}</a></p>
  {t.draft&&<DraftBox d={t.draft}/>}
  {t.fit.evidence.length>0&&<ul className="mt-2 list-disc pl-4 text-[12px] leading-snug text-slate-600">{t.fit.evidence.map(e=><li key={e}>{e}</li>)}</ul>}
  <p className="mt-2 text-[11px] leading-snug text-slate-500">{t.fit.parts.map(p=>p.max?p.label+' '+p.points+'/'+p.max:p.label+' '+p.points).join(' · ')}</p>
  <p className="mt-2 text-[13px] text-slate-500">{t.gremium&&t.gremium+' · '}{STATUS[t.status]||t.status}</p>
  <p className="mt-2 flex flex-wrap gap-1.5 text-[12px]">{t.why.map(w=><span key={w} className="rounded bg-teal-50 px-2 py-0.5 text-teal-700">{w}</span>)}</p>
  <p className="mt-3 text-[12px] text-slate-500">{t.otherPlaces?`„${t.term}“ gab es im Zeitraum auch in ${t.otherPlaces} anderen Orten · `:''}Stärke {t.score} · <a className="text-teal-600" href={t.search}>Suche öffnen →</a></p>
 </li>;
}

/** Social Media: Themenvorschläge je Tag aus den letzten 30 Tagen (server/integrations/social-topics.mjs). */
export function AdminSocial(){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [onlyFilled,setOnlyFilled]=useState(true),[sort,setSort]=useState<Sort>('datum'),[minFit,setMinFit]=useState(0),[group,setGroup]=useState('');
 // Auswahl pro Betrachter merken (nur Bequemlichkeit)
 useEffect(()=>{
  const s=store.get('social.sort'),m=Number(store.get('social.min')),g=store.get('social.group');
  if(s==='datum'||s==='eignung')setSort(s);
  if(Number.isFinite(m)&&m>=0&&m<=100)setMinFit(Math.round(m/5)*5);
  if(g)setGroup(g);
 },[]);
 const pick=<T,>(key:string,set:(v:T)=>void)=>(v:T)=>{set(v);store.set(key,String(v));};
 const load=useCallback(async(fresh=false)=>{
  setBusy(true);setError('');
  try{const r=await fetch('/api/admin/social'+(fresh?'?neu=1':''),{cache:'no-store'});const d=await r.json() as Data;if(!r.ok)throw Error(d.error||'Die Vorschläge konnten nicht geladen werden.');setData(d);}
  catch(e){setError(e instanceof Error?e.message:'Die Vorschläge konnten nicht geladen werden.');}
  finally{setBusy(false);}
 },[]);
 useEffect(()=>{load();},[load]);
 const all=useMemo(()=>(data?.days||[]).flatMap(d=>d.topics),[data]);
 const groups=useMemo(()=>{const c=new Map<string,number>();for(const t of all)c.set(t.group,(c.get(t.group)||0)+1);return [...c.entries()].sort((a,b)=>b[1]-a[1]);},[all]);
 const shown=useMemo(()=>all.filter(t=>t.fit.percent>=minFit&&(!group||t.group===group)),[all,minFit,group]);
 const byFit=useMemo(()=>[...shown].sort((a,b)=>b.fit.percent-a.fit.percent||b.date.localeCompare(a.date)||a.region.localeCompare(b.region,'de')),[shown]);
 const days=useMemo(()=>{
  const ids=new Set(shown.map(t=>t.id));
  return (data?.days||[]).map(d=>({date:d.date,topics:d.topics.filter(t=>ids.has(t.id)).sort((a,b)=>b.fit.percent-a.fit.percent)})).filter(d=>!onlyFilled||d.topics.length);
 },[data,shown,onlyFilled]);
 const avgShown=shown.length?Math.round(shown.reduce((n,t)=>n+t.fit.percent,0)/shown.length):null;
 const filtered=minFit>0||group!=='';
 const btn=(on:boolean)=>'h-8 rounded-lg px-3 text-[13px] '+(on?'bg-teal-600 text-white':'bg-slate-100 text-slate-700 hover:bg-slate-200');
 return <>
  <AdminPageHead page="social">
   <p className="text-[13px] text-slate-500">
    {busy?'Wird berechnet (kann einige Sekunden dauern) …':data?`${all.length} Vorschläge in den letzten 30 Tagen (${dmy(data.from)} bis ${dmy(data.to)}); ${data.matched.toLocaleString('de-DE')} von ${data.scanned.toLocaleString('de-DE')} Einträgen enthalten ein Streitwort.`:''}
    {' '}<button type="button" className="text-teal-600" disabled={busy} onClick={()=>load(true)}>Neu berechnen →</button>
   </p>
  </AdminPageHead>
  {error&&<Alert>{error}</Alert>}
  <div className="mt-6"><Kpis label="Kennzahlen der Vorschläge" items={[
   {label:'Ø Eignung',value:data?(data.summary.avgFit===null?'–':data.summary.avgFit+' %'):undefined,note:'Mittel über alle Vorschläge; 100 % wäre ein Thema mit allem, was gut teilbar ist'},
   {label:'Vorschläge',value:data?data.summary.count:undefined,note:'ab '+(data?.summary.minFit??40)+' % Eignung, höchstens 3 je Tag'},
   {label:'Davon stark (ab 70 %)',value:data?data.summary.strong:undefined,note:'am ehesten sofort verwendbar'},
   {label:'Tage mit Vorschlag',value:data?data.summary.daysWithTopic:undefined,of:data?.summary.days,note:'schwache Tage bleiben leer'},
  ]}/></div>
  <p className="mt-4 max-w-[760px] text-[12px] leading-[1.5] text-slate-500">
   Eignung = Themenwert (30, gelernte Streitquote und Urteil unabhängiger Bewerter) + Streit im Vorgang (15) + Alltagsnähe (15) + Reichweite des Ortes (10) + Aktualität (10) + Konkretheit (10) + Verständlichkeit (10) − Abzüge für Einzelstraßen, Ortsteil-Gremien und Planungsverfahren. Punkte über 62 werden gespreizt (Faktor 1,6), damit starke Vorschläge sichtbar vorn liegen.
   Reine Regelrechnung, keine Vorhersage von Klicks; es liegen keine Nutzungsdaten vor.
  </p>

  <section aria-label="Sortieren und filtern" className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-3 rounded-xl border border-slate-200 bg-white p-4">
   <div>
    <p className="text-[12px] text-slate-500" id="social-sort">Sortieren nach</p>
    <div role="group" aria-labelledby="social-sort" className="mt-1 flex gap-1.5">
     <button type="button" aria-pressed={sort==='datum'} className={btn(sort==='datum')} onClick={()=>pick<Sort>('social.sort',setSort)('datum')}>Datum</button>
     <button type="button" aria-pressed={sort==='eignung'} className={btn(sort==='eignung')} onClick={()=>pick<Sort>('social.sort',setSort)('eignung')}>Eignung (höchste zuerst)</button>
    </div>
   </div>
   <div className="min-w-[240px]">
    <label htmlFor="social-min" className="text-[12px] text-slate-500">Nur anzeigen ab <strong className="text-[14px] tabular-nums text-slate-900">{minFit} %</strong> Eignung</label>
    <input id="social-min" type="range" min={0} max={100} step={5} value={minFit} onChange={e=>pick<number>('social.min',setMinFit)(Number(e.target.value))} className="mt-1 block w-full accent-teal-600" aria-valuetext={minFit===0?'alle':'ab '+minFit+' Prozent'}/>
    <div className="mt-1 flex flex-wrap gap-1.5">
     {[0,60,70,80].map(m=><button key={m} type="button" aria-pressed={minFit===m} className={btn(minFit===m)} onClick={()=>pick<number>('social.min',setMinFit)(m)}>{m===0?'alle':'ab '+m+' %'}</button>)}
    </div>
   </div>
   <label className="text-[12px] text-slate-500">Thema
    <select value={group} onChange={e=>pick<string>('social.group',setGroup)(e.target.value)} className="mt-1 block h-8 rounded-lg border border-slate-200 bg-white px-2 text-[13px] text-slate-900">
     <option value="">alle Themen ({all.length})</option>
     {groups.map(([g,n])=><option key={g} value={g}>{g} ({n})</option>)}
    </select>
   </label>
   {sort==='datum'&&<label className="flex items-center gap-2 text-[13px] text-slate-600"><input type="checkbox" checked={onlyFilled} onChange={e=>setOnlyFilled(e.target.checked)}/>Tage ohne Vorschlag ausblenden</label>}
   <p role="status" className="ml-auto text-[13px] text-slate-600">
    {data?<>{shown.length} von {all.length} Vorschlägen{avgShown!==null&&<> · Ø {avgShown} %</>}{filtered&&<> · <button type="button" className="text-teal-600" onClick={()=>{pick<number>('social.min',setMinFit)(0);pick<string>('social.group',setGroup)('');}}>Filter zurücksetzen</button></>}</>:''}
   </p>
  </section>

  {data&&shown.length===0&&<p className="mt-6 text-[14px] text-slate-500">Kein Vorschlag erfüllt diese Auswahl. Eignung oder Thema lockern.</p>}
  {sort==='eignung'
   ?<ul className="mt-4 grid gap-4 lg:grid-cols-3">{byFit.map(t=><TopicCard key={t.id} t={t} showDate/>)}</ul>
   :<div className="mt-4 space-y-8">
    {days.map(d=><section key={d.date} aria-label={dayName(d.date)}>
     <h2 className="text-[16px] font-semibold">{dayName(d.date)}</h2>
     {d.topics.length===0?<p className="mt-2 text-[14px] text-slate-500">{filtered?'Kein Vorschlag in dieser Auswahl.':'Kein auffälliges Thema.'}</p>:
      <ul className="mt-3 grid gap-4 lg:grid-cols-3">{d.topics.map(t=><TopicCard key={t.id} t={t} showDate={false}/>)}</ul>}
    </section>)}
   </div>}
 </>;
}
