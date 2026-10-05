import {useEffect,useState} from 'react';
import {useRouter,useParams} from 'next/navigation';
import Link from 'next/link';
import type {TopicDetail} from '@/shared/types';
import {STATUS,formatDate} from '@/shared/types';
import {REGIONS} from '@/shared/regions';
import {SessionDetails} from '@/components/article-analysis';
import {IconChevronLeft,IconDoc} from '../components/icons';
import {useAppNav} from '../state/nav';
import {ShareButton} from '../components/ShareButton';
import {SaveArticleButton} from '../components/SaveArticleButton';
import {FollowButton} from '../components/FollowButton';
import {ExportMenu} from '../components/ExportMenu';
import {exportArticlePdf,exportArticleTable,printArticle} from '../lib/exportArticle';
export function DetailPage(){
 const router=useRouter(),params=useParams(),id=String(params.id||''),{goBack}=useAppNav();
 const [data,setData]=useState<{id:string;topic:TopicDetail|null;error:string}>({id:'',topic:null,error:''}),[attempt,setAttempt]=useState(0);
 useEffect(()=>{const ctrl=new AbortController();fetch('/api/topics/'+encodeURIComponent(id),{signal:ctrl.signal}).then(async r=>{if(!r.ok)throw Error(r.status===404?'Dieser Vorgang wurde nicht gefunden.':'Der Vorgang konnte nicht geladen werden.');return r.json() as Promise<TopicDetail>;}).then(t=>{if(!ctrl.signal.aborted)setData({id,topic:t,error:''});}).catch(e=>{if(!ctrl.signal.aborted)setData({id,topic:null,error:e.message});});window.scrollTo(0,0);return()=>ctrl.abort();},[id,attempt]);
 const t=data.id===id?data.topic:null,region=REGIONS.find(r=>r.id===t?.regionId);
 if(!t)return <main id="inhalt" className="mx-auto max-w-page py-[12px]"><Link className="link-btn" href="/">Zur Übersicht</Link>{data.id===id&&data.error?<div role="alert" className="card-shell mt-6 p-6"><p>{data.error}</p><button className="btn-secondary mt-4" onClick={()=>setAttempt(n=>n+1)}>Erneut versuchen</button></div>:<p role="status" className="mt-6">Vorgang wird geladen …</p>}</main>;
  const host=(u:string)=>{try{return new URL(u).host;}catch{return '';}},events=t.events.filter(e=>!t.sourceUrl||!e.url||!host(e.url)||host(e.url)===host(t.sourceUrl)),status=STATUS[t.status]||STATUS.unknown;
  const article={id:t.id,title:t.title,date:(t.eventDate||'').slice(0,10),gemeinde:region?.name||'',teaser:t.shortSummary||''};
  /* Rohdaten der OParl-Schnittstelle (maschinenlesbares JSON) sind keine Unterlage für Menschen: ausblenden */
  const isOparlData=(u?:string,title?:string)=>/oparl-datensatz/i.test(title||'')||/\/oparl\/.*\/(papers|meetings|agendaitems|consultations)\//i.test(u||'');
  /* Unterlagen über den eigenen Durchreicher öffnen: PDFs erscheinen im Browser statt als Download */
  const docs=t.documents.map((d,i)=>({...d,url:`${typeof window!=='undefined'?window.location.origin:''}/api/dokument?t=${encodeURIComponent(t.id)}&i=${i}`,src:d.url})).filter(d=>!isOparlData(d.src,d.title));
  const sorted=[...events].sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  const facts:[string,string][]=[['Sitzung',formatDate(t.eventDate)],['Gremium',t.committee||'Nicht dokumentiert'],['Vorlage',t.reference||'Nicht dokumentiert'],['Gebiet',region?.name||'Unbekannt'],['Stand',status.label],['Quellenstand',formatDate(t.updatedAt)]];
  return (
    <main id="inhalt" className="mx-auto max-w-page py-[12px]">
      <article className="py-2">
        <button type="button" className="back-btn -ml-1.5 mb-4" onClick={()=>window.history.length>1?router.back():goBack()}><IconChevronLeft/>Zurück</button>

        {/* Kopf: Ort, Thema, Stand als Textzeile; Aktionen rechts */}
        <div className="flex flex-wrap items-center gap-2 text-[14px] text-slate-500">
          <span>{region?.name||'Gebiet nicht zugeordnet'} · {t.category} · <span className="text-teal-600">{status.label}</span></span>
          {/* Aktionen als Symbole: Teilen, Folgen, Speichern, Exportieren */}
          <span className="ml-auto flex flex-wrap items-center gap-1">
            <ShareButton title={t.title} url={typeof window!=='undefined'?window.location.origin+'/beschluss/'+t.id:''}/>
            <FollowButton article={article} size={20}/>
            <SaveArticleButton article={article} size={20}/>
            <ExportMenu
              title="Exportieren"
              tone="text-teal-600 hover:bg-teal-50 hover:text-teal-700"
              options={[
                {id:'pdf',label:'PDF',desc:'Übersicht mit Logo als Datei zum Weitergeben oder Ablegen'},
                {id:'print',label:'Drucken',desc:'Druckfertige Seite mit Logo, direkt zum Drucker'},
                {id:'xlsx',label:'Excel (.xlsx)',desc:'Eckdaten, Verlauf und Unterlagen als Tabelle'},
                {id:'csv',label:'CSV (.csv)',desc:'Für andere Programme, z. B. CRM'},
              ]}
              onExport={async f=>{const a={t,place:region?.name||'',docs,events:sorted};if(f==='pdf')await exportArticlePdf(a);else if(f==='print')printArticle(a);else exportArticleTable(a,f as 'csv'|'xlsx');}}
            />
          </span>
        </div>
        <h1 lang="de" className="mb-3 mt-3 max-w-[38ch] hyphens-auto text-[22px] font-semibold leading-tight tracking-tight text-slate-900 sm:text-[28px]">{t.title}</h1>
        <p className="max-w-[70ch] text-[16px] leading-relaxed text-slate-500 sm:text-[18px]">{t.shortSummary}</p>

        <div className="mt-8 grid gap-10 border-t border-slate-200 pt-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* Hauptspalte: Inhalt und Verlauf */}
          <div className="min-w-0">
            <section>
              <h2 className="mb-3 text-[18px] font-semibold text-slate-900">{t.contentAnalysis?.status==='completed'?'Inhaltszusammenfassung':'Worum es geht'}</h2>
              {t.longSummary?.map((p,i)=><p key={i} className="mb-4 max-w-[70ch] text-[16px] leading-relaxed text-slate-900">{p}</p>)}
              <p className="max-w-[70ch] border-l-2 border-teal-600 pl-4 text-[14px] text-slate-500">{status.description}</p>
            </section>

            <section className="mt-10">
              <h2 className="mb-4 text-[18px] font-semibold text-slate-900">Verlauf</h2>
              {sorted.length?(
                /* Senkrechte Zeitleiste: Punkt je Sitzung, der jüngste Schritt in Petrol */
                <ol className="m-0 list-none p-0">
                  {sorted.map((e,i)=>{const last=i===sorted.length-1;return (
                    <li key={i} className="relative grid grid-cols-[20px_minmax(0,1fr)] gap-x-3 pb-6 last:pb-0">
                      {!last&&<span aria-hidden="true" className="absolute bottom-0 left-[9px] top-4 w-px bg-slate-200"/>}
                      <span aria-hidden="true" className={`relative z-[1] mt-1.5 h-2.5 w-2.5 justify-self-center rounded-full ${last?'bg-teal-600':'bg-slate-300'}`}/>
                      <div className="min-w-0 text-[14px]">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <time className="tabular-nums text-slate-500">{formatDate(e.date)}</time>
                          <strong className="font-semibold text-slate-900">{e.committee||'Gremium nicht dokumentiert'}</strong>
                          <span className={last?'text-teal-600':'text-slate-500'}>{STATUS[e.status]?.label||'Stand offen'}</span>
                          {e.url&&!isOparlData(e.url)&&<a className="relative ml-auto text-teal-600 no-underline hover:underline max-sm:after:absolute max-sm:after:-inset-x-2 max-sm:after:-inset-y-3.5 max-sm:after:content-['']" href={e.url} target="_blank" rel="noopener noreferrer" title="Öffentliche Sitzung öffnen">Sitzung ↗</a>}
                        </div>
                        {e.description&&<p className="m-0 mt-1 text-[14px] text-slate-500">{e.description}</p>}
                        <div className="mt-1 text-[14px]"><SessionDetails event={e}/></div>
                      </div>
                    </li>
                  );})}
                </ol>
              ):<p className="text-[14px] text-slate-500">Keine öffentliche Sitzung zugeordnet.</p>}
            </section>
            {/* Originalunterlagen prominent unter dem Verlauf: je Dokument eine Zeile mit Symbol und Link */}
            <section className="mt-10">
              <h2 className="mb-1 text-[18px] font-semibold text-slate-900">Originalunterlagen</h2>
              <p className="mb-4 text-[14px] text-slate-500">Originaltitel: {t.officialTitle}</p>
              {docs.length?(
                <ul className="m-0 grid list-none gap-x-8 border-t border-slate-200 p-0 sm:grid-cols-2">
                  {docs.map((d,i)=><li key={i} className="border-b border-slate-200"><a href={d.url} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 py-3 text-[16px] text-slate-900 no-underline"><IconDoc size={28} className="flex-none text-teal-600"/><span className="min-w-0 flex-1 break-words group-hover:text-teal-600">{d.title||'Dokument'}</span><span aria-hidden="true" className="flex-none text-teal-600">↗</span></a></li>)}
                </ul>
              ):<p className="text-[14px] text-slate-500">Keine Unterlagen verlinkt.</p>}
            </section>
          </div>

          {/* Seitenspalte: Fakten auf einen Blick */}
          <aside className="min-w-0 lg:border-l lg:border-slate-200 lg:pl-8">
            <h2 className="mb-3 text-[18px] font-semibold text-slate-900">Auf einen Blick</h2>
            <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3 text-[14px] lg:grid-cols-1">
              {facts.map(([k,v])=><div key={k}><dt className="text-[12px] text-slate-500">{k}</dt><dd className="m-0 text-slate-900">{v}</dd></div>)}
            </dl>

          </aside>
        </div>
      </article>
    </main>
  );
}
