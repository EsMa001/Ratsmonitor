'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {AdminPageHead,Befund,Zahlen,How,Fehler,Laden} from '@/components/admin-ui';
type Draft={text:string;question:string;hashtags:string[];party:string|null};
type Fit={percent:number;parts:{key:string;label:string;points:number;max:number}[];evidence:string[]};
type Summary={count:number;avgFit:number|null;strong:number;daysWithTopic:number;days:number;minFit:number};
type Topic={fit:Fit;draft:Draft|null;id:string;title:string;date:string;status:string;region:string;regionId:string;gremium:string;group:string;term:string;score:number;why:string[];otherPlaces:number;link:string;search:string};
type Day={date:string;topics:Topic[]};
type Data={summary:Summary;computedAt:string;from:string;to:string;scanned:number;matched:number;days:Day[];error?:string};
type Video={state:'ready'|'failed'|'blocked';seconds:number|null;note:string|null;madeAt:string;releasedAt:string|null;key:string};
type Videos=Record<string,Video>;
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

/** Video zum Vorschlag (Job „social-videos“): ansehen und freigeben; mehr entscheidet die Administration nicht. */
function VideoBox({id,v,onChange}:{id:string;v?:Video;onChange:()=>void}){
 const [busy,setBusy]=useState(false);const [err,setErr]=useState('');
 const release=async(on:boolean)=>{
  setBusy(true);setErr('');
  try{const r=await fetch('/api/admin/social/videos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,on,key:v?.key})});const d=await r.json() as {error?:string};if(!r.ok)throw Error(d.error||'Nicht möglich.');onChange();}
  catch(e){setErr(e instanceof Error?e.message:'Nicht möglich.');}
  finally{setBusy(false);}
 };
 if(!v)return <p className="mt-3 text-[12px] text-slate-500">Video: noch nicht gebaut (der Job läuft täglich um 10:30 Uhr).</p>;
 if(v.state==='blocked')return <p className="mt-3 text-[12px] leading-snug text-amber-700">Kein Video, weil das Datenblatt unvollständig ist: {v.note}</p>;
 if(v.state==='failed')return <p className="mt-3 text-[12px] leading-snug text-amber-700">Video konnte nicht gebaut werden, nächster Versuch beim nächsten Lauf. {v.note}</p>;
 return <div className="mt-3">
  <video controls preload="none" playsInline className="w-full max-w-[240px] rounded-lg bg-slate-100" src={'/api/admin/social/videos?id='+encodeURIComponent(id)+'&v='+v.key} aria-label="Video zum Vorschlag"/>
  <p className="mt-1 text-[12px] text-slate-500">{v.seconds?Math.round(v.seconds)+' s · ':''}gebaut am {dmy(v.madeAt.slice(0,10))}{v.releasedAt&&<> · <span className="font-semibold text-teal-700">freigegeben am {dmy(v.releasedAt.slice(0,10))}</span></>}</p>
  <button type="button" disabled={busy} onClick={()=>void release(!v.releasedAt)} className={'mt-1 h-8 rounded-lg px-3 text-[14px] '+(v.releasedAt?'bg-slate-100 text-slate-700 hover:bg-slate-200':'bg-teal-600 text-white')}>{v.releasedAt?'Freigabe zurücknehmen':'Freigeben'}</button>
  {err&&<p role="alert" className="mt-1 text-[12px] text-amber-700">{err}</p>}
 </div>;
}

function TopicCard({t,showDate,v,onVideo}:{t:Topic;showDate:boolean;v?:Video;onVideo:()=>void}){
 return <li className="rounded-xl border border-slate-200 bg-white p-4">
  <div className="flex items-baseline justify-between gap-2">
   <h3 className="text-[18px] font-semibold">{t.region}</h3>
   <span className={'shrink-0 rounded px-2 py-0.5 text-[14px] font-semibold tabular-nums '+fitClass(t.fit.percent)} title={t.fit.parts.map(p=>p.max?p.label+' '+p.points+' von '+p.max:p.label+' '+p.points).join('\n')}>{t.fit.percent} %</span>
  </div>
  <p className="mt-1 text-[12px] text-slate-500">{showDate&&dayName(t.date)+' · '}{t.group} · Eignung für Social Media</p>
  <p className="mt-2 text-[16px] leading-snug"><a className="text-teal-600" href={t.link}>{t.title}</a></p>
  {t.draft&&<DraftBox d={t.draft}/>}
  <VideoBox id={t.id} v={v} onChange={onVideo}/>
  {t.fit.evidence.length>0&&<ul className="mt-2 list-disc pl-4 text-[12px] leading-snug text-slate-600">{t.fit.evidence.map(e=><li key={e}>{e}</li>)}</ul>}
  <p className="mt-2 text-[12px] leading-snug text-slate-500">{t.fit.parts.map(p=>p.max?p.label+' '+p.points+'/'+p.max:p.label+' '+p.points).join(' · ')}</p>
  <p className="mt-2 text-[14px] text-slate-500">{t.gremium&&t.gremium+' · '}{STATUS[t.status]||t.status}</p>
  <p className="mt-2 flex flex-wrap gap-1.5 text-[12px]">{t.why.map(w=><span key={w} className="rounded bg-teal-50 px-2 py-0.5 text-teal-700">{w}</span>)}</p>
  <p className="mt-3 text-[12px] text-slate-500">{t.otherPlaces?`„${t.term}“ gab es im Zeitraum auch in ${t.otherPlaces} anderen Orten · `:''}Stärke {t.score} · <a className="text-teal-600" href={t.search}>Suche öffnen →</a></p>
 </li>;
}

/** Social Media: Themenvorschläge je Tag aus den letzten 30 Tagen (server/integrations/social-model.mjs, Hilfen aus social-topics.mjs).
    Aufbau wie alle Adminseiten (requirements/admin-konzept.md): Kennzahl im Band, Befund, Zahlen, Berechnung zum Aufklappen. */
export function AdminSocial(){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [onlyFilled,setOnlyFilled]=useState(true),[sort,setSort]=useState<Sort>('datum'),[minFit,setMinFit]=useState(0),[group,setGroup]=useState('');
 // Auswahl pro Betrachter merken (nur Bequemlichkeit)
 useEffect(()=>{
  const s=store.get('social.sort'),m=Number(store.get('social.min')),g=store.get('social.group');
  // eslint-disable-next-line react-hooks/set-state-in-effect -- gemerkte Auswahl erst nach dem Hydrieren aus dem Browser lesen (Server kennt sie nicht)
  if(s==='datum'||s==='eignung')setSort(s);
  if(Number.isFinite(m)&&m>=0&&m<=100)setMinFit(Math.round(m/5)*5);
  if(g)setGroup(g);
 },[]);
 const pick=<T,>(key:string,set:(v:T)=>void)=>(v:T)=>{set(v);store.set(key,String(v));};
 const [videos,setVideos]=useState<Videos>({});
 const loadVideos=useCallback(async()=>{
  try{const r=await fetch('/api/admin/social/videos',{cache:'no-store'});if(r.ok)setVideos(((await r.json()) as {videos?:Videos}).videos||{});}
  catch{/* ohne Videostand zeigt der Reiter die Vorschläge trotzdem */}
 },[]);
 const load=useCallback(async(fresh=false)=>{
  setBusy(true);setError('');
  try{const r=await fetch('/api/admin/social'+(fresh?'?neu=1':''),{cache:'no-store'});const d=await r.json() as Data;if(!r.ok)throw Error(d.error||'Die Vorschläge konnten nicht geladen werden.');setData(d);}
  catch(e){setError(e instanceof Error?e.message:'Die Vorschläge konnten nicht geladen werden.');}
  finally{setBusy(false);}
 },[]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- Abruf beim Öffnen; State wird erst nach dem await gesetzt
 useEffect(()=>{load();void loadVideos();},[load,loadVideos]);
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
 const btn=(on:boolean)=>'h-8 rounded-lg px-3 text-[14px] '+(on?'bg-teal-600 text-white':'bg-slate-100 text-slate-700 hover:bg-slate-200');
 const sm=data?.summary;
 return <>
  <AdminPageHead page="social" figure={sm?{value:String(sm.count),label:'Vorschläge',note:`davon ${sm.strong} stark`}:undefined}/>
  {error&&<Fehler onRetry={()=>void load()}>{error}</Fehler>}
  {!data&&!error&&<Laden/>}
  {sm&&<>
   <Befund stand={<>{busy?'Wird berechnet (kann einige Sekunden dauern) …':`${dmy(data!.from)} bis ${dmy(data!.to)} · ${data!.matched.toLocaleString('de-DE')} von ${data!.scanned.toLocaleString('de-DE')} Sachpunkten mit Unterthema des Modells`} · <button type="button" className="font-medium text-teal-700 disabled:opacity-40" disabled={busy} onClick={()=>load(true)}>neu berechnen</button></>}>
    {sm.strong?`${sm.strong} starke Vorschläge (ab 70 % Eignung) in den letzten 30 Tagen, an ${sm.daysWithTopic} von ${sm.days} Tagen mindestens einer.`:`Kein starker Vorschlag in den letzten 30 Tagen; ${sm.count} Vorschläge ab ${sm.minFit??40} % Eignung.`}</Befund>
   <Zahlen items={[{value:sm.avgFit===null?'–':sm.avgFit+' %',label:'Ø Eignung'},{value:`${sm.daysWithTopic} von ${sm.days}`,label:'Tagen mit Vorschlag'}]}/>
   <How label="Wie wird die Eignung berechnet?"><p>Eignung = Themenwert (30, gelernte Streitquote des Unterthemas) + Streit im Vorgang (15) + Reichweite des Ortes (10) + Aktualität (10) + Konkretheit (10) + Verständlichkeit (10), auf 100 gestreckt, − Abzüge für Einzelstraßen, Ortsteil-Gremien, Planungsverfahren und Routinesatzungen. Punkte über 62 werden gespreizt (Faktor 1,6).</p><p>Das Modell wählt aus (Unterthema, Vorgangsart, Antragsteller). Die Eignung ist noch nicht gemessen: eine Rangordnung, keine Vorhersage von Klicks. Vor einem Beitrag Zahl und Fundstellen prüfen.</p></How>
  </>}

  {data&&<section aria-label="Sortieren und filtern" className="mt-8 flex flex-wrap items-end gap-x-6 gap-y-3 border-y border-slate-200 py-4">
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
    <select value={group} onChange={e=>pick<string>('social.group',setGroup)(e.target.value)} className="mt-1 block h-8 rounded-lg border border-slate-200 bg-white px-2 text-[14px] text-slate-900">
     <option value="">alle Themen ({all.length})</option>
     {groups.map(([g,n])=><option key={g} value={g}>{g} ({n})</option>)}
    </select>
   </label>
   {sort==='datum'&&<label className="flex items-center gap-2 text-[14px] text-slate-600"><input type="checkbox" checked={onlyFilled} onChange={e=>setOnlyFilled(e.target.checked)}/>Tage ohne Vorschlag ausblenden</label>}
   <p role="status" className="ml-auto text-[14px] text-slate-600">
    {data?<>{shown.length} von {all.length} Vorschlägen{avgShown!==null&&<> · Ø {avgShown} %</>}{filtered&&<> · <button type="button" className="text-teal-600" onClick={()=>{pick<number>('social.min',setMinFit)(0);pick<string>('social.group',setGroup)('');}}>Filter zurücksetzen</button></>}</>:''}
   </p>
  </section>}

  {data&&shown.length===0&&<p className="mt-6 text-[14px] text-slate-500">Kein Vorschlag erfüllt diese Auswahl. Eignung oder Thema lockern.</p>}
  {sort==='eignung'
   ?<ul className="mt-4 grid gap-4 lg:grid-cols-3">{byFit.map(t=><TopicCard key={t.id} t={t} showDate v={videos[t.id]} onVideo={loadVideos}/>)}</ul>
   :<div className="mt-4 space-y-8">
    {days.map(d=><section key={d.date} aria-label={dayName(d.date)}>
     <h2 className="text-[16px] font-semibold">{dayName(d.date)}</h2>
     {d.topics.length===0?<p className="mt-2 text-[14px] text-slate-500">{filtered?'Kein Vorschlag in dieser Auswahl.':'Kein auffälliges Thema.'}</p>:
      <ul className="mt-3 grid gap-4 lg:grid-cols-3">{d.topics.map(t=><TopicCard key={t.id} t={t} showDate={false} v={videos[t.id]} onVideo={loadVideos}/>)}</ul>}
    </section>)}
   </div>}
 </>;
}
