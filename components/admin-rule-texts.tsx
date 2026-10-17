'use client';
import {isStep} from '@/shared/pipeline-terms.mjs';
import {useCallback,useEffect,useState} from 'react';
import {StandLine} from '@/components/admin-stand';
import {AdminPageHead,Alert,Kpis} from '@/components/admin-ui';
import {when,dur} from '@/components/admin-pdf-parts';
import type {Stand} from '@/shared/admin-types';
import {THEMES,SUBTOPICS} from '@/shared/themes.mjs';
import QUALITY from '@/shared/rule-quality.json';
import {MAP_FACTS} from '@/shared/map-facts.mjs';
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
 if(isStep(s.name,'rules')&&typeof x.read==='number')return n(x.read)+' Berichte neu gelesen, davon '+n(Number(x.withText)||0)+' mit Text, '+n(Number(x.summaries)||0)+' mit Zusammenfassung';
 if(isStep(s.name,'xcases')&&typeof x.cases==='number')return n(x.cases)+' Vorgänge'+(x.unread?', davon '+n(Number(x.unread))+' ungelesen':'');
 return 'fertig';
}
const n=(v:number)=>v.toLocaleString('de-DE');
type QualityRow={id:string;name:string;version:string;quality:number|null;coverage:number|null;sample:string;date:string;note?:string;gate?:boolean;what?:string;/* Grund, warum ein Wert trotz Messung nicht auf die Karte kommt */lock?:string;
 /* Signale: Trefferquote der Kategorie und Qualität je Filter (docs/produkt/plenara-x-signale.md) */ recall?:number|null;art?:number|null;phase?:number|null;phaseFrom?:string;filters?:{name:string;quality:number|null}[]};
/* „i“ neben dem Namen: was bei der Regel gemessen wird (what in rule-quality.json); Klick öffnet, für Tastatur und Touch */
const Info=({text}:{text:string})=>{const [open,setOpen]=useState(false);return <>
 <button type="button" aria-label="Was gemessen wird" aria-expanded={open} title={text} onClick={()=>setOpen(o=>!o)} className={'inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border text-[12px] font-semibold leading-none '+(open?'border-teal-600 bg-teal-600 text-white':'border-slate-300 text-slate-500 hover:border-teal-600 hover:text-teal-700')}>i</button>
 {open&&<span className="basis-full rounded-md bg-slate-50 px-3 py-2 text-[14px] leading-snug text-slate-700">{text}</span>}
</>;};
const QT=QUALITY.target;
/** „12 %“ mit Hinweis, wenn unter dem Ziel */
/* Messwert als Balken mit Zielmarke; unter dem Ziel orange */
/* Signale: offen erst, wenn alles gemessen ist: Qualität, Art und Stand ab 90 %, Trefferquote ab 80 % */
const SIGNAL_RECALL=80;
/* Fakten: Anteil der Gemeinden mit mindestens einem Wert, ab dem ein Fakt gilt (Entscheidung 17.10.2026) */
const FACT_PLACES=20;
const signalGate=(r:QualityRow)=>{const v=[r.quality,r.recall,r.art,r.phase];return v.some(x=>x===null||x===undefined)?'unmeasured':[r.quality,r.art,r.phase].every(x=>(x as number)>=QT.quality)&&(r.recall as number)>=SIGNAL_RECALL?'open':'closed';};
const SignalGate=()=>{return <Info text="Offen, wenn alles gemessen ist: Qualität, Art und Stand je mindestens 90 %, Trefferquote mindestens 80 %."/>;};
const SignalGateBadge=({r}:{r:QualityRow})=>{const g=signalGate(r);return <span title="Offen, wenn Qualität, Art und Stand je mindestens 90 % und die Trefferquote mindestens 80 % erreichen." className={'rounded-full px-2 py-0.5 text-[12px] '+(g==='open'?'bg-teal-50 text-teal-700':g==='closed'?'bg-amber-50 text-amber-700':'bg-slate-100 text-slate-500')}>{g==='open'?'offen':g==='closed'?'unter 90 %':'noch nicht alles gemessen'}</span>;};
/* Erklärung beim Darüberfahren je Kennzahl */
const METER_HINT:Record<string,string>={
 Qualität:'Genauigkeit: Von dem, was die Regel liefert, ist so viel richtig. Gemessen an zufälligen Treffern einer ungesehenen Stichprobe (zum Beispiel 36 von 40 echte Vergaben = 90 %).',
 Trefferquote:'Vollständigkeit: Von allen Vorgängen, die wirklich dazugehören, findet die Regel so viele. Gemessen an Vorgängen, die von Hand als passend erkannt sind (zum Beispiel 32 von 40 gefunden = 80 %).',
 Art:'Qualität der Art (Filter): Von den richtig zugeordneten Vorgängen ist die Art (zum Beispiel Hochbau, Freiflächen-PV) so oft richtig. Zusammen über alle Filter der Kategorie.',
 Stand:'Qualität des Stands: Von den richtig zugeordneten Vorgängen ist der Stand (zum Beispiel Vergabe, Satzungsbeschluss, Genehmigung) so oft richtig. Woher der Stand kommt, steht darunter.',
 Abdeckung:'Von dem, was einen Wert haben sollte, bekommt ihn so viel.',
 Gemeinden:'Anteil der Gemeinden mit mindestens einem Wert, von allen Gemeinden mit mindestens einem Sachvorgang in Plenara.',
};
/* Kennzahl mit Erklärung: beim Darüberfahren und, für das Handy, beim Antippen des Namens */
const Meter=({label,v,min}:{label:string;v:number|null;min:number})=>{const [open,setOpen]=useState(false);const hint=METER_HINT[label];return <div className="min-w-0" title={hint}>
 <div className="flex justify-between text-[12px] text-slate-500">{hint?<button type="button" aria-expanded={open} onClick={()=>setOpen(o=>!o)} className="cursor-help text-left underline decoration-dotted underline-offset-2">{label}</button>:<span>{label}</span>}<span className={'tabular-nums '+(v===null?'':v<min?'text-amber-700':'text-slate-900')}>{v===null?'–':v+' %'}</span></div>
 <div className="relative mt-1 h-1.5 rounded-full bg-slate-100">{v!==null&&<span className={'block h-1.5 rounded-full '+(v<min?'bg-amber-500':'bg-teal-600')} style={{width:v+'%'}}/>}<span className="absolute -top-0.5 h-2.5 w-px bg-slate-400" style={{left:min+'%'}}/></div>
 {open&&hint&&<p className="m-0 mt-1 text-[12px] leading-snug text-slate-600">{hint}</p>}
</div>;};
/* Thema je Fakt wie im Atlas (ATLAS_FACTS in server/integrations/plenara-x-query.mjs) */
const FACT_THEME:Record<string,string>={plan:'bauen',plan_use:'bauen',housing:'bauen',hebesatz:'finanzen',annual_result:'finanzen',dog_tax:'finanzen',waste_fee:'umwelt',plan_area:'bauen',wind_count:'umwelt',project:'mobilitaet',road:'mobilitaet',house_type:'bauen',heat_plan:'umwelt',fee_rate:'umwelt',ee_power:'umwelt',grant:'soziales',kita_fee:'bildung',land_price:'wirtschaft',budget:'finanzen',second_home_tax:'finanzen',amusement_tax:'finanzen',plot_price:'bauen'};
/* Ohne Abdeckung: jeder Bericht oder jedes PDF bekommt einen Wert (Unterthemen, Hauptdokument, Dokumentart) oder es ist eine Rangfolge (Social Media) */
const NO_COVERAGE=new Set(['stage','subs','main_doc','doc_type','social']);
/* Fakten nach Verwendung: Werte für die Karte von plenara.X Fakten (Zahl je Gemeinde), Bausteine der Signale (Einordnungen für
   Stand und Auswahl, keine Zahlen; stehen bei den Signalen), Fraktionsprofil (plenara.X Einblicke) */
/* Konzept docs/produkt/signale-und-fakten.md: Fakt = Zahlenwert zum Vergleich; Signal = Ereignis mit Art, Stand und optional Größe */
const SIGNAL_STAND=new Set(['plan','heat_plan','stage']);
const SIGNAL_ART=new Set(['plan_use','house_type','road','project']);
const SIGNAL_GROESSE=new Set(['plan_area','housing','wind_count','ee_power']);
/* Ereignis statt Zahl: gehört zu den Signalen (Kita-Gebühren erhöht oder neu gefasst) */
const SIGNAL_EREIGNIS=new Set(['kita_fee']);
const PROFILE_FACTS=new Set(['faction','faction_advice']);
const factArt=(id:string)=>SIGNAL_STAND.has(id)?'stand':SIGNAL_ART.has(id)?'art':SIGNAL_GROESSE.has(id)?'groesse':SIGNAL_EREIGNIS.has(id)?'ereignis':PROFILE_FACTS.has(id)?'profil':'vergleich';
/* Neue Signale, noch nicht gebaut (Konzept, Abschnitt „Kategorien: Was neu heißt“) */
const SIGNAL_IDEAS:{name:string;what:string}[]=[
 {name:'Schrittwechsel eines Vorhabens',what:'Meldung, wenn der Stand eines bekannten Vorhabens wechselt („geht in die Auslegung“, „Satzungsbeschluss“). Braucht ein Gedächtnis je Vorhaben (Vorgang über mehrere Sitzungen).'},
 {name:'Änderung eines Fakts',what:'Hebesatz oder Gebühr ändert sich gegenüber dem Vorjahr. Der Fakt wird zum Signal; braucht frühere Werte desselben Orts.'},
 {name:'Neuer Standort',what:'Einzelhandel, Pflege oder Schule aus der Nutzung in der Bauleitplanung.'},
 {name:'Große Vergabe',what:'Vergabe über einer Schwelle je Branche (Betrag aus dem Titel oder Beschluss).'},
];
/* Auf der Karte von plenara.X Fakten (shared/map-facts.mjs) */
/* Zeilen der Fakten (für die Bausteine bei den Signalen) */
const FACT_ROWS=(QUALITY.groups.find(g=>g.id==='facts')?.rows??[]) as QualityRow[];
const ON_MAP=new Set((MAP_FACTS as [string,string,boolean][]).filter(([,,on])=>on).map(([k])=>k));
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
 // Erstes Laden nach dem Rendern (setState nicht synchron im Effect)
 useEffect(()=>{const t=setTimeout(load,0);return ()=>clearTimeout(t);},[load]);
 /* Job „Themen & Texte“ (scripts/rule-texts.mjs) über die Zeitpläne: Stand, letzter Lauf, sofort starten */
 const [job,setJob]=useState<JobState|null>(null),[jobError,setJobError]=useState(''),[asking,setAsking]=useState(false);
 const loadJob=useCallback(async()=>{
  try{const r=await fetch('/api/admin/zeitplaene',{cache:'no-store'});const d=await r.json() as {jobs?:(JobState&{id:string})[];error?:string};if(!r.ok)throw Error(d.error||'Der Job konnte nicht geladen werden.');setJob(d.jobs?.find(j=>j.id==='rule-texts')||null);setJobError('');}
  catch(e){setJobError(e instanceof Error?e.message:'Der Job konnte nicht geladen werden.');}
 },[]);
 useEffect(()=>{const t=setTimeout(loadJob,0);return ()=>clearTimeout(t);},[loadJob]);
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
 const ai=c?.aiSummaries??0,rule=c?.ruleSummaries??0,docs=c?.pdfArticles??0;
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
 const xs=job?.last?.steps.find(st=>isStep(st.name,'xcases'))?.summary as {themes?:Record<string,number>;subs?:Record<string,number>;facts?:Record<string,number>;factPlaces?:{total:number;places:Record<string,number>}}|undefined;
 const themeRows=xs?.themes?Object.entries(xs.themes).sort((a,b)=>b[1]-a[1]):[];
 const themeTotal=themeRows.reduce((a,[,v])=>a+v,0);
 const subsOf=(theme:string)=>SUBTOPICS.filter((u:{theme:string})=>u.theme===theme).map((u:{id:string;name:string})=>({name:u.name,n:xs?.subs?.[u.id]||0})).sort((a:{n:number},b:{n:number})=>b.n-a.n);
 return <>
  <AdminPageHead page="regeltexte"><StandLine stand={data?.stand} busy={busy} action="Aktualisieren" onAction={load}/></AdminPageHead>
  {error&&<Alert onRetry={load}>{error}</Alert>}
  {!!data?.statsPending&&<p role="status" className="mt-4 text-[14px] text-slate-500">Die Gebietszahlen werden noch nachgeführt ({n(data.statsPending)} Gebiete offen); die Werte können noch steigen.</p>}
  <section id="regeltexte-job" className="admin-section">
   <div className="admin-section-heading"><h2>Erstellen</h2></div>
   <p className="admin-note">Drei Schritte nach festen Regeln, ohne KI: Regeln je Bericht (Thema, Zusammenfassung, Fakten), Wortliste der Suche, Zahlen für plenara.X (Atlas, Signale, Fakten).</p>
   {jobError&&<Alert onRetry={loadJob}>{jobError}</Alert>}
   <ul className="m-0 mt-4 list-none space-y-1.5 p-0 text-[14px] text-slate-700">
    <li>{running?`Läuft seit ${when(job?.run?.running?.startedAt)}.`:requested?'Start angefordert …':job?.run?.lastStart?`Zuletzt ${when(job.run.lastStart)}${job.last?.all?' (alle neu)':''}, ${RESULT[job.run.result||'']||'–'}, ${dur(job.run.seconds)}.`:job?'Noch nicht gelaufen.':'–'}
     {job&&(job.setting.enabled?` Nächster Start ${when(job.next)} (täglich ${job.setting.time} Uhr, einstellbar unter Jobs & Zeitpläne).`:' Zeitplan ausgeschaltet (Jobs & Zeitpläne).')}</li>
    {job?.last?.steps.map(st=><li key={st.name}><span className="text-slate-500">{st.name}: </span>{stepNote(st)}, {dur(st.seconds)}</li>)}
   </ul>
   <button type="button" className="mt-4 inline-flex h-10 items-center rounded-full bg-teal-700 px-5 text-[14px] font-medium text-white hover:bg-teal-800 disabled:opacity-40" disabled={!job||running||requested||asking} onClick={()=>start()}>Jetzt erstellen →</button>
   <button type="button" className="ml-3 mt-4 inline-flex h-10 items-center rounded-full px-5 text-[14px] font-medium text-teal-600 hover:text-teal-700 disabled:opacity-40" disabled={!job||running||requested||asking} onClick={()=>start(true)}>Alle neu erstellen →</button>
   <p className="mt-2 text-[12px] text-slate-500">„Jetzt erstellen“: nur Neues. „Alle neu erstellen“: alles mit den heutigen Regeln, etwa nach Regeländerungen.{job?.all&&requested?' Neu erstellen angefordert.':''}</p>
  </section>
  <section id="regeltexte-zusammenfassungen" className="admin-section">
   <div className="admin-section-heading"><h2>Zusammenfassungen</h2></div>
   <p className="admin-note">Ist eine KI-Zusammenfassung vorhanden, steht sie im Artikel; sonst die regelbasierte, sonst der Platzhalter.</p>
   <div className="mt-6"><Kpis label="Kennzahlen der Zusammenfassungen" items={sum}/></div>
  </section>
  <section id="regeltexte-fakten" className="admin-section">
   <div className="admin-section-heading"><h2>Fakten und Einordnungen</h2></div>
   <p className="admin-note">Werte (für plenara.X Fakten) und Einordnungen (für Signale und Fraktionsprofil) aus Titel, Hauptdokument und passenden Anlagen. Gezählt am Ende jedes Laufs.</p>
   <div className="mt-6"><Kpis label="Kennzahlen der Fakten und Einordnungen" items={fac}/></div>
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
   <p className="admin-note">Letzte ungesehene Stichprobe vom Server, von Hand eingetragen (shared/rule-quality.json); Erklärung je Wert beim Antippen des Namens oder des „i“. Signale zählen nach Qualität (ab {QT.quality} %) und Trefferquote (ab {SIGNAL_RECALL} %). Fakten nehmen wir nur auf, wenn wir sie für viele Gemeinden haben (ab {FACT_PLACES} % der Gemeinden{xs?.factPlaces?`, von ${xs.factPlaces.total.toLocaleString("de-DE")} mit Sachvorgängen`:""}) und die Werte stimmen (Qualität ab {QT.quality} %).</p>
   {QUALITY.groups.map(g=>{
    const row=(r:QualityRow,gid:string=g.id)=><li key={r.id} className="grid gap-x-6 gap-y-2 py-3 text-[14px] md:grid-cols-[minmax(0,1fr)_150px_150px]">
     <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2"><span className="font-medium text-slate-900">{r.name}</span>{r.what&&<Info text={r.what}/>}
       {gid==='facts'&&factArt(r.id)==='vergleich'&&<span className={'rounded-full px-2 py-0.5 text-[12px] '+(ON_MAP.has(r.id)?'bg-teal-50 text-teal-700':r.quality!=null&&r.quality<QT.quality?'bg-amber-50 text-amber-700':'bg-slate-100 text-slate-500')}>{ON_MAP.has(r.id)?'auf der Karte'+(xs?.factPlaces&&100*(xs.factPlaces.places[r.id]||0)/xs.factPlaces.total<FACT_PLACES?', Gemeinden unter '+FACT_PLACES+' %':''):r.quality==null?'nicht gemessen':r.quality<QT.quality?'unter '+QT.quality+' %':r.lock||'noch gesperrt'}</span>}</div>
      <small className="mt-1 block text-[12px] leading-snug text-slate-500">{[r.version,r.sample,shortDate(r.date),gid==='facts'&&xs?.facts?.[r.id]!==undefined?n(xs.facts[r.id])+' Berichte':'',r.note].filter(Boolean).join(' · ')}</small>
     </div>
     <Meter label="Qualität" v={r.quality} min={QT.quality}/>
     {gid==='facts'&&factArt(r.id)!=='vergleich'?<div className="min-w-0 text-[12px] text-slate-500">{xs?.facts?.[r.id]!==undefined?<><span className="block text-[18px] font-semibold tabular-nums text-slate-900">{n(xs.facts[r.id])}</span>Berichte</>:r.id==='stage'?'':'noch kein Lauf'}</div>
      :gid==='facts'&&xs?.factPlaces?<Meter label="Gemeinden" v={Math.round(1000*(xs.factPlaces.places[r.id]||0)/xs.factPlaces.total)/10} min={FACT_PLACES}/>:r.id==='summary'&&c&&docs?<Meter label="Abdeckung" v={Math.round(100*(ai+rule)/docs)} min={QT.coverage}/>:NO_COVERAGE.has(r.id)?<div/>:<Meter label="Abdeckung" v={r.coverage} min={QT.coverage}/>}
    </li>;
    const list=(rows:QualityRow[],gid:string=g.id)=><ul className="m-0 list-none divide-y divide-slate-200 border-y border-slate-200 p-0">{rows.map(r=>row(r,gid))}</ul>;
    /* Signale: Kategorie mit Qualität der Zuordnung und Trefferquote, darunter die Filter mit eigener Qualität */
    if(g.id==='signals')return <div key={g.id} className="mt-8">
     <h3>{g.name}</h3>
     <p className="admin-note mt-1">Ein Signal ist ein Ereignis, das eine Branche wissen will („Wo entsteht gerade etwas Neues?“), mit Art, Stand und optional Größe. Ein Fakt dagegen ist ein Zahlenwert zum Vergleich von Orten (siehe unten). Konzept: docs/produkt/signale-und-fakten.md.</p>
     <p className="admin-note mt-1">Qualität: von den Vorgängen, die die Regel einer Kategorie oder einem Filter zuordnet, gehören so viele wirklich dazu. Trefferquote: von den Vorgängen, die dazugehören, findet die Regel so viele. Offen erst, wenn Qualität, Art und Stand je mindestens {QT.quality} % und die Trefferquote mindestens {SIGNAL_RECALL} % erreichen. Kategorien, Filter und Vorgehen: docs/produkt/plenara-x-signale.md.</p>
     <ul className="m-0 list-none divide-y divide-slate-200 border-y border-slate-200 p-0">{(g.rows as QualityRow[]).map(r=><li key={r.id} className="py-3 text-[14px]">
      <div className="grid gap-x-6 gap-y-2 md:grid-cols-[minmax(0,1fr)_120px_120px_120px_120px]">
       <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><span className="font-medium text-slate-900">{r.name}</span>{r.what&&<Info text={r.what}/>}
         <SignalGateBadge r={r}/>{(r.id==='sig_pflege'||r.id==='sig_handel')&&<span className="rounded-full bg-slate-100 px-2 py-0.5 text-[12px] text-slate-500">Kategorie fehlt im Frontend</span>}<SignalGate/></div>
        <small className="mt-1 block text-[12px] leading-snug text-slate-500">{[r.version,r.sample,shortDate(r.date),r.phaseFrom&&'Stand: '+r.phaseFrom,r.note].filter(Boolean).join(' · ')}</small>
       </div>
       <Meter label="Qualität" v={r.quality} min={QT.quality}/>
       <Meter label="Trefferquote" v={r.recall??null} min={SIGNAL_RECALL}/>
       <Meter label="Art" v={r.art??null} min={QT.quality}/>
       <Meter label="Stand" v={r.phase??null} min={QT.quality}/>
      </div>
      {r.filters&&r.filters.length>0&&<ul className="m-0 mt-2 grid list-none gap-x-6 gap-y-1 p-0 pl-4 sm:grid-cols-2 lg:grid-cols-3">{r.filters.map(f=><li key={f.name} className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-1 text-[14px]">
       <span className="text-slate-700">{f.name}</span>
       <span className={'tabular-nums '+(f.quality===null?'text-slate-400':f.quality>=QT.quality?'font-semibold text-teal-700':'font-semibold text-slate-900')}>{f.quality===null?'nicht gemessen':f.quality+' %'}</span>
      </li>)}</ul>}
     </li>)}</ul>
     <h4 className="mb-0 mt-6 text-[16px] font-semibold text-slate-900">Stand der Signale</h4>
     <p className="admin-note mt-1">Verfahrensschritt eines Vorhabens (zum Beispiel eines Bebauungsplans oder der Wärmeplanung), keine Zahl. Rechts die Zahl der Berichte im letzten Lauf.</p>
     {list(FACT_ROWS.filter(r=>factArt(r.id)==='stand'),'facts')}
     <h4 className="mb-0 mt-6 text-[16px] font-semibold text-slate-900">Art der Signale</h4>
     <p className="admin-note mt-1">Was für ein Vorhaben es ist (Nutzung im Plan, Hausformen, Straßenbau, Mobilitätsprojekte). Sie bilden die Filter der Kategorien.</p>
     {list(FACT_ROWS.filter(r=>factArt(r.id)==='art'),'facts')}
     <h4 className="mb-0 mt-6 text-[16px] font-semibold text-slate-900">Angaben am Signal (Größe)</h4>
     <p className="admin-note mt-1">Fläche, Wohneinheiten, Anlagenzahl, Leistung. Sie hängen am Signal und blockieren es nicht; angezeigt werden sie nur, wenn sie im Text belegt sind. Ihre Qualität wird getrennt gemessen.</p>
     {list(FACT_ROWS.filter(r=>factArt(r.id)==='groesse'),'facts')}
     <h4 className="mb-0 mt-6 text-[16px] font-semibold text-slate-900">Gebührenänderungen (Ereignisse)</h4>
     <p className="admin-note mt-1">Kein Zahlenwert, sondern ein Ereignis: Gebühren erhöht oder neu gefasst. Gehört zu den Signalen; das Signal selbst gibt es noch nicht.</p>
     {list(FACT_ROWS.filter(r=>factArt(r.id)==='ereignis'),'facts')}
     <h4 className="mb-0 mt-6 text-[16px] font-semibold text-slate-900">Weitere Signale (noch nicht gebaut)</h4>
     <p className="admin-note mt-1">Vorschläge aus dem Konzept. Jedes bekommt erst eine Regel, dann eine Messung, dann ein Tor.</p>
     <ul className="m-0 list-none divide-y divide-slate-200 border-y border-slate-200 p-0">{SIGNAL_IDEAS.map(i=><li key={i.name} className="py-3 text-[14px]"><div className="flex flex-wrap items-center gap-2"><span className="font-medium text-slate-900">{i.name}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[12px] text-slate-500">geplant</span></div><small className="mt-1 block text-[12px] leading-snug text-slate-500">{i.what}</small></li>)}</ul>
    </div>;
    const rows=g.rows as QualityRow[];
    /* Fakten nach Thema; ohne Thema („Alle Themen“) etwa der Haushalt */
    const byTheme=(x:QualityRow[])=>[...THEMES.map((t:{id:string;name:string})=>[t.name,x.filter(r=>FACT_THEME[r.id]===t.id)] as [string,QualityRow[]]),['Alle Themen',x.filter(r=>!FACT_THEME[r.id])] as [string,QualityRow[]]].filter(([,y])=>y.length);
    if(g.id==='facts')return <div key={g.id}>
     <div className="mt-8">
      <h3>{g.name}</h3>
      <p className="admin-note mt-1">Ein Fakt ist ein Zahlenwert mit Einheit, vergleichbar über Orte und Zeit: Zahlen je Gemeinde für die Karte von plenara.X Fakten (Hebesätze, Gebühren, Steuern, Haushalt, Preise …). Größen von Vorhaben sind keine Fakten, sondern Angaben am Signal (oben). Qualität: von den gelesenen Werten sind so viele richtig. Gemeinden: Anteil der Gemeinden mit mindestens einem Wert. Ein Fakt gilt als frei, wenn die Qualität bei mindestens {QT.quality} % und der Anteil der Gemeinden bei mindestens {FACT_PLACES} % liegt. Auf der Karte stehen heute Fakten ab {QT.quality} % Qualität.</p>
      {byTheme(rows.filter(r=>factArt(r.id)==='vergleich')).map(([t,y])=><div key={t} className="mt-4"><h4 className="mb-1 text-[14px] font-medium uppercase tracking-wide text-slate-500">{t}</h4>{list(y)}</div>)}
     </div>
     <div className="mt-8">
      <h3>Fraktionsprofil (plenara.X Einblicke)</h3>
      <p className="admin-note mt-1">Welche Fraktion einen Antrag stellt und ob der Beschlussvorschlag empfiehlt, ihn abzulehnen. Rechts die Zahl der Berichte im letzten Lauf.</p>
      {list(rows.filter(r=>factArt(r.id)==='profil'))}
     </div>
    </div>;
    return <div key={g.id} className="mt-8">
     <h3>{g.name}</h3>
     {list(rows)}
    </div>;})}
  </section>
 </>;
}
