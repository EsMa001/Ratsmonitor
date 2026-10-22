'use client';
/* Admin „Themen & Texte“ (seit 22.10.2026): Kernstück ist das Modell (requirements/modell-konzept.md). Es beantwortet je Bericht
   neun Fragen (Begriffsbuch requirements/begriffsbuch-kern.md); die früheren Regeln für Art, Thema, „Was geschieht“, Dokumente
   und die Signal-Regeln werden nicht mehr angewendet und hier nicht mehr gezeigt. Darunter Lauf, Themen, Zusammenfassung und
   Fakten (die bleiben Regeln). Messwerte des Modells: shared/model-quality.json (schreibt scripts/model/train.mjs), Fassung:
   shared/model-manifest.json; Fakten: shared/rule-quality.json (Gruppe facts). */
import {isStep} from '@/shared/pipeline-terms.mjs';
import {useCallback,useEffect,useRef,useState} from 'react';
import {StandLine} from '@/components/admin-stand';
import {AdminPageHead,Alert,Kpis} from '@/components/admin-ui';
import {when,dur} from '@/components/admin-pdf-parts';
import type {Stand} from '@/shared/admin-types';
import {THEMES,SUBTOPICS} from '@/shared/themes.mjs';
import QUALITY from '@/shared/rule-quality.json';
import MODEL_QUALITY from '@/shared/model-quality.json';
import MANIFEST from '@/shared/model-manifest.json';
import {MAP_FACTS} from '@/shared/map-facts.mjs';
import {MODEL_COVERED} from '@/shared/model/fact-gate.mjs';
import {SUBSUBS} from '@/shared/model/subsubs.mjs';
import {KIND_NAMES,STATUS_NAMES,PROCESS_NAMES,STEP_NAMES,SERVICE_NAMES,APPLICANT_NAMES,DOCTYPE_NAMES} from '@/shared/model/names.mjs';
type Counts={online:number;aiSummaries:number;ruleSummaries:number;ruleScoreSum:number;pdfArticles:number;aiLabels:number;unlabelled:number};
type Summary={counts:Counts;stand?:Stand;statsPending?:number};
type Step={name:string;seconds:number;ok:boolean;summary:Record<string,unknown>|null};
type Facts={version:string;reports:number;fromText:number;stale:number};
type JobState={setting:{enabled:boolean;time?:string};run:{lastStart?:string;lastEnd?:string;seconds?:number;result?:string;running?:{startedAt:string}|null}|null;now:string|null;next:string|null;last?:{finishedAt:string;result:string;all?:boolean;steps:Step[];facts?:Facts|null}|null;all?:{requestedAt:string}|null};
type Q={acc:number|null;cov?:number|null;n:number;sureAcc?:number|null;sureShare?:number|null};
type FactRow={id:string;name:string;version:string;quality:number|null;coverage:number|null;sample:string;date:string;note?:string;what?:string;lock?:string};
const RESULT:Record<string,string>={ok:'fertig',done:'fertig',failed:'mit Fehler',stopped:'angehalten'};
const n=(v:number)=>v.toLocaleString('de-DE');
const pct=(a:number,b:number)=>b?(100*a/b).toLocaleString('de-DE',{maximumFractionDigits:a/b<.01?2:a/b<.1?1:0})+' %':'–';
const shortDate=(d:string)=>d.slice(8,10)+'.'+d.slice(5,7)+'.'+d.slice(2,4);
/* Ziel für Genauigkeit und Abdeckung, wie bei den früheren Regeln */
const GOAL=QUALITY.target.quality;
/* Die neun Fragen (Begriffsbuch Abschnitt 0) mit den Messwerten aus shared/model-quality.json; list: Liste mit Abdeckung,
   sure: Anteil sicherer Antworten (ab 0,7) */
const QUESTIONS:{key:string;name:string;what:string;list?:boolean;sure?:boolean}[]=[
 {key:'kind',name:'1. Art',what:'Sachpunkt, Ablauf (Formalien, Sammelpunkte) oder Personalie. Ablauf und Personalie bekommen kein Thema; „ohne Formalien“ in der Suche folgt daraus.',sure:true},
 {key:'theme',name:'2. Thema',what:'Eines der 10 Themen der Suche. Genauigkeit: von den vergebenen Themen richtig; Abdeckung: von den Sachpunkten mit Thema das richtige erkannt.',list:true},
 {key:'sub',name:'Unterthema',what:'70 Unterthemen, je Thema gelernt.',list:true},
 {key:'subsub',name:'Unter-Unterthema',what:'Feinere Filter der Signale (zum Beispiel Freiflächen-PV, Grundschule), je Unterthema gelernt.',list:true},
 {key:'process',name:'3. Vorgangsart',what:'Information, Antrag aus der Politik, Genehmigung für Dritte, Planung und Regelung, Bau und Vergabe, Geld, Vertrag und Grundstück, Sonstiges. Ersetzt „Was geschieht“.',sure:true},
 {key:'status',name:'4. Status',what:'Angekündigt bis Stand offen. Ist das Modell sicher (ab 0,7), steht sein Status im Bericht, sonst der des Imports.',sure:true},
 {key:'project',name:'5. Vorhaben',what:'Konkretes Vorhaben ja oder nein: Grundlage der Signale.'},
 {key:'step',name:'6. Schritt',what:'Wo ein Verfahren steht (Start bis Aufhebung), bei Planung und Regelung. Bisher an Bauleit- und Wärmeplänen gelernt.'},
 {key:'applicants',name:'7. Wer',what:'Art des Antragstellers bei Anträgen aus der Politik: Fraktion, einzelnes Mitglied, Gremium oder Einwohner. Welche Partei, liest der Fakt aus dem Text (ein Name, keine Einordnung), und zwar nur, wenn hier Fraktion steht.'},
 {key:'service',name:'8. Leistungsart',what:'Was beauftragt wird, bei Bau und Vergabe: Bauleistung, Planung, Lieferung, IT, Dienstleistung oder keine.'},
 {key:'doctype',name:'9. Dokumentart',what:'Je PDF: Vorlage, Sammeldokument, Anlage, Ergebnis, Niederschrift, Sitzungsunterlage, Sonstiges.'},
 {key:'main',name:'Hauptdokument',what:'Das PDF, das den Gegenstand trägt; aus ihm kommen Zusammenfassung und Fakten.'},
 {key:'result',name:'Ergebnisdokument',what:'Das PDF mit dem Ergebnis (Beschlussauszug, sonst Niederschrift); Beleg für den Status.'},
];
/* Alle möglichen Antworten je Frage (ohne Zahlen), für das Fenster beim Klick auf den Namen */
type Group={head?:string;items:string[]};
const subName=(id:string)=>(SUBTOPICS as {id:string;name:string}[]).find(u=>u.id===id)?.name||id;
const THEME_LIST=(THEMES as {id:string;name:string}[]);
const VALUES:Record<string,Group[]>={
 kind:[{items:Object.values(KIND_NAMES)}],
 theme:[{items:[...THEME_LIST.map(t=>t.name),'Sonstiges (kein Thema erkennbar)']}],
 sub:THEME_LIST.map(t=>({head:t.name,items:(SUBTOPICS as {theme:string;name:string}[]).filter(u=>u.theme===t.id).map(u=>u.name)})),
 subsub:[...new Set(Object.keys(SUBSUBS).map(k=>k.split('.').slice(0,2).join('.')))].map(p=>({head:subName(p),items:Object.entries(SUBSUBS as Record<string,string>).filter(([k])=>k.startsWith(p+'.')).map(([,v])=>v)})),
 process:[{items:Object.values(PROCESS_NAMES)}],
 status:[{items:Object.values(STATUS_NAMES)}],
 project:[{items:['Konkretes Vorhaben','Kein konkretes Vorhaben']}],
 step:[{items:Object.values(STEP_NAMES)}],
 applicants:[{items:Object.values(APPLICANT_NAMES)}],
 service:[{items:[...Object.values(SERVICE_NAMES),'Keine (eigenes Vorhaben ohne Auftrag)']}],
 doctype:[{items:Object.values(DOCTYPE_NAMES)}],
 main:[{items:['Ein PDF des Berichts (Vorlage oder Sammeldokument, bei Anträgen der Antrag)','Keins (nur Anlagen oder Sitzungsunterlagen)']}],
 result:[{items:['Beschlussauszug oder Abstimmungsergebnis zu diesem Punkt','Sonst die Niederschrift der Sitzung','Keins']}],
};
/* Fenster mit allen Antworten einer Frage; Escape und Klick auf „Schließen“ schließen es */
function ValuesDialog({q,onClose}:{q:{key:string;name:string;what:string}|null;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const d=ref.current;if(!d)return;if(q&&!d.open)d.showModal();if(!q&&d.open)d.close();},[q]);
 const groups=q?VALUES[q.key]||[]:[];
 return <dialog ref={ref} onClose={onClose} aria-labelledby="werte-titel" className="w-[min(560px,calc(100vw-32px))] max-h-[min(80dvh,720px)] rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/30">
  {q&&<div className="flex max-h-[min(80dvh,720px)] flex-col">
   <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
    <div><h2 id="werte-titel" className="m-0 text-[18px] font-semibold">{q.name.replace(/^\d+\.\s*/,'')}</h2><p className="m-0 mt-1 text-[14px] leading-snug text-slate-600">{q.what}</p></div>
    <button type="button" onClick={onClose} className="shrink-0 rounded-full px-3 py-1 text-[14px] text-teal-700 hover:bg-slate-50">Schließen</button>
   </div>
   <div className="overflow-y-auto px-5 py-4">{groups.map((g,i)=><div key={i} className={i?'mt-4':''}>
    {g.head&&<h3 className="m-0 mb-1 text-[12px] font-medium uppercase tracking-wide text-slate-500">{g.head}</h3>}
    <ul className="m-0 list-none p-0 text-[14px]">{g.items.map(v=><li key={v} className="border-b border-slate-100 py-1.5">{v}</li>)}</ul>
   </div>)}</div>
  </div>}
 </dialog>;
}
/* „i“ neben dem Namen: was gemessen wird; Klick öffnet, für Tastatur und Touch */
const Info=({text}:{text:string})=>{const [open,setOpen]=useState(false);return <>
 <button type="button" aria-label="Was gemessen wird" aria-expanded={open} title={text} onClick={()=>setOpen(o=>!o)} className={'inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border text-[12px] font-semibold leading-none '+(open?'border-teal-600 bg-teal-600 text-white':'border-slate-300 text-slate-500 hover:border-teal-600 hover:text-teal-700')}>i</button>
 {open&&<span className="basis-full rounded-md bg-slate-50 px-3 py-2 text-[14px] leading-snug text-slate-700">{text}</span>}
</>;};
/* Messwert als Balken mit Zielmarke; unter dem Ziel orange */
const Meter=({label,v,min,hint}:{label:string;v:number|null|undefined;min:number;hint?:string})=><div className="min-w-0" title={hint}>
 <div className="flex justify-between text-[12px] text-slate-500"><span>{label}</span><span className={'tabular-nums '+(v==null?'':v<min?'text-amber-700':'text-slate-900')}>{v==null?'–':v+' %'}</span></div>
 <div className="relative mt-1 h-1.5 rounded-full bg-slate-100">{v!=null&&<span className={'block h-1.5 rounded-full '+(v<min?'bg-amber-500':'bg-teal-600')} style={{width:v+'%'}}/>}<span className="absolute -top-0.5 h-2.5 w-px bg-slate-400" style={{left:min+'%'}}/></div>
</div>;
/** Kurzfassung eines Schritts aus seiner Zusammenfassung */
function stepNote(s:Step){
 const x=s.summary||{};
 if(x.skipped)return 'ausgelassen ('+x.skipped+')';
 if(!s.ok)return 'Fehler';
 if(isStep(s.name,'model')&&typeof x.done==='number')return n(x.done)+' Berichte eingeordnet, '+n(Number(x.embedded)||0)+' Texte eingebettet'+(x.msPerText?' ('+x.msPerText+' ms je Text)':'')+(x.statusSet?', Status in '+n(Number(x.statusSet))+' Berichten':'');
 if(isStep(s.name,'rules')&&typeof x.read==='number')return n(x.read)+' Berichte neu gelesen, davon '+n(Number(x.withText)||0)+' mit Text, '+n(Number(x.summaries)||0)+' mit Zusammenfassung'+(x.noModel?', '+n(Number(x.noModel))+' noch ohne Modell':'');
 if(isStep(s.name,'xcases')&&typeof x.cases==='number')return n(x.cases)+' Vorgänge'+(x.unread?', davon '+n(Number(x.unread))+' ungelesen':'');
 return 'fertig';
}
const THEME_NAME:Record<string,string>={...Object.fromEntries(THEMES.map((t:{id:string;name:string})=>[t.id,t.name])),unklar:'Sonstiges'};
const FACT_ROWS=(QUALITY.groups.find(g=>g.id==='facts')?.rows??[]) as FactRow[];
const ALL_RULE_ROWS=QUALITY.groups.flatMap(g=>g.rows as unknown as FactRow[]);
/* Regeln, die neben dem Modell weiter laufen (ohne die Werte der Karte, die stehen darunter), mit Grund */
const KEPT_RULES:{id:string;name:string;why:string}[]=[
 {id:'summary',name:'Zusammenfassung',why:'Sätze aus dem Hauptdokument, das das Modell wählt. Bleibt Regel, bis es eine gelernte Fassung mit markierten Kernsätzen gibt.'},
 {id:'member',name:'Mitgliedsgemeinde',why:'Schlägt Gemeindenamen im Katalog nach (Gremium, „der Gemeinde X“), ordnet nichts ein.'},
 {id:'faction',name:'Partei des Antragstellers (Fraktionsprofil)',why:'Liest den Namen in „Antrag der …-Fraktion“ (ein Wert aus dem Text). Läuft nur, wenn das Modell einen Antrag aus der Politik mit Antragsteller Fraktion erkennt.'},
 {id:'outcome',name:'Ausgang im Newsradar',why:'Liest aus den Ergebnistexten der Sitzungen, wie abgestimmt wurde (einstimmig, mit Mehrheit, abgelehnt). Der Status selbst kommt vom Modell.'},
 {id:'doc_type',name:'Dokumentart beim ersten Laden der PDFs',why:'Erste Schätzung für die Ablage, solange es noch keinen Text gibt. Sobald das Modell den Bericht eingeordnet hat, bewertet die Ablage mit dessen Dokumentart und Art des Punkts.'},
 {id:'plan',name:'Planname im Atlas',why:'Liest Planname und Nummer („Bebauungsplan Nr. 12“) aus dem Text. Der Verfahrensschritt kommt vom Modell, ebenso der Schritt der Wärmeplanung.'},
];
/* Werte für die Karte (Zahl je Gemeinde); Fraktion und Bausteine der früheren Signal-Regeln zeigt die Seite nicht mehr */
const VALUE_FACTS=new Set((MAP_FACTS as [string,string,boolean][]).map(([k])=>k).filter(k=>!MODEL_COVERED.has(k)));
const ON_MAP=new Set((MAP_FACTS as [string,string,boolean][]).filter(([,,on])=>on).map(([k])=>k));
const MQ=MODEL_QUALITY.quality as Record<string,Q>;

export function AdminRuleTexts(){
 const [data,setData]=useState<Summary|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{
  setBusy(true);setError('');
  try{const r=await fetch('/api/admin/summary',{cache:'no-store'});const d=await r.json() as Summary&{error?:string};if(!r.ok)throw Error(d.error||'Die Zahlen konnten nicht geladen werden.');setData(d);}
  catch(e){setError(e instanceof Error?e.message:'Die Zahlen konnten nicht geladen werden.');}
  finally{setBusy(false);}
 },[]);
 useEffect(()=>{const t=setTimeout(load,0);return ()=>clearTimeout(t);},[load]);
 /* Job „Themen & Texte“ (scripts/rule-texts.mjs) über die Zeitpläne: Stand, letzter Lauf, sofort starten */
 const [job,setJob]=useState<JobState|null>(null),[jobError,setJobError]=useState(''),[asking,setAsking]=useState(false);
 const loadJob=useCallback(async()=>{
  try{const r=await fetch('/api/admin/zeitplaene',{cache:'no-store'});const d=await r.json() as {jobs?:(JobState&{id:string})[];error?:string};if(!r.ok)throw Error(d.error||'Der Job konnte nicht geladen werden.');setJob(d.jobs?.find(j=>j.id==='rule-texts')||null);setJobError('');}
  catch(e){setJobError(e instanceof Error?e.message:'Der Job konnte nicht geladen werden.');}
 },[]);
 useEffect(()=>{const t=setTimeout(loadJob,0);return ()=>clearTimeout(t);},[loadJob]);
 const start=async(all=false)=>{
  if(!window.confirm(all?'Alle Berichte neu einordnen und Zusammenfassungen, Fakten und Wortliste neu erstellen? Das dauert deutlich länger als ein normaler Lauf; gespeicherte Einbettungen werden wiederverwendet.':'Modell anwenden, Zusammenfassungen, Fakten und Wortliste jetzt erstellen? Der Job startet sofort.'))return;
  setAsking(true);
  try{const r=await fetch('/api/admin/zeitplaene',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:all?'all':'now',id:'rule-texts'})});const d=await r.json() as {error?:string};if(!r.ok)throw Error(d.error||'Das ging nicht.');await loadJob();}
  catch(e){setJobError(e instanceof Error?e.message:'Das ging nicht.');}
  finally{setAsking(false);}
 };
 const running=!!job?.run?.running,requested=!!job?.now&&(!job.run?.lastStart||job.now>job.run.lastStart);
 useEffect(()=>{const t=setInterval(loadJob,running||requested?5000:60000);return ()=>clearInterval(t);},[loadJob,running,requested]);
 const c=data?.counts,ai=c?.aiSummaries??0,rule=c?.ruleSummaries??0,docs=c?.pdfArticles??0;
 const avg=rule?Math.round((c?.ruleScoreSum||0)/rule):undefined;
 const facts=job?.last?.facts;
 /* Letzter Lauf des Modells (Schritt „Modell anwenden“, scripts/model/apply.mjs) */
 const ms=job?.last?.steps.find(st=>isStep(st.name,'model'))?.summary as {done?:number;total?:number;todo?:number;subject?:number;withTheme?:number;sure?:{kind:number;status:number;process:number};statusSet?:number;msPerText?:number;version?:string}|undefined;
 const xs=job?.last?.steps.find(st=>isStep(st.name,'xcases'))?.summary as {themes?:Record<string,number>;subs?:Record<string,number>;facts?:Record<string,number>;factPlaces?:{total:number;places:Record<string,number>}}|undefined;
 const themeRows=xs?.themes?Object.entries(xs.themes).sort((a,b)=>b[1]-a[1]):[];
 const themeTotal=themeRows.reduce((a,[,v])=>a+v,0);
 const subsOf=(theme:string)=>SUBTOPICS.filter((u:{theme:string})=>u.theme===theme).map((u:{id:string;name:string})=>({name:u.name,n:xs?.subs?.[u.id]||0})).sort((a:{n:number},b:{n:number})=>b.n-a.n);
 const run=[
  {label:'Eingeordnet im letzten Lauf',value:ms?.done!==undefined?n(ms.done):job?'–':undefined,note:ms?.total!==undefined?'von '+n(ms.total)+' aktiven Berichten neu oder geändert'+(ms.msPerText?'; '+ms.msPerText+' ms je eingebettetem Text':''):'nach dem nächsten Lauf'},
  {label:'Sicher eingeordnet',value:ms?.done?pct(ms.sure?.kind||0,ms.done):undefined,note:ms?.done?'Art; Status '+pct(ms.sure?.status||0,ms.done)+(ms.subject?', Vorgangsart '+pct(ms.sure?.process||0,ms.subject)+' der Sachpunkte':''):'Anteil der Antworten ab 0,7'},
  {label:'Sachpunkte mit Thema',value:ms?.subject?pct(ms.withTheme||0,ms.subject):undefined,note:ms?.subject?n(ms.subject)+' Sachpunkte; ohne Thema heißt in der Suche „Sonstiges“':'nach dem nächsten Lauf'},
 ];
 const sum=[
  {label:'Im Artikel steht',value:c?pct(ai+rule,docs):undefined,note:c?'eine Zusammenfassung, bei '+n(docs)+' Artikeln mit Dokument: '+n(rule)+' regelbasiert, '+n(ai)+' von der KI':undefined},
  {label:'Ø Güte der regelbasierten Texte',value:c?(avg===undefined?'–':avg):undefined,of:avg===undefined?undefined:'von 100',note:c?(rule?'Mittel über '+n(rule)+' Artikel':'Noch keine gespeichert'):undefined},
  {label:'Berichte mit Fakten',value:facts?n(facts.reports):job?'–':undefined,note:facts?n(facts.fromText)+' aus dem Text des Hauptdokuments; Fassung '+facts.version:'nach dem nächsten Lauf'},
 ];
 const factRows=FACT_ROWS.filter(r=>VALUE_FACTS.has(r.id));
 /* Fenster mit allen Antworten der angeklickten Frage */
 const [shown,setShown]=useState<typeof QUESTIONS[number]|null>(null);
 return <>
  <AdminPageHead page="regeltexte"><StandLine stand={data?.stand} busy={busy} action="Aktualisieren" onAction={load}/></AdminPageHead>
  {error&&<Alert onRetry={load}>{error}</Alert>}
  <section id="regeltexte-modell" className="admin-section">
   <div className="admin-section-heading"><h2>Modell</h2></div>
   <p className="admin-note">Das Modell ordnet jeden Bericht ein: worum es geht, was für ein Vorgang es ist und wie er ausgegangen ist. Es läuft auf unserem Server, ohne fremden Dienst, und hat die früheren Regeln für Art, Thema, „Was geschieht“, Dokumente und Signale abgelöst. Zusammenfassung und Fakten bleiben Regeln.</p>
   <h3 className="mt-6">So arbeitet es</h3>
   <ol className="m-0 mt-2 list-none space-y-3 p-0 text-[14px] text-slate-700">
    <li><span className="font-medium text-slate-900">1. Lesen.</span> Je Bericht der Titel mit Gremium, die Ergebnisse der Sitzungen und von jedem PDF der Name, die erste Seite und der Beschlussvorschlag. Den übrigen Text liest es nicht.</li>
    <li><span className="font-medium text-slate-900">2. Verstehen.</span> Ein Sprachmodell (multilingual-e5-small, mit unseren Beispielen nachtrainiert) macht aus jedem Text eine Reihe von 384 Zahlen, die seine Bedeutung beschreiben: „Kläranlage sanieren“ und „Erneuerung des Klärwerks“ liegen nah beieinander, auch ohne gemeinsames Wort.</li>
    <li><span className="font-medium text-slate-900">3. Entscheiden.</span> Für jede Frage ein kleiner Entscheider („Kopf“), gelernt an rund 5.000 Berichten, die nach dem Begriffsbuch eingeordnet sind. Er nutzt die Zahlen und die Wörter selbst und gibt zu jeder Antwort an, wie sicher er ist. Ab 0,7 gilt die Antwort als sicher; ein unsicheres Thema bleibt offen („Sonstiges“), statt geraten zu werden.</li>
   </ol>
   <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-[14px] leading-snug text-slate-700"><span className="font-medium text-slate-900">Beispiel:</span> „Bebauungsplan Nr. 12 ‚Am Bach‘ – Satzungsbeschluss“ im Rat → Sachpunkt · Bauen &amp; Wohnen, Bauleitplanung, Wohnen · Planung und Regelung · Schritt Beschluss · konkretes Vorhaben · Hauptdokument die Vorlage. Daraus folgen Suche, Kartenthema, Signal „Neue Wohnbaugebiete“ und der Stand im Atlas.</p>
   <p className="admin-note mt-3">Was jede Antwort genau bedeutet, steht im Begriffsbuch (requirements/begriffsbuch-kern.md), Aufbau und Messung im Konzept (requirements/modell-konzept.md). Neue Kategorien entstehen dort und mit neuen Beispielen, nicht durch Einzelregeln.</p>
   <h3 className="mt-6">Wie gut es ist</h3>
   <p className="mt-3 text-[14px] text-slate-700">Encoder <span className="font-medium text-slate-900">{MANIFEST.encoder.version}</span> · Köpfe <span className="font-medium text-slate-900">{MANIFEST.heads.version}</span> · gelernt {shortDate(MANIFEST.heads.trainedAt)} · gemessen {shortDate(MODEL_QUALITY.measuredAt)}</p>
   <p className="admin-note mt-1">Ein Klick auf den Namen einer Frage zeigt alle möglichen Antworten. Genauigkeit: so oft stimmt die Antwort. Abdeckung (bei Listen wie Thema): so oft findet es das Richtige überhaupt. Sicher: Anteil der Antworten ab 0,7 und wie oft diese stimmen. Gemessen an {MODEL_QUALITY.sample}, die das Modell beim Lernen nicht gesehen hat. {MODEL_QUALITY.note} Ziel {GOAL} %.</p>
   <ul className="m-0 mt-4 list-none divide-y divide-slate-200 border-y border-slate-200 p-0">{QUESTIONS.map(qn=>{const q=MQ[qn.key];return <li key={qn.key} className="grid gap-x-6 gap-y-2 py-3 text-[14px] md:grid-cols-[minmax(0,1fr)_150px_150px]">
    <div className="min-w-0">
     <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={()=>setShown(qn)} title="Alle möglichen Antworten zeigen" className="font-medium text-slate-900 underline decoration-slate-300 decoration-dotted underline-offset-4 hover:text-teal-700 hover:decoration-teal-600">{qn.name}</button><Info text={qn.what}/></div>
     <small className="mt-1 block text-[12px] leading-snug text-slate-500">{q?n(q.n)+' Prüffälle':'nicht gemessen'}{qn.sure&&q?.sureShare!=null?' · sicher bei '+q.sureShare+' %, dann '+q.sureAcc+' % richtig':''}{q&&q.n<60?' · zu wenige Prüffälle für eine belastbare Zahl':''}</small>
    </div>
    <Meter label="Genauigkeit" v={q?.acc} min={GOAL}/>
    {qn.list?<Meter label="Abdeckung" v={q?.cov} min={QUALITY.target.coverage}/>:qn.sure?<Meter label="Sicher richtig" v={q?.sureAcc} min={GOAL}/>:<div/>}
   </li>;})}</ul>
  </section>
  <ValuesDialog q={shown} onClose={()=>setShown(null)}/>
  <section id="regeltexte-job" className="admin-section">
   <div className="admin-section-heading"><h2>Lauf</h2></div>
   <p className="admin-note">Nachts nach der PDF-Kette: Modell anwenden, Zusammenfassung und Fakten, Wortliste der Suche, Zahlen für plenara.X.</p>
   {jobError&&<Alert onRetry={loadJob}>{jobError}</Alert>}
   <ul className="m-0 mt-4 list-none space-y-1.5 p-0 text-[14px] text-slate-700">
    <li>{running?`Läuft seit ${when(job?.run?.running?.startedAt)}.`:requested?'Start angefordert …':job?.run?.lastStart?`Zuletzt ${when(job.run.lastStart)}${job.last?.all?' (alle neu)':''}, ${RESULT[job.run.result||'']||'–'}, ${dur(job.run.seconds)}.`:job?'Noch nicht gelaufen.':'–'}
     {job&&(job.setting.enabled?` Nächster Start ${when(job.next)} (täglich ${job.setting.time} Uhr, einstellbar unter Jobs & Zeitpläne).`:' Zeitplan ausgeschaltet (Jobs & Zeitpläne).')}</li>
    {job?.last?.steps.map(st=><li key={st.name}><span className="text-slate-500">{st.name}: </span>{stepNote(st)}, {dur(st.seconds)}</li>)}
   </ul>
   <div className="mt-6"><Kpis label="Kennzahlen des letzten Laufs" items={run}/></div>
   <button type="button" className="mt-4 inline-flex h-10 items-center rounded-full bg-teal-700 px-5 text-[14px] font-medium text-white hover:bg-teal-800 disabled:opacity-40" disabled={!job||running||requested||asking} onClick={()=>start()}>Jetzt erstellen →</button>
   <button type="button" className="ml-3 mt-4 inline-flex h-10 items-center rounded-full px-5 text-[14px] font-medium text-teal-600 hover:text-teal-700 disabled:opacity-40" disabled={!job||running||requested||asking} onClick={()=>start(true)}>Alle neu erstellen →</button>
   <p className="mt-2 text-[12px] text-slate-500">„Jetzt erstellen“: nur neue und geänderte Berichte. „Alle neu erstellen“: alle Berichte, etwa nach einem neuen Modell.{job?.all&&requested?' Neu erstellen angefordert.':''}</p>
  </section>
  <section id="regeltexte-themen" className="admin-section">
   <div className="admin-section-heading"><h2>Themen</h2></div>
   <p className="admin-note">Anteil der Sachvorgänge je Thema (Ablauf und Personalien zählen nicht), darunter die Unterthemen; ein Vorgang kann mehrere Unterthemen haben. Gezählt am Ende jedes Laufs{job?.last?.finishedAt?', zuletzt '+when(job.last.finishedAt):''}.</p>
   {!themeRows.length?<p className="admin-empty">Nach dem nächsten Lauf von „Themen & Texte“.</p>:<div className="mt-4">{themeRows.map(([id,v])=><div key={id} className="admin-bar-row">
    <div><span>{THEME_NAME[id]||id}</span><span>{pct(v,themeTotal)} · {n(v)}</span></div>
    <div className="admin-bar"><span style={{width:(100*v/themeTotal)+'%'}}/></div>
    {id!=='unklar'&&<small className="mt-1 block text-[12px] text-slate-500">{subsOf(id).map((u:{name:string;n:number})=>u.name+' '+pct(u.n,v)).join(' · ')}</small>}
   </div>)}</div>}
  </section>
  <section id="regeltexte-regeln" className="admin-section">
   <div className="admin-section-heading"><h2>Regeln, die bleiben</h2></div>
   <p className="admin-note">Regeln lesen Werte aus dem Text oder schlagen nach; was eingeordnet wird, macht das Modell. Qualität aus der letzten ungesehenen Stichprobe (shared/rule-quality.json). Die abgelösten Regeln für Art, Thema, „Was geschieht“, Hauptdokument und Signale stehen noch im Code, laufen aber nicht mehr.</p>
   <ul className="m-0 mt-4 list-none divide-y divide-slate-200 border-y border-slate-200 p-0">{KEPT_RULES.map(k=>{const r=ALL_RULE_ROWS.find(x=>x.id===k.id);return <li key={k.id} className="grid gap-x-6 gap-y-2 py-3 text-[14px] md:grid-cols-[minmax(0,1fr)_150px_150px]">
    <div className="min-w-0">
     <div className="flex flex-wrap items-center gap-2"><span className="font-medium text-slate-900">{k.name}</span>{r?.what&&<Info text={r.what}/>}</div>
     <p className="m-0 mt-1 text-[14px] leading-snug text-slate-600">{k.why}</p>
     {r&&<small className="mt-1 block text-[12px] leading-snug text-slate-500">{[r.version,r.sample,shortDate(r.date)].filter(Boolean).join(' · ')}</small>}
    </div>
    <Meter label="Qualität" v={r?.quality} min={GOAL}/>
    <div/>
   </li>;})}</ul>
  </section>
  <section id="regeltexte-texte" className="admin-section">
   <div className="admin-section-heading"><h2>Zusammenfassung und Fakten</h2></div>
   <p className="admin-note">Regeln über dem Text des Hauptdokuments, das das Modell wählt. Ist eine KI-Zusammenfassung vorhanden, steht sie im Artikel; sonst die regelbasierte. Fakten sind an das Modell gebunden: ein Wert zählt nur bei passendem Unterthema (Hebesatz bei Steuern und Haushalt, Gebühren bei Wasser und Abwasser, Bebauungsplan bei Bauleitplanung und Erschließung; shared/model/fact-gate.mjs). So fallen Vergleichs- und Hintergrundwerte weg, etwa ein Bebauungsplan in einem Bauantrag.</p>
   <div className="mt-6"><Kpis label="Kennzahlen der Zusammenfassungen und Fakten" items={sum}/></div>
   <h3 className="mt-6">Werte für plenara.X Fakten</h3>
   <p className="admin-note mt-1">Qualität aus der letzten ungesehenen Stichprobe (shared/rule-quality.json); auf der Karte ab {GOAL} %.</p>
   <ul className="m-0 mt-2 list-none divide-y divide-slate-200 border-y border-slate-200 p-0">{factRows.map(r=><li key={r.id} className="grid gap-x-6 gap-y-2 py-3 text-[14px] md:grid-cols-[minmax(0,1fr)_150px_150px]">
    <div className="min-w-0">
     <div className="flex flex-wrap items-center gap-2"><span className="font-medium text-slate-900">{r.name}</span>{r.what&&<Info text={r.what}/>}
      <span className={'rounded-full px-2 py-0.5 text-[12px] '+(ON_MAP.has(r.id)?'bg-teal-50 text-teal-700':'bg-slate-100 text-slate-500')}>{ON_MAP.has(r.id)?'auf der Karte':r.quality==null?'nicht gemessen':r.quality<GOAL?'unter '+GOAL+' %':r.lock||'noch gesperrt'}</span></div>
     <small className="mt-1 block text-[12px] leading-snug text-slate-500">{[r.version,r.sample,shortDate(r.date),xs?.facts?.[r.id]!==undefined?n(xs.facts[r.id])+' Berichte':'',r.note].filter(Boolean).join(' · ')}</small>
    </div>
    <Meter label="Qualität" v={r.quality} min={GOAL}/>
    {xs?.factPlaces?<Meter label="Gemeinden" v={Math.round(1000*(xs.factPlaces.places[r.id]||0)/xs.factPlaces.total)/10} min={10}/>:<div/>}
   </li>)}</ul>
  </section>
 </>;
}
