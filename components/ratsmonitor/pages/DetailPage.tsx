import {useEffect,useState} from 'react';
import {useRouter,useParams} from 'next/navigation';
import Link from 'next/link';
import type {ContentEvidence,TopicDetail} from '@/shared/types';
import {STATUS,formatDate} from '@/shared/types';
import {labelName} from '@/shared/labels.mjs';
import {SessionDetails} from '@/components/article-analysis';
import {IconChevronLeft,IconDoc,IconSpark,IconRules} from '../components/icons';
import {cameFromApp,useAppNav} from '../state/nav';
import {Segmented} from '../components/Segmented';
import {ShareButton} from '../components/ShareButton';
import {SaveArticleButton} from '../components/SaveArticleButton';
import {FollowButton} from '../components/FollowButton';
import {loadTopic,peekTopic,TopicError} from '../lib/topicCache';
const NOT_FOUND_TEXT='Dieser Vorgang wurde nicht gefunden.';
import {todayLocal} from '../lib/text';
import {useBrand} from '../lib/brand';
const sourceLink=(value?:string)=>{try{const url=new URL(value||'');return ['http:','https:'].includes(url.protocol)?url.href:undefined;}catch{return undefined;}};
function OriginalQuote({evidence,topic}:{evidence:ContentEvidence;topic:TopicDetail}){
 const source=topic.contentAnalysis?.sourceDocuments?.find(document=>evidence.sourceId&&document.id===evidence.sourceId||document.url===evidence.url);
 const title=source?.title||topic.documents.find(document=>document.url===evidence.url)?.title||'Originalquelle',url=sourceLink(evidence.url);
 const numbered=Number.isInteger(evidence.page)&&Number(evidence.page)>0;
 const location=source?.kind==='page'&&(!evidence.location||/^Seite\s+\d+$/i.test(evidence.location))?numbered?'Textabschnitt '+evidence.page:undefined:evidence.location||(numbered?'Seite '+evidence.page:undefined);
 return <figure className="m-0 mb-5 min-w-0 border-l-2 border-teal-600 pl-4">
  <blockquote className="m-0 max-w-none break-words text-[16px] leading-relaxed text-slate-900">„{evidence.quote}“</blockquote>
  <figcaption className="mt-2 break-words text-[12px] text-slate-500">{url?<a href={url} className="text-teal-700 no-underline hover:underline" target="_blank" rel="noopener noreferrer">{title} ↗</a>:title}{location&&' · '+location}</figcaption>
 </figure>;
}
/* Der lange Auszug beginnt oft mit den Sätzen, die oben schon stehen: sie nicht noch einmal zeigen */
function withoutLead(long:{sentences:string[];gaps?:boolean[]},lead?:{sentences:string[]}){
  const n=lead?.sentences.length||0;
  if(!n||long.sentences.length<=n||lead!.sentences.some((x,i)=>x!==long.sentences[i]))return long;
  return {sentences:long.sentences.slice(n),gaps:long.gaps?.slice(n).map((g,i)=>i?g:false)};
}
/* Auszug aus der Vorlage: nur Originalsätze, wörtlich; „[…]“ steht, wo im Dokument etwas dazwischen liegt */
function Excerpt({text,source,size}:{text:{sentences:string[];gaps?:boolean[]};source?:{url:string;title:string};size:'short'|'long'}){
  /* Aufzählungszeichen aus PDFs (Privatbereich) erscheinen sonst als Kästchen */
  const body=text.sentences.map((s,k)=>(k?(text.gaps?.[k]?' […] ':' '):'')+s).join('').replace(/[\uE000-\uF8FF]/g,'•');
  const url=sourceLink(source?.url);
  return <figure className="m-0">
    <blockquote className={`m-0 max-w-none border-l-2 border-teal-600 pl-4 leading-relaxed ${size==='short'?'text-[16px] text-slate-500 sm:text-[18px]':'text-[16px] text-slate-900'}`}>„{body}“</blockquote>
    <figcaption className="mt-2 pl-4 text-[14px] text-slate-500">Auszug aus der Vorlage{url&&<> · <a className="text-teal-700 no-underline hover:underline" href={url} target="_blank" rel="noopener noreferrer">{source?.title||'Originaldokument'} ↗</a></>}</figcaption>
  </figure>;
}
export function DetailPage(){
 const router=useRouter(),params=useParams(),id=String(params.id||''),{goBack}=useAppNav();
 const [data,setData]=useState<{id:string;topic:TopicDetail|null;error:string}>(()=>{const s=peekTopic(id);return s===undefined?{id:'',topic:null,error:''}:{id,topic:s,error:s?'':NOT_FOUND_TEXT};}),[attempt,setAttempt]=useState(0),[summaryView,setSummaryView]=useState<{id:string;view:'ai'|'rule'}>({id:'',view:'ai'});
 // Der Vorgang kommt aus lib/topicCache.ts: aus der Trefferliste meist schon vorgeladen, bei der Rückkehr noch gehalten.
 useEffect(()=>{let live=true;if(!attempt&&peekTopic(id)!==undefined){window.scrollTo(0,0);return;}loadTopic(id).then(t=>{if(live)setData({id,topic:t,error:''});}).catch(e=>{if(live)setData({id,topic:null,error:e instanceof TopicError?e.message:'Der Vorgang konnte nicht geladen werden.'});});window.scrollTo(0,0);return()=>{live=false;};},[id,attempt]);
 // Gebietsname kommt mit dem Vorgang (regionName, server/mappers/topics.ts); der Katalog (528 KB) wird hier nicht mehr geladen.
 /* Vom Server mitgelieferter Vorgang gilt sofort (auch nach einem Wechsel zu einem anderen mitgelieferten), ohne Setzen im Effekt */
 const seeded=attempt?undefined:peekTopic(id),cur=seeded!==undefined?{id,topic:seeded,error:seeded?'':NOT_FOUND_TEXT}:data;
 const t=cur.id===id?cur.topic:null,regionName=t?.regionName||'';
 // Tab-Titel wie vom Server (generateMetadata): Vorgangstitel · Marke; solange nichts da ist, „Vorgang“
 const {name}=useBrand(),tabTitle=t?.title||(cur.id===id&&cur.error?'Vorgang nicht gefunden':'Vorgang');
 useEffect(()=>{document.title=`${tabTitle} · ${name}`;},[tabTitle,name]);
 if(!t)return <main id="inhalt" className="mx-auto max-w-page py-[12px]"><Link className="link-btn" href="/suche">Zur Übersicht</Link>{cur.id===id&&cur.error?<div role="alert" className="card-shell mt-6 p-6"><p>{cur.error}</p><button className="btn-secondary mt-4" onClick={()=>setAttempt(n=>n+1)}>Erneut versuchen</button></div>:<p role="status" className="mt-6">Vorgang wird geladen …</p>}</main>;
  const host=(u:string)=>{try{return new URL(u).host;}catch{return '';}},events=t.events.filter(e=>!t.sourceUrl||!e.url||!host(e.url)||host(e.url)===host(t.sourceUrl)),status=STATUS[t.status]||STATUS.unknown;
  const isAi=/^KI-Zusammenfassung/.test(t.generatedBy||'')||t.contentAnalysis?.status==='completed',rule=t.ruleSummary;
  const both=isAi&&!!rule,view=both&&summaryView.id===id?summaryView.view:isAi?'ai':'rule',showRule=!!rule&&view==='rule';
  const shortText=!isAi&&rule?rule.short.sentences.join(' '):t.shortSummary;
  const evidence=(t.contentAnalysis?.evidence||[]).filter(value=>typeof value.quote==='string'&&value.quote.trim());
  const inlineQuote=(value:ContentEvidence)=>Number.isInteger(value.paragraphIndex)&&Number(value.paragraphIndex)>=0&&Number(value.paragraphIndex)<t.longSummary.length;
  const standaloneQuotes=evidence.filter(value=>!inlineQuote(value)),coverage=t.contentAnalysis?.coverage;
  const changeView=(next:'ai'|'rule')=>setSummaryView({id,view:next});
  const source=isAi?{icon:<IconSpark size={16} aria-hidden="true"/>,label:'KI-Zusammenfassung'}:rule?{icon:<IconRules size={16} aria-hidden="true"/>,label:'Auszug aus der Vorlage (Originalsätze)'}:{icon:<IconDoc size={16} aria-hidden="true"/>,label:'Automatischer Quellenüberblick'};
  const excerptSource=rule?.source;
  const article={id:t.id,title:t.title,date:(t.eventDate||'').slice(0,10),gemeinde:regionName,teaser:shortText||''};
  /* Rohdaten der OParl-Schnittstelle (maschinenlesbares JSON) sind keine Unterlage für Menschen: ausblenden */
  const isOparlData=(u?:string,title?:string)=>/oparl-datensatz/i.test(title||'')||/\/oparl\/.*\/(papers|meetings|agendaitems|consultations)\//i.test(u||'');
  /* Unterlagen über den eigenen Durchreicher öffnen: PDFs erscheinen im Browser statt als Download */
  const docs=t.documents.map((d,i)=>({...d,url:`/api/dokument?t=${encodeURIComponent(t.id)}&i=${i}`,src:d.url})).filter(d=>!isOparlData(d.src,d.title));
  const sorted=[...events].sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  /* Letzte Sitzung bis heute (-1: alle noch künftig); danach Kommendes grau */
  const today=todayLocal(),current=sorted.reduce((c,e,i)=>(e.date||'').slice(0,10)<=today?i:c,-1);
  const facts:[string,string][]=[['Sitzung',formatDate(t.eventDate)],['Gremium',t.committee||'Nicht dokumentiert'],['Vorlage',t.reference||'Nicht dokumentiert'],['Gebiet',regionName||'Unbekannt'],['Stand',status.label],['Quellenstand',formatDate(t.updatedAt)]];
  return (
    <main id="inhalt" className="mx-auto max-w-page py-[12px]">
      <article className="py-2">
        <button type="button" className="back-btn -ml-1.5 mb-4" onClick={()=>cameFromApp()?router.back():goBack()}><IconChevronLeft/>Zurück</button>

        {/* Kopf: Ort, Thema, Stand als Textzeile; Aktionen rechts */}
        <div className="flex flex-wrap items-center gap-2 text-[14px] text-slate-500">
          <span>{regionName||'Gebiet nicht zugeordnet'} · {t.category} · <span className="text-teal-700">{status.label}</span></span>
          {/* Aktionen als Symbole: Teilen, Folgen, Speichern */}
          <span className="ml-auto flex flex-wrap items-center gap-1">
            <ShareButton title={t.title} url={typeof window!=='undefined'?window.location.origin+'/beschluss/'+t.id:''}/>
            <FollowButton article={article} size={20}/>
            <SaveArticleButton article={article} size={20}/>
          </span>
        </div>
        <h1 lang="de" className="mb-3 mt-3 max-w-[64ch] hyphens-auto text-[22px] font-semibold leading-tight tracking-tight text-slate-900 sm:text-[28px]">{t.title}</h1>
        {!isAi&&rule?<Excerpt text={rule.short} source={excerptSource} size="short"/>:<p className="max-w-none border-l-2 border-teal-600 pl-4 text-[16px] leading-relaxed text-slate-500 sm:text-[18px]">{shortText}</p>}

        <div className="mt-8 grid gap-10 border-t border-slate-200 pt-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* Hauptspalte: Inhalt und Verlauf */}
          <div className="min-w-0">
            <section>
              <h2 className="mb-3 text-[18px] font-semibold text-slate-900">{both?'Zusammenfassung':isAi?'Inhaltszusammenfassung':rule?'Auszug aus der Vorlage':'Worum es geht'}</h2>
              {both&&<div className="mb-5"><Segmented label="Fassung der Zusammenfassung" options={[['ai','KI-Zusammenfassung'],['rule','Originalauszug']]} value={view} onPick={changeView}/></div>}
              <div id={'summary-'+(showRule?'rule':'ai')+'-view'} role={both?'tabpanel':undefined} aria-labelledby={both?'summary-'+view+'-tab':undefined} tabIndex={both?0:undefined}>
                {showRule?<div className="mb-4"><Excerpt text={withoutLead(rule.long,!isAi?rule.short:undefined)} source={excerptSource} size="long"/></div>:<>
                  {isAi&&t.contentAnalysis?.status==='stale'&&<p role="status" className="mb-4 border-l-2 border-slate-300 pl-4 text-[14px] leading-relaxed text-slate-500">Die Quelldaten haben sich geändert. Diese KI-Zusammenfassung wurde noch nicht aktualisiert.</p>}
                  {isAi&&coverage&&(coverage.partial||coverage.missing>0)&&<div className="mb-5 border-l-2 border-slate-300 pl-4 text-[14px] leading-relaxed text-slate-500"><p className="m-0">Unvollständige Quellenlage: {coverage.available} von {coverage.total} Unterlagen mit gespeichertem Sachtext.{coverage.partial?' Einige Texte sind nur teilweise lesbar.':''}</p>
                    {!!t.contentAnalysis?.gaps?.length&&<details className="mt-2"><summary className="cursor-pointer text-teal-700">Fehlende Unterlagen ({t.contentAnalysis.gaps.length})</summary><ul className="m-0 mt-2 list-none space-y-3 p-0">{t.contentAnalysis.gaps.map((gap,index)=>{const url=sourceLink(gap.url);return <li key={index}>{url?<a href={url} target="_blank" rel="noopener noreferrer" className="break-words text-teal-700 hover:underline">{gap.title||'Originalunterlage'} ↗</a>:<span className="break-words">{gap.title||'Originalunterlage'}</span>}<span className="block text-[12px]">{gap.reason}</span></li>;})}</ul></details>}
                  </div>}
                  <div className={'mb-4'+(!isAi||!evidence.length?' border-l-2 border-teal-600 pl-4':'')}>{t.longSummary?.map((paragraph,index)=><div key={index}><p className="mb-4 max-w-none break-words text-[16px] leading-relaxed text-slate-900">{paragraph}</p>{isAi&&evidence.filter(value=>value.paragraphIndex===index).map((value,quoteIndex)=><OriginalQuote key={quoteIndex} evidence={value} topic={t}/>)}</div>)}</div>
                  {isAi&&standaloneQuotes.length>0&&<div className="mb-5"><h3 className="mb-3 text-[16px] font-semibold text-slate-900">Originalzitate</h3>{standaloneQuotes.map((value,index)=><OriginalQuote key={index} evidence={value} topic={t}/>)}</div>}
                  {isAi&&t.contentAnalysis&&<p className="mb-4 text-[12px] leading-relaxed text-slate-500">Erstellt am {formatDate(t.contentAnalysis.generatedAt)}{t.contentAnalysis.agent?' · '+t.contentAnalysis.agent:''}{t.contentAnalysis.model?' · '+t.contentAnalysis.model:''}{coverage?' · '+coverage.available+' von '+coverage.total+' Unterlagen':''}{t.contentAnalysis.reviewStatus==='not_independently_reviewed'?' · Nicht unabhängig fachlich geprüft':''}</p>}
                </>}
              </div>
              <p className="max-w-none border-l-2 border-teal-600 pl-4 text-[14px] text-slate-500">{status.description}</p>
            </section>

            <section className="mt-10">
              <h2 className="mb-4 text-[18px] font-semibold text-slate-900">Verlauf</h2>
              {sorted.length?(
                /* Zeitleiste: Punkt je Sitzung; die letzte Sitzung bis heute in Petrol, künftige grau (hohler Punkt, gestrichelt),
                   denn sie haben noch nicht stattgefunden. Schmal senkrecht, ab 768 px quer (umbricht, wenn es nicht passt) */
                <ol className="m-0 list-none p-0 md:flex md:flex-wrap md:gap-x-8 md:gap-y-8">
                  {sorted.map((e,i)=>{const last=i===current,future=(e.date||'').slice(0,10)>today;return (
                    <li key={i} className={`relative grid grid-cols-[20px_minmax(0,1fr)] gap-x-3 pb-6 last:pb-0 md:block md:min-w-[240px] md:flex-1 md:border-t md:pb-0 md:pt-4 ${last?'md:border-teal-600':future?'md:border-dashed md:border-slate-300':'md:border-slate-200'}`}>
                      {!last&&<span aria-hidden="true" className="absolute bottom-0 left-[9px] top-4 w-px bg-slate-200 md:hidden"/>}
                      <span aria-hidden="true" className={`relative z-[1] mt-1.5 h-2.5 w-2.5 justify-self-center rounded-full md:absolute md:-top-[6px] md:left-0 md:mt-0 md:justify-self-auto ${last?'bg-teal-600':future?'border border-slate-300 bg-white':'bg-slate-300'}`}/>
                      <div className={`min-w-0 text-[14px] ${future?'opacity-60':''}`}>
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <time className="tabular-nums text-slate-500">{formatDate(e.date)}</time>
                          <strong className="font-semibold text-slate-900">{e.committee||'Gremium nicht dokumentiert'}</strong>
                          <span className={last?'text-teal-700':'text-slate-500'}>{STATUS[e.status]?.label||'Stand offen'}</span>
                          {e.url&&!isOparlData(e.url)&&<a className="relative ml-auto text-teal-700 no-underline hover:underline max-sm:after:absolute max-sm:after:-inset-x-2 max-sm:after:-inset-y-3.5 max-sm:after:content-['']" href={e.url} target="_blank" rel="noopener noreferrer" title="Öffentliche Sitzung öffnen">Sitzung ↗</a>}
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
              <p className="mb-4 text-[14px] text-slate-500">Ohne Gewähr. Maßgeblich sind die Originalunterlagen.</p>
              {docs.length?(
                <ul className="m-0 grid list-none gap-x-8 border-t border-slate-200 p-0 sm:grid-cols-2">
                  {docs.map((d,i)=><li key={i} className="border-b border-slate-200"><a href={d.url} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 py-3 text-[16px] text-slate-900 no-underline"><IconDoc size={28} className="flex-none text-teal-700"/><span className="min-w-0 flex-1 break-words group-hover:text-teal-700">{d.title||'Dokument'}</span><span aria-hidden="true" className="flex-none text-teal-700">↗</span></a></li>)}
                </ul>
              ):<p className="text-[14px] text-slate-500">Keine Unterlagen verlinkt.</p>}
            </section>
          </div>

          {/* Seitenspalte: Fakten auf einen Blick */}
          <aside className="min-w-0 lg:border-l lg:border-slate-200 lg:pl-8">
            <h2 className="mb-3 text-[18px] font-semibold text-slate-900">Auf einen Blick</h2>
            <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3 text-[14px] lg:grid-cols-1">
              {facts.map(([k,v])=><div key={k}><dt className="text-[12px] text-slate-500">{k}</dt><dd className="m-0 text-slate-900">{v}</dd></div>)}
              {sourceLink(t.sourceUrl)&&<div><dt className="text-[12px] text-slate-500">Originalquelle</dt><dd className="m-0"><a className="text-teal-700 no-underline hover:underline" href={sourceLink(t.sourceUrl)} target="_blank" rel="noopener noreferrer">Im Ratsinformationssystem ↗</a></dd></div>}
              {t.labelAssessments?.ai&&<div><dt className="text-[12px] text-slate-500">KI-Thema</dt><dd className="m-0 text-slate-900">{labelName(t.labelAssessments.ai.primary)}{t.labelAssessments.ai.status==='stale'&&<span className="block text-[12px] text-slate-500">Veraltet</span>}</dd></div>}
            </dl>
            <p className="mt-4 flex items-start gap-2 text-[14px] text-slate-500" title="Herkunft der Zusammenfassung"><span className="mt-0.5 text-teal-700">{source.icon}</span><span><span className="block text-[12px]">Zusammenfassung</span>{source.label}</span></p>
          </aside>
        </div>
      </article>
    </main>
  );
}
