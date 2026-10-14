'use client';
import {useCallback,useEffect,useState} from 'react';
import {StandLine} from '@/components/admin-stand';
import {AdminPageHead,Alert,Kpis} from '@/components/admin-ui';
import {when,dur} from '@/components/admin-pdf-parts';
import type {Stand} from '@/shared/admin-types';
import {THEMES,SUBTOPICS} from '@/shared/themes.mjs';
import QUALITY from '@/shared/rule-quality.json';
type Counts={online:number;aiSummaries:number;ruleSummaries:number;ruleScoreSum:number;pdfArticles:number;aiLabels:number;unlabelled:number};
type Summary={counts:Counts;stand?:Stand;statsPending?:number};
type Step={name:string;seconds:number;ok:boolean;summary:Record<string,unknown>|null};
type Facts={version:string;reports:number;fromText:number;stale:number};
type JobState={setting:{enabled:boolean;time?:string};run:{lastStart?:string;lastEnd?:string;seconds?:number;result?:string;running?:{startedAt:string}|null}|null;now:string|null;next:string|null;last?:{finishedAt:string;result:string;all?:boolean;steps:Step[];facts?:Facts|null}|null;all?:{requestedAt:string}|null};
const RESULT:Record<string,string>={ok:'fertig',done:'fertig',failed:'mit Fehler',stopped:'angehalten'};
/** Kurzfassung eines Schritts aus seiner Zusammenfassung */
function stepNote(s:Step){
 const x=s.summary||{};
 if(x.skipped)return 'ausgelassen ('+x.skipped+')';
 if(!s.ok)return 'Fehler';
 if(s.name==='Zusammenfassungen'&&typeof x.summaries==='number')return n(x.summaries)+' neue von '+n(Number(x.withText)||0)+' mit Text';
 if(s.name==='Regeln je Bericht'&&typeof x.read==='number')return n(x.read)+' Berichte neu gelesen, davon '+n(Number(x.withText)||0)+' mit Text, '+n(Number(x.summaries)||0)+' mit Zusammenfassung';
 if(s.name==='Zahlen für plenara.X'&&typeof x.cases==='number')return n(x.cases)+' Vorgänge'+(x.unread?', davon '+n(Number(x.unread))+' ungelesen':'');
 return 'fertig';
}
const n=(v:number)=>v.toLocaleString('de-DE');
type QualityRow={id:string;name:string;version:string;quality:number|null;coverage:number|null;sample:string;date:string;note?:string;gate?:boolean};
const QT=QUALITY.target;
/** „12 %“ mit Hinweis, wenn unter dem Ziel */
/* Messwert als Balken mit Zielmarke; unter dem Ziel orange */
const Meter=({label,v,min}:{label:string;v:number|null;min:number})=><div className="min-w-0">
 <div className="flex justify-between text-[12px] text-slate-500"><span>{label}</span><span className={'tabular-nums '+(v===null?'':v<min?'text-amber-700':'text-slate-900')}>{v===null?'–':v+' %'}</span></div>
 <div className="relative mt-1 h-1.5 rounded-full bg-slate-100">{v!==null&&<span className={'block h-1.5 rounded-full '+(v<min?'bg-amber-500':'bg-teal-600')} style={{width:v+'%'}}/>}<span className="absolute -top-0.5 h-2.5 w-px bg-slate-400" style={{left:min+'%'}}/></div>
</div>;
/* Thema je Fakt wie im Atlas (ATLAS_FACTS in server/integrations/plenara-x-query.mjs) */
const FACT_THEME:Record<string,string>={plan:'bauen',plan_use:'bauen',housing:'bauen',hebesatz:'finanzen',annual_result:'finanzen',dog_tax:'finanzen',heat_plan:'umwelt',fee_rate:'umwelt',ee_power:'umwelt',grant:'soziales',kita_fee:'bildung',kita_places:'bildung',park_fee:'mobilitaet',land_price:'wirtschaft'};
const shortDate=(d:string)=>d.slice(8,10)+'.'+d.slice(5,7)+'.'+d.slice(2,4);
const THEME_NAME:Record<string,string>={...Object.fromEntries(THEMES.map((t:{id:string;name:string})=>[t.id,t.name])),unklar:'Ohne Thema (noch nicht eingeordnet)'};
const pct=(a:number,b:number)=>b?(100*a/b).toLocaleString('de-DE',{maximumFractionDigits:a/b<.01?2:a/b<.1?1:0})+' %':'–';
/** Anteil der Artikel mit KI-Text, mit regelbasiertem Text und ohne, jeweils für Zusammenfassungen und Labels. */
export function AdminRuleTexts(){
 const [data,setData]=useState<Summary|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{
  setBusy(true);setError('');
  try{const r=await fetch('/api/admin/summary',{cache:'no-store'});const d=await r.json() as Summary&{error?:string};if(!r.ok)throw Error(d.error||'Die Zahlen konnten nicht geladen werden.');setData(d);}
  catch(e){setError(e instanceof Error?e.message:'Die Zahlen konnten nicht geladen werden.');}
  finally{setBusy(false);}
 },[]);
 useEffect(()=>{load();},[load]);
 /* Job „Themen & Texte“ (scripts/rule-texts.mjs) über die Zeitpläne: Stand, letzter Lauf, sofort starten */
 const [job,setJob]=useState<JobState|null>(null),[jobError,setJobError]=useState(''),[asking,setAsking]=useState(false);
 const loadJob=useCallback(async()=>{
  try{const r=await fetch('/api/admin/zeitplaene',{cache:'no-store'});const d=await r.json() as {jobs?:(JobState&{id:string})[];error?:string};if(!r.ok)throw Error(d.error||'Der Job konnte nicht geladen werden.');setJob(d.jobs?.find(j=>j.id==='rule-texts')||null);setJobError('');}
  catch(e){setJobError(e instanceof Error?e.message:'Der Job konnte nicht geladen werden.');}
 },[]);
 useEffect(()=>{loadJob();},[loadJob]);
 /* Berichte mit Text im Hauptdokument und wie viele davon eine Zusammenfassung haben (Zählung der PDF-Ablage, stats.mjs) */
 const [pdfSum,setPdfSum]=useState<{done:number;withText:number}|null>(null);
 useEffect(()=>{fetch('/api/admin/pdf-ablage',{cache:'no-store'}).then(r=>r.ok?r.json() as Promise<{stats?:{summaries?:{done:number;withText:number}}}>:null).then(d=>setPdfSum(d?.stats?.summaries||null)).catch(()=>{/* Kennzahl bleibt leer */});},[]);
 /* all: alle Zusammenfassungen neu (auch vorhandene) und die Wortliste voll neu, sonst nur Neues */
 const start=async(all=false)=>{
  if(!window.confirm(all?'Alle regelbasierten Zusammenfassungen, Fakten und die Wortliste neu erstellen? Vorhandene Regel-Zusammenfassungen werden ersetzt; liefern die heutigen Regeln nichts, fallen sie weg. KI-Texte bleiben. Das dauert deutlich länger als ein normaler Lauf.':'Zusammenfassungen, Fakten und Wortliste jetzt erstellen? Der Job startet sofort.'))return;
  setAsking(true);
  try{const r=await fetch('/api/admin/zeitplaene',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:all?'all':'now',id:'rule-texts'})});const d=await r.json() as {error?:string};if(!r.ok)throw Error(d.error||'Das ging nicht.');await loadJob();}
  catch(e){setJobError(e instanceof Error?e.message:'Das ging nicht.');}
  finally{setAsking(false);}
 };
 const running=!!job?.run?.running,requested=!!job?.now&&(!job.run?.lastStart||job.now>job.run.lastStart);
 /* Stand nachladen: alle 5 s, solange ein Start angefordert ist oder der Job läuft, sonst jede Minute */
 useEffect(()=>{const t=setInterval(loadJob,running||requested?5000:60000);return ()=>clearInterval(t);},[loadJob,running,requested]);
 const c=data?.counts;
 const total=c?.online??0,ai=c?.aiSummaries??0,rule=c?.ruleSummaries??0,docs=c?.pdfArticles??0;
 const avg=rule?Math.round((c?.ruleScoreSum||0)/rule):undefined;
 const facts=job?.last?.facts;
 /* Hauptzahl zuerst: Abdeckung der Berichte mit Text; der Anteil im Artikel bezogen auf Artikel mit Dokument (ohne Dokument
    gibt es nichts zusammenzufassen) */
 const sum=[
  {label:'Aus PDF-Texten',value:pdfSum?pct(pdfSum.done,pdfSum.withText):undefined,note:pdfSum?n(pdfSum.done)+' von '+n(pdfSum.withText)+' Berichten mit Text im Hauptdokument haben eine Zusammenfassung; der Rest sind Sitzungsunterlagen und Texte, aus denen die Regeln nichts machen':undefined},
  {label:'Im Artikel steht',value:c?pct(ai+rule,docs):undefined,note:c?'eine Zusammenfassung, bei '+n(docs)+' Artikeln mit Dokument: '+n(rule)+' regelbasiert, '+n(ai)+' von der KI; sonst und ohne Dokument der Platzhalter':undefined},
  {label:'Ø Güte der regelbasierten Texte',value:c?(avg===undefined?'–':avg):undefined,of:avg===undefined?undefined:'von 100',note:c?(rule?'Mittel über '+n(rule)+' Artikel':'Noch keine gespeichert'):undefined},
 ];
 const fac=[
  {label:'Berichte mit Fakten',value:facts?n(facts.reports):job?'–':undefined,note:facts?n(facts.fromText)+' davon aus dem Text des Hauptdokuments, die übrigen aus dem Titel':'nach dem nächsten Lauf'},
  {label:'Fassung der Regeln',value:facts?facts.version:job?'–':undefined,note:facts?(facts.stale?n(facts.stale)+' Berichte noch mit älterer Fassung':'alle Berichte in dieser Fassung')+'; gezählt '+when(job?.last?.finishedAt):undefined},
 ];
 /* Vorgänge je Thema und Berichte je Fakt aus dem letzten Lauf (Schritt „Zahlen für plenara.X“, scripts/plenara-x/build-x-cases.mjs) */
 const xs=job?.last?.steps.find(st=>st.name==='Zahlen für plenara.X')?.summary as {themes?:Record<string,number>;subs?:Record<string,number>;facts?:Record<string,number>}|undefined;
 const themeRows=xs?.themes?Object.entries(xs.themes).sort((a,b)=>b[1]-a[1]):[];
 const themeTotal=themeRows.reduce((a,[,v])=>a+v,0);
 const subsOf=(theme:string)=>SUBTOPICS.filter((u:{theme:string})=>u.theme===theme).map((u:{id:string;name:string})=>({name:u.name,n:xs?.subs?.[u.id]||0})).sort((a:{n:number},b:{n:number})=>b.n-a.n);
 return <>
  <AdminPageHead page="regeltexte"><StandLine stand={data?.stand} busy={busy} action="Aktualisieren" onAction={load}/></AdminPageHead>
  {error&&<Alert onRetry={load}>{error}</Alert>}
  {!!data?.statsPending&&<p role="status" className="mt-4 text-[14px] text-slate-500">Die Gebietszahlen werden noch nachgeführt ({n(data.statsPending)} Gebiete offen); die Werte können noch steigen.</p>}
  <section id="regeltexte-job" className="admin-section">
   <div className="admin-section-heading"><h2>Erstellen</h2></div>
   <p className="admin-note">Aus den Texten der PDF-Ablage entstehen nach festen Regeln, ohne KI: Zusammenfassungen für Berichte ohne, Fakten für plenara.X und die Wortliste der Suche (nur wenn Zusammenfassungen dazukamen; gesucht wird in deren Kurzfassung, nicht in der Langfassung). Danach entstehen die Zahlen für plenara.X neu (eine Zeile je Vorgang), damit der Atlas nicht über alle Karten zählt. Der PDF-Import lädt und liest nur.</p>
   {jobError&&<Alert onRetry={loadJob}>{jobError}</Alert>}
   <ul className="m-0 mt-4 list-none space-y-1.5 p-0 text-[14px] text-slate-700">
    <li>{running?`Läuft seit ${when(job?.run?.running?.startedAt)}.`:requested?'Start angefordert …':job?.run?.lastStart?`Zuletzt ${when(job.run.lastStart)}${job.last?.all?' (alle neu)':''}, ${RESULT[job.run.result||'']||'–'}, ${dur(job.run.seconds)}.`:job?'Noch nicht gelaufen.':'–'}
     {job&&(job.setting.enabled?` Nächster Start ${when(job.next)} (täglich ${job.setting.time} Uhr, einstellbar unter Jobs & Zeitpläne).`:' Zeitplan ausgeschaltet (Jobs & Zeitpläne).')}</li>
    {job?.last?.steps.map(st=><li key={st.name}><span className="text-slate-500">{st.name}: </span>{stepNote(st)}, {dur(st.seconds)}</li>)}
   </ul>
   <button type="button" className="mt-4 inline-flex h-10 items-center rounded-full bg-slate-900 px-5 text-[14px] font-medium text-white hover:bg-slate-700 disabled:opacity-40" disabled={!job||running||requested||asking} onClick={()=>start()}>Jetzt erstellen →</button>
   <button type="button" className="ml-3 mt-4 inline-flex h-10 items-center rounded-full px-5 text-[14px] font-medium text-teal-600 hover:text-teal-700 disabled:opacity-40" disabled={!job||running||requested||asking} onClick={()=>start(true)}>Alle neu erstellen →</button>
   <p className="mt-2 text-[12px] text-slate-500">„Jetzt erstellen“ fasst nur Neues an. „Alle neu erstellen“ rechnet jede Regel-Zusammenfassung mit den heutigen Regeln neu und baut die Wortliste ganz neu auf, etwa nach geänderten Regeln.{job?.all&&requested?' Neu erstellen angefordert.':''}</p>
  </section>
  <section id="regeltexte-zusammenfassungen" className="admin-section">
   <div className="admin-section-heading"><h2>Zusammenfassungen</h2></div>
   <p className="admin-note">Ist eine KI-Zusammenfassung vorhanden, steht sie im Artikel; sonst die regelbasierte, sonst der Platzhalter.</p>
   <div className="mt-6"><Kpis label="Kennzahlen der Zusammenfassungen" items={sum}/></div>
  </section>
  <section id="regeltexte-fakten" className="admin-section">
   <div className="admin-section-heading"><h2>Fakten</h2></div>
   <p className="admin-note">Beträge, Hebesätze, Gebühren, Förderungen und Fraktionsanträge für plenara.X, nach festen Regeln aus Titel und Hauptdokument. Gezählt am Ende jedes Laufs.</p>
   <div className="mt-6"><Kpis label="Kennzahlen der Fakten" items={fac}/></div>
  </section>
  <section id="regeltexte-themen" className="admin-section">
   <div className="admin-section-heading"><h2>Themen</h2></div>
   <p className="admin-note">Anteil der Sachvorgänge je Thema (Formalien, Sammelpunkte und Routine zählen nicht), darunter die Unterthemen; ein Vorgang kann mehrere Unterthemen haben. Gezählt am Ende jedes Laufs{job?.last?.finishedAt?', zuletzt '+when(job.last.finishedAt):''}.</p>
   {!themeRows.length?<p className="admin-empty">Nach dem nächsten Lauf von „Themen & Texte“.</p>:<div className="mt-4">{themeRows.map(([id,v])=><div key={id} className="admin-bar-row">
    <div><span>{THEME_NAME[id]||id}</span><span>{pct(v,themeTotal)} · {n(v)}</span></div>
    <div className="admin-bar"><span style={{width:(100*v/themeTotal)+'%'}}/></div>
    {id!=='unklar'&&<small className="mt-1 block text-[12px] text-slate-500">{subsOf(id).map((u:{name:string;n:number})=>u.name+' '+pct(u.n,v)).join(' · ')}</small>}
   </div>)}</div>}
  </section>
  <section id="regeltexte-qualitaet" className="admin-section">
   <div className="admin-section-heading"><h2>Qualität der Regeln</h2></div>
   <p className="admin-note">Zuletzt gemessen an frischen Stichproben vom Server, von Hand eingetragen (shared/rule-quality.json). Qualität: von dem, was die Regel liefert, ist richtig. Abdeckung: von dem, was einen Wert haben sollte, bekommt ihn. Ziel: Qualität über {QT.quality} %, Abdeckung ab {QT.coverage} %. Im Atlas erscheinen Werte erst ab {QT.quality} %.</p>
   {QUALITY.groups.map(g=>{
    const row=(r:QualityRow)=><li key={r.id} className="grid gap-x-6 gap-y-2 py-3 text-[14px] md:grid-cols-[minmax(0,1fr)_150px_150px]">
     <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2"><span className="font-medium text-slate-900">{r.name}</span>
       {g.id==='facts'&&<span className={'rounded-full px-2 py-0.5 text-[12px] '+(r.gate?'bg-teal-50 text-teal-700':'bg-slate-100 text-slate-500')}>{r.gate?'im Atlas':'gesperrt'}</span>}</div>
      <small className="mt-1 block text-[12px] leading-snug text-slate-500">{[r.version,r.sample,shortDate(r.date),g.id==='facts'&&xs?.facts?.[r.id]!==undefined?n(xs.facts[r.id])+' Berichte':'',r.note].filter(Boolean).join(' · ')}</small>
     </div>
     <Meter label="Qualität" v={r.quality} min={QT.quality}/>
     <Meter label="Abdeckung" v={r.coverage} min={QT.coverage}/>
    </li>;
    const list=(rows:QualityRow[])=><ul className="m-0 list-none divide-y divide-slate-200 border-y border-slate-200 p-0">{rows.map(row)}</ul>;
    const rows=g.rows as QualityRow[];
    /* Fakten nach dem Thema, unter dem sie im Atlas stehen; Fraktion und Förderung gelten für alle Themen */
    const parts=g.id!=='facts'?null:[...THEMES.map((t:{id:string;name:string})=>[t.name,rows.filter(r=>FACT_THEME[r.id]===t.id)] as [string,QualityRow[]]),['Alle Themen',rows.filter(r=>!FACT_THEME[r.id])] as [string,QualityRow[]]].filter(([,x])=>x.length);
    return <div key={g.id} className="mt-8">
     <h3>{g.name}</h3>
     {parts?parts.map(([name,x])=><div key={name} className="mt-5"><h4 className="mb-1 text-[13px] font-medium uppercase tracking-wide text-slate-500">{name}</h4>{list(x)}</div>):list(rows)}
    </div>;})}
  </section>
 </>;
}
