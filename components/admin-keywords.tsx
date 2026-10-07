'use client';
import {AdminHeader} from '@/components/admin-chrome';
import {useEffect,useMemo,useState} from 'react';
import {RefreshCw} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {LABELS,labelName} from '@/shared/labels.mjs';
type Counted={term:string;articles:number};
type Keywords={asOf:string;articles:number;listLimit:number;
 rule:{labelled:number;withWords:number;formal:number;general:number;several:number;none:number;other:number;distinct:number;words:(Counted&{label:string})[]};
 titleTerms:{analysed:number;distinct:number;once:number;terms:Counted[];subjects:Counted[]};
 ai:{profiles:number;content:number;stale:number;distinct:number;once:number|null;cut:boolean;items:(Counted&{weight:number;contentArticles:number;contentWeight:number})[]}};
// metric orders the rows and sets the length of the bar; value is what is printed next to the term.
type Row={term:string;metric:number;value:string;tag?:string;color?:string;cells:string[]};
const TOP=50,PAGE=50;
const n=(v:number,digits=0)=>v.toLocaleString('de-DE',{maximumFractionDigits:digits,minimumFractionDigits:digits});
const pct=(a:number,b:number)=>b?n(100*a/b,a/b<.1?1:0)+' %':'–';
const date=(s:string)=>new Date(s).toLocaleString('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'short'});
const color=(label:string)=>LABELS.find(l=>l.id===label)?.color||'#777';
function Choice({id,label,value,onChange,items}:{id:string;label:string;value:string;onChange:(value:string)=>void;items:{id:string;name:string}[]}){return <div className="admin-field"><label id={id+'-label'}>{label}</label><Select value={value} onValueChange={onChange}><SelectTrigger aria-labelledby={id+'-label'}><SelectValue/></SelectTrigger><SelectContent position="popper">{items.map(item=><SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>}
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
  <div className="admin-field admin-terms-search"><label htmlFor={id+'-search'}>Begriff suchen</label><Input id={id+'-search'} type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="z. B. Schul"/></div>
  <p className="admin-note" role="status">{query.trim()?n(hits.length)+' von '+n(rows.length)+' Begriffen passen.':n(rows.length)+' Begriffe, häufigste zuerst.'}{note&&' '+note}</p>
  {hits.length?<table className="admin-terms-table"><thead><tr><th scope="col">#</th><th scope="col">Begriff</th>{headers.map(h=><th scope="col" key={h} className={h===headers[0]&&rows[0]?.tag?undefined:'admin-number'}>{h}</th>)}</tr></thead>
   <tbody>{hits.slice(0,shown).map(r=><tr key={r.term+'|'+(r.tag||'')}><td>{rows.indexOf(r)+1}</td><td>{r.term}</td>{r.tag&&<td><i style={{background:r.color}}/>{r.tag}</td>}{r.cells.map((c,i)=><td key={i} className="admin-number">{c}</td>)}</tr>)}</tbody></table>:<p className="admin-empty">Kein Begriff passt zu dieser Suche.</p>}
  {hits.length>shown&&<Button variant="outline" onClick={()=>setShown(s=>s+PAGE)}>Weitere {n(Math.min(PAGE,hits.length-shown))} anzeigen</Button>}
 </div>;
}
/** Admin page 4: keywords found by the rules and assigned by the AI. Reads only; nothing is started from here. */
export function AdminKeywords({displayName,signOutPath,initial}:{displayName:string;signOutPath:string;initial?:Keywords}){
 const [data,setData]=useState<Keywords|null>(initial||null),[error,setError]=useState(''),[busy,setBusy]=useState(!initial);
 const [label,setLabel]=useState('all'),[basis,setBasis]=useState('all'),[order,setOrder]=useState('articles');
 const load=(signal?:AbortSignal)=>{setBusy(true);setError('');
  fetch('/api/admin/keywords',{cache:'no-store',signal}).then(async r=>{const d=await r.json() as Keywords&{error?:string};if(!r.ok)throw Error(d.error||'Stichwörter konnten nicht geladen werden.');setData(d);}).catch(e=>{if(e.name!=='AbortError')setError(e instanceof Error?e.message:'Stichwörter konnten nicht geladen werden.');}).finally(()=>{if(!signal?.aborted)setBusy(false);});};
 useEffect(()=>{if(initial)return;const c=new AbortController();load(c.signal);return()=>c.abort();},[]);
 const ruleRows=useMemo<Row[]>(()=>(data?.rule.words||[]).filter(w=>label==='all'||w.label===label).map(w=>({term:w.term,metric:w.articles,value:n(w.articles),tag:labelName(w.label),color:color(w.label),cells:[n(w.articles)]})),[data,label]);
 const termRows=useMemo<Row[]>(()=>(data?.titleTerms.terms||[]).map(w=>({term:w.term,metric:w.articles,value:n(w.articles),cells:[n(w.articles)]})),[data]);
 const aiRows=useMemo<Row[]>(()=>(data?.ai.items||[]).map(i=>basis==='content'?{term:i.term,articles:i.contentArticles,weight:i.contentWeight}:basis==='title'?{term:i.term,articles:i.articles-i.contentArticles,weight:i.weight-i.contentWeight}:i).filter(i=>i.articles>0)
  .sort((a,b)=>order==='weight'?b.weight-a.weight||b.articles-a.articles:b.articles-a.articles||b.weight-a.weight)
  .map(i=>({term:i.term,metric:order==='weight'?i.weight:i.articles,value:order==='weight'?n(i.weight)+' Punkte':n(i.articles),cells:[n(i.articles),n(i.weight),n(i.weight/i.articles,1)]})),[data,basis,order]);
 const labels=useMemo(()=>[...new Set((data?.rule.words||[]).map(w=>w.label))].map(id=>({id,name:labelName(id)})).sort((a,b)=>a.name.localeCompare(b.name,'de')),[data]);
 const cut=(delivered:number,total:number)=>delivered<total?`Die Liste zeigt die ${n(delivered)} häufigsten von ${n(total)}.`:undefined;
 return <div className="admin-app"><AdminHeader page="stichwoerter" displayName={displayName} signOutPath={signOutPath}/><main id="inhalt" className="admin-shell admin-workspace">
  <div className="admin-heading"><div><p className="eyebrow">REGELN & KI</p><h1>Stichwörter.</h1><p>{displayName}{data&&<> · Datenbankstand {date(data.asOf)} Uhr</>}</p></div><Button className="admin-refresh" variant="outline" onClick={()=>load()} disabled={busy}><RefreshCw size={16} className={busy?'admin-spin':''}/>{busy?'Wird gezählt …':'Neu zählen'}</Button></div>
  {error&&<p className="admin-error" role="alert">{error}{data&&' Der letzte geladene Stand bleibt sichtbar.'}</p>}
  {!data?!error&&<p className="admin-empty" role="status">Stichwörter werden aus dem gespeicherten Bestand gezählt …</p>:<>
   <section className="admin-kpis" aria-label="Kennzahlen der Stichwörter">
    <div className="admin-kpi admin-kpi-primary"><span>Berichte im Bestand</span><strong>{n(data.articles)}</strong><small>Eigenständige Vorgänge</small></div>
    <a className="admin-kpi" href="#stichwoerter-regeln"><span>Erkannte Sachbegriffe</span><strong>{n(data.rule.distinct)}</strong><small>in {n(data.rule.withWords)} Berichten · Label-Regeln</small></a>
    <a className="admin-kpi" href="#stichwoerter-titel"><span>Titelbegriffe</span><strong>{n(data.titleTerms.distinct)}</strong><small>aus {n(data.titleTerms.analysed)} Berichten · Themenvergleich</small></a>
    <a className="admin-kpi" href="#stichwoerter-ki"><span>KI-Stichwörter</span><strong>{n(data.ai.distinct)}</strong><small>aus {n(data.ai.profiles)} Stichwortprofilen</small></a>
   </section>
   <p className="admin-note">Die Seite zählt, was frühere Schritte bei den Berichten gespeichert haben. Sie startet keine Analyse. Schreibweisen, die sich nur in Groß- und Kleinschreibung unterscheiden, sind zusammengefasst.</p>
   <section id="stichwoerter-regeln" className="admin-section">
    <p className="eyebrow">01 / REGELN · LABEL</p><h2>Welche Sachbegriffe haben die Regeln erkannt?</h2>
    <p className="admin-note">Die Label-Regeln suchen im Originaltitel nach festen Wortmustern. Entscheidet ein Muster über das Label, speichert die Regel die gefundenen Wörter beim Bericht. Gezählt ist, in wie vielen Berichten ein Wort so gespeichert ist. Muster treffen oft Wortteile, deshalb stehen hier auch Formen wie „Schul“. Treffer weiterer Sachgebiete im selben Titel speichert die Regel nicht.</p>
    <div className="admin-quality-stats admin-terms-stats"><div><strong>{n(data.rule.withWords)}</strong><span>mit erkanntem Sachbegriff ({pct(data.rule.withWords,data.rule.labelled)} der {n(data.rule.labelled)} Berichte mit Regel-Label)</span></div><div><strong>{n(data.rule.none)}</strong><span>ohne erkennbares Sachthema im Titel</span></div><div><strong>{n(data.rule.general+data.rule.formal)}</strong><span>allgemeine oder formale Punkte, ohne Sachbegriff eingeordnet</span></div><div><strong>{n(data.rule.several+data.rule.other)}</strong><span>mehrere mögliche Sachgebiete oder Sonderregel; Wörter nicht gespeichert</span></div></div>
    <div className="admin-source-controls"><Choice id="keywords-label" label="Sachgebiet" value={label} onChange={setLabel} items={[{id:'all',name:'Alle Sachgebiete'},...labels]}/></div>
    <div className="admin-terms-columns"><TopList rows={ruleRows} title={'Top '+Math.min(TOP,ruleRows.length)+' nach Berichten'}/><FullList id="keywords-rule" rows={ruleRows} title="Alle erkannten Sachbegriffe" headers={['Sachgebiet','Berichte']} note={label==='all'?cut(data.rule.words.length,data.rule.distinct):undefined}/></div>
   </section>
   <section id="stichwoerter-titel" className="admin-section">
    <p className="eyebrow">02 / REGELN · TITEL</p><h2>Welche Begriffe stehen in den Titeln?</h2>
    <p className="admin-note">Für den Themenvergleich zwischen Gebieten zerlegt eine zweite Regel jeden Titel in Begriffe: Wörter ab fünf Buchstaben ohne Füllwörter, in Kleinschreibung und mit gekürzter Endung (aus „Anregungen“ wird „anreg“). {n(data.titleTerms.once)} der {n(data.titleTerms.distinct)} Begriffe kommen nur in einem Bericht vor. Bisher sind {n(data.titleTerms.analysed)} von {n(data.articles)} Berichten so ausgewertet.</p>
    <div className="admin-terms-columns"><TopList rows={termRows} title={'Top '+Math.min(TOP,termRows.length)+' nach Berichten'}/><FullList id="keywords-terms" rows={termRows} title="Alle Titelbegriffe" headers={['Berichte']} note={cut(data.titleTerms.terms.length,data.titleTerms.distinct)}/></div>
    {data.titleTerms.subjects.length>0&&<><h3>Feste Sachthemen</h3><p className="admin-note">Dieselbe Regel erkennt außerdem einige fest benannte Sachthemen. Sie verbinden Berichte verschiedener Gebiete zum selben Thema.</p><ul className="admin-terms-chips">{data.titleTerms.subjects.map(s=><li key={s.term}>{s.term} <strong>{n(s.articles)}</strong></li>)}</ul></>}
   </section>
   <section id="stichwoerter-ki" className="admin-section">
    <p className="eyebrow">03 / KI</p><h2>Welche Stichwörter vergibt die KI?</h2>
    <p className="admin-note">Ein KI-Agent vergibt je Bericht gewichtete Stichwörter; die Gewichte eines Berichts ergeben zusammen 100. Aus dem gelesenen Inhalt sind es zehn Stichwörter je Bericht, im früheren Titeltest oft weniger. Die Gewichtssumme eines Stichworts ist die Summe seiner Gewichte über alle Berichte. Von {n(data.ai.profiles)} aktuellen Profilen stammen {n(data.ai.content)} aus dem gelesenen Inhalt und {n(data.ai.profiles-data.ai.content)} aus dem früheren Test mit dem Originaltitel.{data.ai.stale>0&&` ${n(data.ai.stale)} veraltete Profile (Titel seither geändert) sind nicht gezählt.`}{data.ai.once!==null&&` ${n(data.ai.once)} der ${n(data.ai.distinct)} Stichwörter kommen nur in einem Bericht vor.`}</p>
    <div className="admin-source-controls"><Choice id="keywords-basis" label="Grundlage" value={basis} onChange={setBasis} items={[{id:'all',name:'Alle Profile'},{id:'content',name:'Nur aus dem Inhalt'},{id:'title',name:'Nur aus dem Titeltest'}]}/><Choice id="keywords-order" label="Reihenfolge" value={order} onChange={setOrder} items={[{id:'articles',name:'Nach Zahl der Berichte'},{id:'weight',name:'Nach Gewichtssumme'}]}/></div>
    <div className="admin-terms-columns"><TopList rows={aiRows} title={'Top '+Math.min(TOP,aiRows.length)+(order==='weight'?' nach Gewichtssumme':' nach Berichten')}/><FullList id="keywords-ai" rows={aiRows} title="Alle KI-Stichwörter" headers={['Berichte','Gewichtssumme','Ø Gewicht']} note={basis==='all'?cut(data.ai.items.length,data.ai.distinct):undefined}/></div>
   </section>
  </>}
  <footer className="admin-footer">Die Übersicht liest nur den gespeicherten Bestand. <a href="/admin?seite=abruf">Regel-Labels und KI-Aufträge starten: Daten & Verarbeitung →</a></footer>
 </main></div>;
}
