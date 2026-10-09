'use client';
import {useEffect,useMemo,useState} from 'react';
import {AdminChoice,AdminPageHead,Alert,How,Kpis,PageSkeleton,SectionHelp,StandLine} from '@/components/admin-ui';
import {HELP,STAND_TEXT,STICHWOERTER_NOTES,TITLES,ZUSTAND} from '@/components/admin-texts';
import type {Stand} from '@/shared/admin-types';
import {LABELS,labelName} from '@/shared/labels.mjs';
type Counted={term:string;articles:number};
type Stored={stand?:Stand;computed?:boolean};
type Keywords=Stored&{asOf:string;articles:number;listLimit:number;
 rule:{labelled:number;withWords:number;formal:number;general:number;several:number;none:number;other:number;distinct:number;words:(Counted&{label:string})[]};
 titleTerms:{analysed:number;distinct:number;once:number;terms:Counted[];subjects:Counted[]};
 ai:{profiles:number;content:number;stale:number;distinct:number;once:number|null;cut:boolean;items:(Counted&{weight:number;contentArticles:number;contentWeight:number})[]}};
// metric orders the rows and sets the length of the bar; value is what is printed next to the term.
type Row={term:string;metric:number;value:string;tag?:string;color?:string;cells:string[]};
// A failed connection (the server restarts, the computer sleeps) is tried again for two minutes; the state of the build is kept
// on the server, so counting continues where it stopped.
async function withRetry<T>(call:()=>Promise<T>,onWait?:(waiting:boolean)=>void):Promise<T>{
 for(let attempt=0;;attempt++){
  try{const result=await call();onWait?.(false);return result;}
  catch(e){if(!(e instanceof TypeError)||attempt>=24)throw e;onWait?.(true);await new Promise(r=>setTimeout(r,5000));}
 }
}
const TOP=50,PAGE=50;
const n=(v:number,digits=0)=>v.toLocaleString('de-DE',{maximumFractionDigits:digits,minimumFractionDigits:digits});
const pct=(a:number,b:number)=>b?n(100*a/b,a/b<.1?1:0)+' %':'–';
const color=(label:string)=>LABELS.find(l=>l.id===label)?.color||'#94a3b8';
/** The fifty most frequent terms as a ranked bar list. */
function TopList({rows,title}:{rows:Row[];title:string}){
 const top=rows.slice(0,TOP),max=top[0]?.metric||1;
 return <div><h3>{title}</h3>{top.length?<ol className="admin-terms">{top.map((r,i)=><li className="admin-bar-row" key={r.term+'|'+(r.tag||'')}><div><span><b>{i+1}</b>{r.term}{r.tag&&<small><i style={{background:r.color}}/>{r.tag}</small>}</span><span>{r.value}</span></div><div className="admin-bar" aria-hidden="true"><span style={{width:100*r.metric/max+'%'}}/></div></li>)}</ol>:<p className="admin-empty">Noch keine Begriffe gespeichert.</p>}</div>;
}
/** Every delivered term, searchable, fifty per step. */
function FullList({id,rows,title,headers,note}:{id:string;rows:Row[];title:string;headers:string[];note?:string}){
 const [query,setQuery]=useState(''),[shown,setShown]=useState(PAGE);
 const hits=useMemo(()=>{const q=query.trim().toLocaleLowerCase('de-DE');return q?rows.filter(r=>r.term.toLocaleLowerCase('de-DE').includes(q)||r.tag?.toLocaleLowerCase('de-DE').includes(q)):rows;},[rows,query]);
 useEffect(()=>setShown(PAGE),[query,rows]);
 return <div><h3>{title}</h3>
  <div className="mt-4 max-w-[420px]"><label htmlFor={id+'-search'} className="field-label mb-1 block">Begriff suchen</label><input id={id+'-search'} type="search" className="field-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="z. B. Schul"/></div>
  <p className="admin-note" role="status">{query.trim()?n(hits.length)+' von '+n(rows.length)+' Begriffen passen.':n(rows.length)+' Begriffe, häufigste zuerst.'}{note&&' '+note}</p>
  {hits.length?<table className="admin-terms-table"><thead><tr><th scope="col">#</th><th scope="col">Begriff</th>{headers.map(h=><th scope="col" key={h} title={h==='Ø Gewicht'?TITLES.gewicht:undefined} className={h===headers[0]&&rows[0]?.tag?undefined:'admin-number'}>{h}</th>)}</tr></thead>
   <tbody>{hits.slice(0,shown).map(r=><tr key={r.term+'|'+(r.tag||'')}><td>{rows.indexOf(r)+1}</td><td>{r.term}</td>{r.tag&&<td><i style={{background:r.color}}/>{r.tag}</td>}{r.cells.map((c,i)=><td key={i} className="admin-number">{c}</td>)}</tr>)}</tbody></table>:<p className="admin-empty">Kein Begriff passt zu dieser Suche.</p>}
  {hits.length>shown&&<button type="button" className="btn-secondary btn-sm mt-3" onClick={()=>setShown(s=>s+PAGE)}>Weitere {n(Math.min(PAGE,hits.length-shown))} anzeigen</button>}
 </div>;
}
/** Admin page 4: keywords found by the rules and assigned by the AI. Reads only; nothing is started from here. */
export function AdminKeywords({initial}:{displayName?:string;signOutPath?:string;initial?:Keywords}){
 const [data,setData]=useState<Keywords|null>(initial||null),[stored,setStored]=useState<Stored|null>(initial||null),[error,setError]=useState(''),[busy,setBusy]=useState(!initial);
 const [counting,setCounting]=useState<{done:number;total:number}|null>(null),[waiting,setWaiting]=useState('');
 const [label,setLabel]=useState('all'),[basis,setBasis]=useState('all'),[order,setOrder]=useState('articles');
 // The page shows the keywords as last counted (stored); "Neu zählen" counts them anew in steps of a few seconds
 // (POST /api/admin/refresh, target keywords) and keeps the old count visible meanwhile.
 const load=(signal?:AbortSignal)=>{setBusy(true);setError('');
  fetch('/api/admin/keywords',{cache:'no-cache',signal}).then(async r=>{const d=await r.json() as Keywords&{error?:string};if(!r.ok)throw Error(d.error||'Stichwörter konnten nicht geladen werden.');setStored(d);if(d.computed!==false)setData(d);}).catch(e=>{if(e.name!=='AbortError')setError(e instanceof Error?e.message:'Stichwörter konnten nicht geladen werden.');}).finally(()=>{if(!signal?.aborted)setBusy(false);});};
 useEffect(()=>{if(initial)return;const c=new AbortController();load(c.signal);return()=>c.abort();},[]);
 const count=async()=>{
  if(counting)return;setError('');setCounting({done:0,total:0});
  const post=(action:string)=>withRetry(()=>fetch('/api/admin/refresh',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,target:'keywords'})}),w=>{if(w)setWaiting('server');else setWaiting(s=>s==='server'?'':s);}).then(async r=>{const d=await r.json() as {state:string;done:number;total:number;reason?:string;error?:string};if(!r.ok)throw Error(d.error||'Das Zählen ist fehlgeschlagen.');return d;});
  try{
   let step=await post('start');
   for(;;){setCounting({done:step.done,total:step.total});setWaiting(step.reason==='job'?'job':'');if(step.state==='done')break;if(step.state==='busy')await new Promise(r=>setTimeout(r,step.reason==='job'?5000:3000));step=await post('step');}
   load();
  }catch(e){setError((e instanceof Error?e.message:'Das Zählen ist fehlgeschlagen.')+' Angezeigt bleibt der letzte gespeicherte Stand.');}
  finally{setCounting(null);setWaiting('');}
 };
 const stand:Stand|null|undefined=stored?{...(stored.stand as Stand),...(counting?{build:{target:'keywords',state:'running' as const,done:counting.done,total:counting.total,startedAt:''}}:{})}:busy?undefined:null;
 const ruleRows=useMemo<Row[]>(()=>(data?.rule.words||[]).filter(w=>label==='all'||w.label===label).map(w=>({term:w.term,metric:w.articles,value:n(w.articles),tag:labelName(w.label),color:color(w.label),cells:[n(w.articles)]})),[data,label]);
 const termRows=useMemo<Row[]>(()=>(data?.titleTerms.terms||[]).map(w=>({term:w.term,metric:w.articles,value:n(w.articles),cells:[n(w.articles)]})),[data]);
 const aiRows=useMemo<Row[]>(()=>(data?.ai.items||[]).map(i=>basis==='content'?{term:i.term,articles:i.contentArticles,weight:i.contentWeight}:basis==='title'?{term:i.term,articles:i.articles-i.contentArticles,weight:i.weight-i.contentWeight}:i).filter(i=>i.articles>0)
  .sort((a,b)=>order==='weight'?b.weight-a.weight||b.articles-a.articles:b.articles-a.articles||b.weight-a.weight)
  .map(i=>({term:i.term,metric:order==='weight'?i.weight:i.articles,value:order==='weight'?n(i.weight)+' Punkte':n(i.articles),cells:[n(i.articles),n(i.weight),n(i.weight/i.articles,1)]})),[data,basis,order]);
 const labels=useMemo(()=>[...new Set((data?.rule.words||[]).map(w=>w.label))].map(id=>[id,labelName(id)] as [string,string]).sort((a,b)=>a[1].localeCompare(b[1],'de')),[data]);
 const cut=(delivered:number,total:number)=>delivered<total?`Die Liste zeigt die ${n(delivered)} häufigsten von ${n(total)}.`:undefined;
 const ctl='mt-5 grid max-w-[640px] gap-4 sm:grid-cols-2';
 const kpis=data?[
  {label:'Berichte im Bestand',value:n(data.articles),note:STICHWOERTER_NOTES.berichte},
  {label:'Erkannte Sachbegriffe',value:n(data.rule.distinct),note:STICHWOERTER_NOTES.sachbegriffe(n(data.rule.withWords))},
  {label:'Titelbegriffe',value:n(data.titleTerms.distinct),note:STICHWOERTER_NOTES.titelbegriffe(n(data.titleTerms.analysed))},
  {label:'KI-Stichwörter',value:n(data.ai.distinct),note:STICHWOERTER_NOTES.ki(n(data.ai.profiles))},
 ]:['Berichte im Bestand','Erkannte Sachbegriffe','Titelbegriffe','KI-Stichwörter'].map(label=>({label,value:undefined}));
 const notCounted=!data&&!!stored&&stored.computed===false;
 return <>
  <AdminPageHead page="stichwoerter"><StandLine stand={stand} busy={!!counting} action="Neu zählen" onAction={count} hint="Liest alle Berichte; kann einige Minuten dauern."/>{waiting&&<p role="status" className="mt-2 text-[14px] text-slate-500">{waiting==='job'?'Das Zählen wartet, bis der laufende Abruf fertig ist; der Stand bleibt erhalten.':'Der Server antwortet gerade nicht. Das Zählen versucht es gleich noch einmal und macht danach dort weiter, wo es war.'}</p>}</AdminPageHead>
  {error&&<Alert onRetry={!stored?()=>load():undefined}>{!stored?ZUSTAND.fehler+' ('+error+')':<>{error}{data&&' Der letzte geladene Stand bleibt sichtbar.'}</>}</Alert>}
  {!data?notCounted?<div className="admin-empty mt-8" role="status"><p>{STAND_TEXT.stichwoerterOhneStand}</p><p className="mt-5"><button type="button" className="btn-primary" disabled={!!counting} onClick={count}>{counting?'Wird gezählt …':STAND_TEXT.jetztBerechnen}</button></p></div>:<>
   <div className="mt-8"><Kpis label="Kennzahlen der Stichwörter" items={kpis}/></div>
   <PageSkeleton sections={[['stichwoerter.regeln',420],['stichwoerter.titel',420],['stichwoerter.ki',420]]}/>
  </>:<div className={counting?'opacity-60 transition-opacity':undefined}>
   <div className="mt-8"><Kpis label="Kennzahlen der Stichwörter" items={kpis}/></div>
   <p className="mt-4 max-w-[820px] text-[14px] text-slate-500">Schreibweisen, die sich nur in Groß- und Kleinschreibung unterscheiden, sind zusammengefasst.</p>
   <section id="stichwoerter-regeln" className="admin-section">
    <div className="admin-section-heading"><h2>{HELP['stichwoerter.regeln'].title}</h2></div>
    <SectionHelp id="stichwoerter.regeln"/>
    <How><p>Die Regeln für Sachgebiete suchen im Originaltitel nach festen Wortmustern. Entscheidet ein Muster über das Sachgebiet, speichert die Regel die gefundenen Wörter beim Bericht. Gezählt ist, in wie vielen Berichten ein Wort so gespeichert ist. Muster treffen oft Wortteile, deshalb stehen hier auch Formen wie „Schul“. Treffer weiterer Sachgebiete im selben Titel speichert die Regel nicht.</p></How>
    <div className="admin-quality-stats admin-terms-stats"><div><strong>{n(data.rule.withWords)}</strong><span>mit erkanntem Sachbegriff ({pct(data.rule.withWords,data.rule.labelled)} der {n(data.rule.labelled)} Berichte mit Sachgebiet nach Regeln)</span></div><div><strong>{n(data.rule.none)}</strong><span>ohne erkennbares Sachthema im Titel</span></div><div><strong>{n(data.rule.general+data.rule.formal)}</strong><span>allgemeine oder formale Punkte, ohne Sachbegriff eingeordnet</span></div><div><strong>{n(data.rule.several+data.rule.other)}</strong><span>mehrere mögliche Sachgebiete oder Sonderregel; Wörter nicht gespeichert</span></div></div>
    <div className={ctl}><AdminChoice id="keywords-label" label="Sachgebiet" value={label} onChange={setLabel} items={[['all','Alle Sachgebiete'],...labels]}/></div>
    <div className="admin-terms-columns"><TopList rows={ruleRows} title={'Top '+Math.min(TOP,ruleRows.length)+' nach Berichten'}/><FullList id="keywords-rule" rows={ruleRows} title="Alle erkannten Sachbegriffe" headers={['Sachgebiet','Berichte']} note={label==='all'?cut(data.rule.words.length,data.rule.distinct):undefined}/></div>
   </section>
   <section id="stichwoerter-titel" className="admin-section">
    <div className="admin-section-heading"><h2>{HELP['stichwoerter.titel'].title}</h2></div>
    <SectionHelp id="stichwoerter.titel"/>
    <How><p>Für den Themenvergleich zwischen Gebieten zerlegt eine zweite Regel jeden Titel in Begriffe: Wörter ab fünf Buchstaben ohne Füllwörter, in Kleinschreibung und mit gekürzter Endung (aus „Anregungen“ wird „anreg“). {n(data.titleTerms.once)} der {n(data.titleTerms.distinct)} Begriffe kommen nur in einem Bericht vor. Bisher sind {n(data.titleTerms.analysed)} von {n(data.articles)} Berichten so ausgewertet.</p></How>
    <div className="admin-terms-columns"><TopList rows={termRows} title={'Top '+Math.min(TOP,termRows.length)+' nach Berichten'}/><FullList id="keywords-terms" rows={termRows} title="Alle Titelbegriffe" headers={['Berichte']} note={cut(data.titleTerms.terms.length,data.titleTerms.distinct)}/></div>
    {data.titleTerms.subjects.length>0&&<><h3>Feste Sachthemen</h3><p className="admin-note">Dieselbe Regel erkennt außerdem einige fest benannte Sachthemen. Sie verbinden Berichte verschiedener Gebiete zum selben Thema.</p><ul className="admin-terms-chips">{data.titleTerms.subjects.map(s=><li key={s.term}>{s.term} <strong>{n(s.articles)}</strong></li>)}</ul></>}
   </section>
   <section id="stichwoerter-ki" className="admin-section">
    <div className="admin-section-heading"><h2>{HELP['stichwoerter.ki'].title}</h2></div>
    <SectionHelp id="stichwoerter.ki"/>
    <How><p>Ein KI-Agent vergibt je Bericht gewichtete Stichwörter; die Gewichte eines Berichts ergeben zusammen 100. Aus dem gelesenen Inhalt sind es zehn Stichwörter je Bericht, im früheren Titeltest oft weniger. Die Gewichtssumme eines Stichworts ist die Summe seiner Gewichte über alle Berichte. Von {n(data.ai.profiles)} aktuellen Profilen stammen {n(data.ai.content)} aus dem gelesenen Inhalt und {n(data.ai.profiles-data.ai.content)} aus dem früheren Test mit dem Originaltitel.{data.ai.stale>0&&` ${n(data.ai.stale)} veraltete Profile (Titel seither geändert) sind nicht gezählt.`}{data.ai.once!==null&&` ${n(data.ai.once)} der ${n(data.ai.distinct)} Stichwörter kommen nur in einem Bericht vor.`}</p></How>
    <div className={ctl}><AdminChoice id="keywords-basis" label="Grundlage" value={basis} onChange={setBasis} items={[['all','Alle Profile'],['content','Nur aus dem Inhalt'],['title','Nur aus dem Titeltest']]}/><AdminChoice id="keywords-order" label="Reihenfolge" value={order} onChange={setOrder} items={[['articles','Nach Zahl der Berichte'],['weight','Nach Gewichtssumme']]}/></div>
    <div className="admin-terms-columns"><TopList rows={aiRows} title={'Top '+Math.min(TOP,aiRows.length)+(order==='weight'?' nach Gewichtssumme':' nach Berichten')}/><FullList id="keywords-ai" rows={aiRows} title="Alle KI-Stichwörter" headers={['Berichte','Gewichtssumme','Ø Gewicht']} note={basis==='all'?cut(data.ai.items.length,data.ai.distinct):undefined}/></div>
   </section>
  </div>}
 </>;
}
