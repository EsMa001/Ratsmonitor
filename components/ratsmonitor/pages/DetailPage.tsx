import {useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import type {TopicDetail} from '@/shared/types';
import {STATUS,formatDate} from '@/shared/types';
import {REGIONS} from '@/shared/regions';
import {ArticleAnalysis,SessionDetails} from '@/components/article-analysis';
import {IconChevronLeft} from '../components/icons';
import {useAppNav} from '../state/nav';
export function DetailPage(){
 const params=useParams(),id=String(params.id||''),{goBack}=useAppNav();
 const [data,setData]=useState<{id:string;topic:TopicDetail|null;error:string}>({id:'',topic:null,error:''}),[attempt,setAttempt]=useState(0);
 useEffect(()=>{const ctrl=new AbortController();fetch('/api/topics/'+encodeURIComponent(id),{signal:ctrl.signal}).then(async r=>{if(!r.ok)throw Error(r.status===404?'Dieser Vorgang wurde nicht gefunden.':'Der Vorgang konnte nicht geladen werden.');return r.json() as Promise<TopicDetail>;}).then(t=>{if(!ctrl.signal.aborted)setData({id,topic:t,error:''});}).catch(e=>{if(!ctrl.signal.aborted)setData({id,topic:null,error:e.message});});window.scrollTo(0,0);return()=>ctrl.abort();},[id,attempt]);
 const t=data.id===id?data.topic:null,region=REGIONS.find(r=>r.id===t?.regionId);
 if(!t)return <main id="inhalt" className="mx-auto max-w-page px-6 py-12"><Link className="link-btn" href="/">Zur Übersicht</Link>{data.id===id&&data.error?<div role="alert" className="card-shell mt-6 p-6"><p>{data.error}</p><button className="btn-secondary mt-4" onClick={()=>setAttempt(n=>n+1)}>Erneut versuchen</button></div>:<p role="status" className="mt-6">Vorgang wird geladen …</p>}</main>;
 const status=STATUS[t.status]||STATUS.unknown,share='https://wa.me/?text='+encodeURIComponent(t.title+' '+(typeof window!=='undefined'?window.location.origin:'')+'/thema/'+t.id);
 return <main id="inhalt" className="mx-auto max-w-page px-4 py-5 sm:px-6 sm:py-8"><article className="card-shell mx-auto max-w-[880px] px-5 py-6 sm:px-10 sm:py-8">
 <button className="back-btn mb-5" onClick={goBack}><IconChevronLeft/>Zurück zur Übersicht</button>
 <div className="flex flex-wrap gap-2 text-xs"><span className="chip-soft">{region?.name||'Gebiet nicht zugeordnet'}</span><span className="chip-soft">{t.category}</span><span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 font-semibold text-teal-800">{status.label}</span></div>
 <h1 className="mb-4 mt-5 text-3xl font-bold leading-tight tracking-tight">{t.title}</h1><p className="text-lg leading-relaxed text-slate-600">{t.shortSummary}</p>
 <dl className="my-7 grid grid-cols-2 gap-4 border-y border-slate-200 py-5 text-sm sm:grid-cols-3">{[['Sitzung',formatDate(t.eventDate)],['Gremium',t.committee||'Nicht dokumentiert'],['Vorlage',t.reference||'Nicht dokumentiert'],['Quellenstand',formatDate(t.updatedAt)],['Gebiet',region?.name||'Unbekannt'],['Verfahrensstand',status.label]].map(([k,v])=><div key={k}><dt className="mb-1 text-xs text-slate-500">{k}</dt><dd className="font-medium">{v}</dd></div>)}</dl>
 <section><h2 className="mb-3 text-xl font-semibold">{t.contentAnalysis?.status==='completed'?'Inhaltszusammenfassung':'Gespeicherter Quellenüberblick'}</h2>{t.longSummary?.map((p,i)=><p key={i} className="mb-4 text-base leading-relaxed text-slate-700">{p}</p>)}<p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">{status.description}</p></section>
 <section className="mt-8"><h2 className="mb-4 text-xl font-semibold">Verlauf & öffentliche Sitzungen</h2><ol className="space-y-4">{t.events.map((e,i)=><li key={i} className="rounded-lg border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-2 text-sm"><strong>{e.committee||'Gremium nicht dokumentiert'}</strong><time>{formatDate(e.date)}</time></div><p className="my-2 text-sm text-slate-600">{STATUS[e.status]?.label||'Stand offen'} · {e.description}</p><SessionDetails event={e}/><a className="link-btn" href={e.url} target="_blank" rel="noopener noreferrer">Öffentliche Sitzung ↗</a></li>)}</ol>{!t.events.length&&<p className="text-slate-500">Keine öffentliche Sitzung zugeordnet.</p>}</section>
 <section className="mt-8"><h2 className="mb-3 text-xl font-semibold">Originalunterlagen</h2><p className="mb-4 text-sm text-slate-500">Originaltitel: {t.officialTitle}</p><ul className="space-y-3">{t.documents.map((d,i)=><li key={i}><a className="link-btn" href={d.url} target="_blank" rel="noopener noreferrer">{d.title||'Dokument'} ↗</a></li>)}</ul>{t.sourceUrl&&<a className="link-btn mt-4 inline-block" href={t.sourceUrl} target="_blank" rel="noopener noreferrer">Vorgang im Ratsinformationssystem ↗</a>}</section>
 <ArticleAnalysis topic={t}/>
 <section className="mt-8 border-t border-slate-200 pt-6"><h2 className="text-xl font-semibold">Ähnliche Themen & Analysen</h2><p className="my-3 text-sm text-slate-500">Vergleiche gespeicherte Themenmerkmale und Quellenabdeckung anderer Orte.</p><Link className="btn-secondary" href={'/analysen?region='+encodeURIComponent(t.regionId||'billerbeck')+'&topic='+encodeURIComponent(t.id)+'&label='+encodeURIComponent(t.classification?.primary||'unklar')}>Thema vergleichen</Link></section>
 <footer className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5"><p className="max-w-[60ch] text-xs text-slate-500">{t.generatedBy}. Maßgeblich sind die Originalquellen.</p><a className="btn-primary" href={share} target="_blank" rel="noopener noreferrer">Über WhatsApp teilen</a><Link className="link-btn" href={'/quellen?region='+encodeURIComponent(t.regionId||'billerbeck')}>Quellenlage prüfen</Link></footer>
 </article></main>;
}
