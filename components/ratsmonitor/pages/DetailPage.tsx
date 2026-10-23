import {useEffect,useState} from 'react';
import {useRouter,useParams} from 'next/navigation';
import Link from 'next/link';
import type {TopicDetail} from '@/shared/types';
import {STATUS,formatDate} from '@/shared/types';
import {IconChevronLeft,IconDoc,IconRules} from '../components/icons';
import {cameFromApp,useAppNav} from '../state/nav';
import {ShareButton} from '../components/ShareButton';
import {SaveArticleButton} from '../components/SaveArticleButton';
import {FollowButton} from '../components/FollowButton';
import {loadTopic,peekTopic,TopicError} from '../lib/topicCache';
const NOT_FOUND_TEXT='Dieser Vorgang wurde nicht gefunden.';
import {todayLocal} from '../lib/text';
import {StepIcon} from '../components/StepIcon';
import {primaryPdf} from '@/shared/document-type.mjs';
import {SUBTOPICS,THEMES} from '@/shared/themes.mjs';
import {ThemeIcon} from '../components/icons';
import {SubtopicIcon} from '../components/SubtopicIcon';
import {Building2,CalendarClock,CalendarDays,FileText,Gavel,History,Link2,MapPin,Quote,type LucideIcon} from 'lucide-react';
import {useBrand} from '../lib/brand';
const sourceLink=(value?:string)=>{try{const url=new URL(value||'');return ['http:','https:'].includes(url.protocol)?url.href:undefined;}catch{return undefined;}};
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
  /* Kurz: ruhige Zeile unter dem Titel; lang: helle Zitatkarte mit Anführungszeichen */
  if(size==='short')return <figure className="m-0">
    <blockquote className="m-0 max-w-[70ch] text-[16px] leading-relaxed text-slate-600 sm:text-[18px]">„{body}“</blockquote>
  </figure>;
  return <figure className="m-0">
    <blockquote className="m-0 max-w-none border-l-2 border-teal-600 pl-4 text-[16px] leading-relaxed text-slate-900">„{body}“</blockquote>
    <figcaption className="mt-2 pl-4 text-[12px] text-slate-500">Wörtlich aus der Vorlage{url&&<> · <a className="text-teal-700 no-underline hover:underline" href={url} target="_blank" rel="noopener noreferrer">{source?.title||'Originaldokument'} ↗</a></>}</figcaption>
  </figure>;
}
/* Kopf eines Abschnitts wie auf plenara.X: Symbol in Petrol auf hellem Grund, daneben der Titel */
function Kopf({icon:I,children}:{icon:LucideIcon;children:React.ReactNode}){
  return <h2 className="mb-5 flex items-center gap-3 text-[20px] font-semibold tracking-tight text-slate-900"><span aria-hidden="true" className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-teal-50 text-teal-700"><I size={18} strokeWidth={1.6}/></span>{children}</h2>;
}
/* Ton des Stands im Kopf: Ergebnis in Petrol, Ablehnung Orange-Braun, Vertagung Dunkelblau, sonst Grau (Farbschema Petrol klar) */
const STATUS_TONE:Record<string,string>={approved:'text-teal-700',rejected:'text-amber-700',postponed:'text-sky-800',recommended:'text-teal-700',info:'text-slate-500'};
/* Abstimmung als Balken: Ja, Nein, Enthaltung (nur wenn Zahlen veröffentlicht sind) */
function Stimmen({v}:{v:{yes:number|null;no:number|null;abstentions:number|null;description?:string}}){
  const parts:[string,number,string][]=[['Ja',v.yes??0,'bg-teal-600'],['Nein',v.no??0,'bg-amber-600'],['Enthaltung',v.abstentions??0,'bg-slate-300']];
  const sum=parts.reduce((a,p)=>a+p[1],0);
  if(!sum)return v.description?<p className="m-0 mt-3 text-[14px] text-slate-600">Abstimmung: {v.description}</p>:null;
  return <div className="mt-4">
    <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={parts.map(([l,n])=>`${n} ${l}`).join(', ')}>{parts.map(([l,n,c])=>n?<span key={l} className={c} style={{width:`${(n/sum)*100}%`}}/>:null)}</div>
    <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-4 p-0 text-[12px] text-slate-600">{parts.map(([l,n,c])=><li key={l} className="flex items-center gap-1.5"><i className={`inline-block h-2.5 w-2.5 rounded-sm ${c}`}/><b className="font-semibold tabular-nums text-slate-900">{n}</b> {l}</li>)}</ul>
  </div>;
}
/** Aktionsknopf im Kopf des Artikels: Pille mit Rand, am Handy rund */
const ACTION='rounded-full border sm:pl-3 sm:pr-4 max-sm:!w-11 max-sm:justify-center';

export function DetailPage(){
 const router=useRouter(),params=useParams(),id=String(params.id||''),{goBack}=useAppNav();
 const [alleSitzungen,setAlleSitzungen]=useState(false);
 const [data,setData]=useState<{id:string;topic:TopicDetail|null;error:string}>(()=>{const s=peekTopic(id);return s===undefined?{id:'',topic:null,error:''}:{id,topic:s,error:s?'':NOT_FOUND_TEXT};}),[attempt,setAttempt]=useState(0);
 // Der Vorgang kommt aus lib/topicCache.ts: aus der Trefferliste meist schon vorgeladen, bei der Rückkehr noch gehalten.
 useEffect(()=>{let live=true;if(!attempt&&peekTopic(id)!==undefined){window.scrollTo(0,0);return;}loadTopic(id).then(t=>{if(live)setData({id,topic:t,error:''});}).catch(e=>{if(live)setData({id,topic:null,error:e instanceof TopicError?e.message:'Der Vorgang konnte nicht geladen werden.'});});window.scrollTo(0,0);return()=>{live=false;};},[id,attempt]);
 // Gebietsname kommt mit dem Vorgang (regionName, server/mappers/topics.ts); der Katalog (528 KB) wird hier nicht mehr geladen.
 /* Vom Server mitgelieferter Vorgang gilt sofort (auch nach einem Wechsel zu einem anderen mitgelieferten), ohne Setzen im Effekt */
 const seeded=attempt?undefined:peekTopic(id),cur=seeded!==undefined?{id,topic:seeded,error:seeded?'':NOT_FOUND_TEXT}:data;
 const t=cur.id===id?cur.topic:null,regionName=t?.regionName||'';
 // Tab-Titel wie vom Server (generateMetadata): Vorgangstitel · Marke; solange nichts da ist, „Vorgang“
 const {name}=useBrand(),tabTitle=t?.title?.replace(/^[\s\-–:;,]+|[\s\-–:;,]+$/g,'')||(cur.id===id&&cur.error?'Vorgang nicht gefunden':'Vorgang');
 useEffect(()=>{document.title=`${tabTitle} · ${name}`;},[tabTitle,name]);
 if(!t)return <main id="inhalt" className="mx-auto max-w-page py-[12px]"><Link className="link-btn" href="/suche">Zur Übersicht</Link>{cur.id===id&&cur.error?<div role="alert" className="card-shell mt-6 p-6"><p>{cur.error}</p><button className="btn-secondary mt-4" onClick={()=>setAttempt(n=>n+1)}>Erneut versuchen</button></div>:<p role="status" className="mt-6">Vorgang wird geladen …</p>}</main>;
  const host=(u:string)=>{try{return new URL(u).host;}catch{return '';}},events=t.events.filter(e=>!t.sourceUrl||!e.url||!host(e.url)||host(e.url)===host(t.sourceUrl)),status=STATUS[t.status]||STATUS.unknown;
  /* KI-Texte (Zusammenfassung, Zitate, Thema) zeigt das Frontend nicht; ohne Auszug aus der Vorlage bleibt der Abschnitt knapp */
  const ki=/^KI-Zusammenfassung/.test(t.generatedBy||'')||t.contentAnalysis?.status==='completed',rule=t.ruleSummary;
  /* Ohne Auszug der Überblick aus dem Modell (Vorgang, Sitzungen, Unterlagen), auch wenn eine KI-Fassung vorliegt (die zeigt die
     Seite nicht, sonst stünde unter dem Titel nichts); ohne Überblick der Text des Imports, nie der KI-Text */
  const overview=!rule?t.overview?.text:'';
  const shortText=overview||(ki?'':t.shortSummary);
  const source=rule?{icon:<IconRules size={16} aria-hidden="true"/>,label:'Auszug aus der Vorlage (Originalsätze)'}:overview?{icon:<IconDoc size={16} aria-hidden="true"/>,label:'Automatischer Überblick aus Sitzungen und Unterlagen'}:{icon:<IconDoc size={16} aria-hidden="true"/>,label:'Automatischer Quellenüberblick'};
  const excerptSource=rule?.source;
  const article={id:t.id,title:t.title,date:(t.eventDate||'').slice(0,10),gemeinde:regionName,teaser:shortText||''};
  /* Rohdaten der OParl-Schnittstelle (maschinenlesbares JSON) sind keine Unterlage für Menschen: ausblenden */
  const isOparlData=(u?:string,title?:string)=>/oparl-datensatz/i.test(title||'')||/\/oparl\/.*\/(papers|meetings|agendaitems|consultations)\//i.test(u||'');
  /* Unterlagen über den eigenen Durchreicher öffnen: PDFs erscheinen im Browser statt als Download */
  const docs=t.documents.map((d,i)=>({...d,url:`/api/dokument?t=${encodeURIComponent(t.id)}&i=${i}`,src:d.url})).filter(d=>!isOparlData(d.src,d.title));
  const sorted=[...events].sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  /* Letzte Sitzung bis heute (-1: alle noch künftig); danach Kommendes grau */
  const today=todayLocal(),current=sorted.reduce((c,e,i)=>(e.date||'').slice(0,10)<=today?i:c,-1);
  const next=sorted.find(e=>(e.date||'').slice(0,10)>today),lastEv=current>=0?sorted[current]:null;
  /* Ergebnis: jüngste Sitzung mit dokumentierter Entscheidung oder Empfehlung */
  const decided=[...sorted].reverse().find(e=>e.decision&&e.decision.kind!=='unknown'&&(e.decision.text||e.decision.votes));
  /* Hauptdokument: Quelle des Auszugs, sonst dieselbe Wahl wie beim Import (primaryPdf); Verweise ohne PDF (Sitzungsseiten) getrennt */
  const mainSrc=rule?.source?.url||primaryPdf(t.documents)?.url;
  const mainDoc=docs.find(d=>d.src===mainSrc)||null;
  const pdfDocs=docs.filter(d=>d!==mainDoc&&d.kind==='application/pdf'),linkDocs=docs.filter(d=>d!==mainDoc&&d.kind!=='application/pdf');
  /* Einordnung (Thema und Unterthemen aus readReport bzw. dem Modell) */
  const themeId=t.theme?.id&&THEMES.some((x:{id:string})=>x.id===t.theme!.id)?t.theme.id:'';
  const themeName=THEMES.find((x:{id:string})=>x.id===themeId)?.name??t.category;
  const subs=(t.theme?.subs??[]).map(id=>SUBTOPICS.find((x:{id:string})=>x.id===id)).filter(Boolean) as {id:string;short:string}[];
  /* Rohtitel der Ratsinformationssysteme enden oft auf „-“ oder „:“ */
  const cleanTitle=t.title.replace(/^[\s\-–:;,]+|[\s\-–:;,]+$/g,'')||t.title;
  /* Ergebnis nur als eigener Abschnitt, wenn es mehr sagt als der Stand oben (Text mit Inhalt oder Stimmen) */
  const decidedText=decided?.decision?.text?.trim()||'';
  const decidedShows=!!decided&&(!!decided.decision?.votes||decidedText.length>40);
  /* Dateiname ohne Endung, Unterstriche als Leerzeichen */
  const docName=(x?:string)=>(x||'Dokument').replace(/\.(pdf|docx?|xlsx?)$/i,'').replace(/_/g,' ');
  const verlaufSicht=alleSitzungen||sorted.length<=6?sorted.map((e,i)=>[e,i] as const):sorted.map((e,i)=>[e,i] as const).slice(-5);
  const heute=next??lastEv;
  return (
    <main id="inhalt" className="mx-auto max-w-page py-[12px]">
      {/* Eine Lesespalte wie ein guter Vortrag: groß, viel Luft, eine Aussage je Abschnitt */}
      <article className="py-2">
        <div className="flex items-center gap-2">
          <button type="button" className="back-btn -ml-1.5" onClick={()=>cameFromApp()?router.back():goBack()}><IconChevronLeft/>Zurück</button>
          {/* Teilen, Folgen, Merken als Knöpfe mit Rand und Beschriftung (am Handy nur Symbol); Teilen gefüllt, weil Weitergeben am meisten bringt */}
          <span className="ml-auto flex items-center gap-2">
            <ShareButton title={t.title} url={typeof window!=='undefined'?window.location.origin+'/beschluss/'+t.id:''} label className={`${ACTION} border-teal-700 bg-teal-700 !text-white hover:bg-teal-800`}/>
            <FollowButton article={article} size={20} label className={`${ACTION} border-slate-300 hover:border-teal-700`}/>
            <SaveArticleButton article={article} size={20} label className={`${ACTION} border-slate-300 hover:border-teal-700`}/>
          </span>
        </div>

        {/* Bühne: Ort und Thema klein, Titel groß, der Kernsatz als Lead */}
        <header className="mt-8 max-sm:mt-5">
          {/* Ort und Thema: präsent über dem Titel, je ein Link in die Suche */}
          <p className="m-0 flex flex-wrap items-center gap-x-5 gap-y-2 text-[16px] font-medium">
            {t.regionAgs?<Link href={`/suche?ort=${t.regionAgs}`} className="inline-flex items-center gap-2 text-slate-900 no-underline hover:text-teal-700"><MapPin aria-hidden="true" size={18} className="text-teal-700"/>{regionName}</Link>:<span className="inline-flex items-center gap-2 text-slate-900"><MapPin aria-hidden="true" size={18} className="text-teal-700"/>{regionName||'Gebiet nicht zugeordnet'}</span>}
            {themeId?<Link href={`/suche?thema=${themeId}${t.regionAgs?`&ort=${t.regionAgs}`:''}`} className="inline-flex items-center gap-2 text-slate-900 no-underline hover:text-teal-700"><ThemeIcon theme={themeId} size={18} className="text-teal-700"/>{themeName}</Link>:<span className="text-slate-600">{themeName}</span>}
          </p>
          <h1 lang="de" className="m-0 mt-3 max-w-[46ch] hyphens-auto text-[28px] font-semibold leading-[1.15] tracking-tight text-slate-900 sm:text-[40px]">{cleanTitle}</h1>
          {rule?<div className="mt-5 max-w-[70ch]"><Excerpt text={rule.short} source={excerptSource} size="short"/></div>:shortText?<p className="m-0 mt-5 text-[18px] leading-relaxed text-slate-600 sm:text-[21px]">{shortText}</p>:null}
        </header>

        {/* Die Antwort in einem Satz: Stand groß, daneben wann */}
        <div className="mt-10 grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-12 border-y border-slate-200 py-6 max-sm:mt-8 max-sm:grid-cols-1 max-sm:gap-y-4">
          <p className="m-0" title={status.description}><span className="block text-[12px] uppercase tracking-[.12em] text-slate-500">Stand</span><span className={`mt-1.5 flex items-center gap-2 text-[22px] font-semibold leading-tight ${STATUS_TONE[t.status]??'text-slate-900'}`}><StepIcon name={status.label} size={20} className="text-teal-700"/>{status.label}</span></p>
          {/* Gremium: wer berät bzw. entschieden hat (letzte Sitzung bis heute, sonst die nächste) */}
          <p className="m-0 min-w-0"><span className="block text-[12px] uppercase tracking-[.12em] text-slate-500">Gremium</span><span className="mt-1.5 flex items-center gap-2 text-[22px] font-semibold leading-tight text-slate-900"><Building2 aria-hidden="true" size={20} className="flex-none text-teal-700"/><span className="min-w-0">{(lastEv??next)?.committee||t.committee||'Nicht dokumentiert'}</span></span></p>
          {heute&&<p className="m-0 text-[14px] text-slate-600 sm:text-right"><span className="block text-[12px] uppercase tracking-[.12em] text-slate-500">{next?'Nächste Sitzung':'Zuletzt beraten'}</span><span className="mt-1.5 flex items-center gap-2 text-[22px] font-semibold leading-tight tabular-nums text-slate-900 sm:justify-end">{next?<CalendarClock aria-hidden="true" size={20} className="text-teal-700"/>:<CalendarDays aria-hidden="true" size={20} className="text-teal-700"/>}{formatDate(heute.date)}</span>{next&&lastEv&&next.committee!==lastEv.committee?next.committee:''}</p>}
        </div>

        <div className="grid grid-cols-1 gap-x-16 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="min-w-0">
        {/* Worum es geht: der Auszug als ruhiges Zitat */}
        {(rule||(!ki&&!!t.longSummary?.length))&&<section className="mt-14 max-sm:mt-10">
          <Kopf icon={Quote}>{rule?'Aus der Vorlage':'Worum es geht'}</Kopf>
          {rule?<Excerpt text={withoutLead(rule.long,rule.short)} source={excerptSource} size="long"/>:<div>{t.longSummary.map((paragraph,index)=><p key={index} className="mb-4 break-words text-[18px] leading-relaxed text-slate-900">{paragraph}</p>)}</div>}
        </section>}

        {/* Was entschieden wurde, nur wenn es mehr sagt als der Stand */}
        {decidedShows&&decided&&<section className="mt-14 max-sm:mt-10">
          <Kopf icon={Gavel}>Was entschieden wurde</Kopf>
          <p className="m-0 text-[14px] text-slate-500"><b className="font-semibold tabular-nums text-slate-900">{formatDate(decided.date)}</b> · {decided.committee||'Gremium nicht dokumentiert'}</p>
          {decidedText&&<p className="m-0 mt-3 line-clamp-6 text-[18px] leading-relaxed text-slate-900">{decidedText}</p>}
          {decided.decision!.votes&&<Stimmen v={decided.decision!.votes}/>}
        </section>}

        {/* Verlauf: eine Zeile je Sitzung, Datum groß */}
        <section className="mt-14 max-sm:mt-10">
          <Kopf icon={History}>Verlauf</Kopf>
          {sorted.length?(<>
            <ol className="m-0 ml-3 list-none border-l border-slate-200 p-0 pl-6">
              {verlaufSicht.map(([e,i])=>{const last=i===current,future=(e.date||'').slice(0,10)>today,lbl=STATUS[e.status]?.label||'Stand offen';return (
                <li key={i} className="relative pb-6 last:pb-0">
                  <span aria-hidden="true" className={`absolute -left-[37px] top-0.5 grid h-6 w-6 place-items-center rounded-full ${last?'bg-teal-700 text-white':future?'border border-dashed border-slate-300 bg-white text-slate-400':'border border-slate-200 bg-white text-slate-500'}`}><StepIcon name={lbl} size={13}/></span>
                  <div className={future?'opacity-70':''}>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <time className={`text-[18px] font-semibold tabular-nums ${last?'text-teal-800':'text-slate-900'}`}>{formatDate(e.date)}</time>
                      <span className="text-[16px] text-slate-900">{e.committee||'Gremium nicht dokumentiert'}</span>
                      <span className={`text-[14px] ${last?'text-teal-700':'text-slate-500'}`}>{future?'angesetzt':lbl}</span>
                      {e.url&&!isOparlData(e.url)&&<a className="ml-auto text-[14px] text-teal-700 no-underline hover:underline" href={e.url} target="_blank" rel="noopener noreferrer" title="Öffentliche Sitzung öffnen">Sitzung ↗</a>}
                    </div>
                    {e.decision?.text&&<p className="m-0 mt-1 line-clamp-2 text-[14px] text-slate-600">{e.decision.text}{e.decision.votes&&(e.decision.votes.yes!==null||e.decision.votes.no!==null)?` · ${[e.decision.votes.yes!==null?e.decision.votes.yes+' Ja':'',e.decision.votes.no!==null?e.decision.votes.no+' Nein':'',e.decision.votes.abstentions!==null?e.decision.votes.abstentions+' Enthaltungen':''].filter(Boolean).join(', ')}`:''}</p>}
                  </div>
                </li>
              );})}
            </ol>
            {sorted.length>6&&<button type="button" onClick={()=>setAlleSitzungen(!alleSitzungen)} className="mt-4 text-[14px] font-medium text-teal-700 hover:underline">{alleSitzungen?'Nur die letzten fünf Sitzungen':`Alle ${sorted.length} Sitzungen zeigen`}</button>}
          </>):<p className="text-[14px] text-slate-500">Keine öffentliche Sitzung zugeordnet.</p>}
        </section>

        </div>
        {/* Rechte Spalte: Unterlagen, Angaben, weiterlesen */}
        <aside className="min-w-0">
        {/* Unterlagen: das Hauptdokument vorneweg, die übrigen schlicht darunter */}
        <section className="mt-14 max-sm:mt-10">
          <Kopf icon={FileText}>Originalunterlagen</Kopf>
          {t.officialTitle&&t.officialTitle.replace(/\W+/g,'').toLowerCase()!==t.title.replace(/\W+/g,'').toLowerCase()&&<p className="m-0 mb-3 text-[14px] text-slate-500">Originaltitel: {t.officialTitle}</p>}
          {docs.length?(<>
            {mainDoc&&<a href={mainDoc.url} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 rounded-xl border border-slate-200 p-3 no-underline transition-colors hover:border-teal-600">
              <span aria-hidden="true" className="grid h-12 w-12 flex-none place-items-center rounded-xl bg-teal-50 text-teal-700"><IconDoc size={28}/></span>
              <span className="min-w-0 flex-1"><span className="block text-[12px] uppercase tracking-[.12em] text-teal-700">Hauptdokument</span><span className="block break-words text-[18px] font-semibold text-slate-900 group-hover:text-teal-800">{docName(mainDoc.title)}</span></span>
              <span aria-hidden="true" className="flex-none text-teal-700">↗</span>
            </a>}
            {pdfDocs.length>0&&<p className="m-0 mt-5 text-[12px] uppercase tracking-[.12em] text-slate-500">Weitere Unterlagen ({pdfDocs.length})</p>}
            {pdfDocs.length>0&&<ul className="m-0 mt-1 list-none border-t border-slate-200 p-0">
              {pdfDocs.map((d,i)=><li key={i}><a href={d.url} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 border-b border-slate-200 py-2.5 text-[16px] text-slate-900 no-underline"><span aria-hidden="true" className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-slate-100 text-slate-500 group-hover:text-teal-700"><IconDoc size={20}/></span><span className="min-w-0 flex-1 break-words text-[16px] group-hover:text-teal-700">{docName(d.title)}</span><span aria-hidden="true" className="flex-none text-slate-400 group-hover:text-teal-700">↗</span></a></li>)}
            </ul>}
            {linkDocs.length>0&&<p className="m-0 mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px]"><Link2 aria-hidden="true" size={14} className="text-slate-400"/>{linkDocs.map((d,i)=><a key={i} href={d.url} target="_blank" rel="noopener noreferrer" className="text-teal-700 no-underline hover:underline">{d.title||'Verweis'} ↗</a>)}</p>}
          </>):<p className="text-[14px] text-slate-500">Keine Unterlagen verlinkt.</p>}
        </section>

        {/* Am Ende: Angaben, Einordnung und wie es weitergeht */}
        <section className="mt-14 max-sm:mt-10">
          <Kopf icon={MapPin}>Weiterlesen</Kopf>
          {(themeId||t.regionAgs)&&<ul className="m-0 list-none border-t border-slate-200 p-0 text-[16px]">
            {themeId&&t.regionAgs&&<li className="border-b border-slate-200"><Link href={`/suche?thema=${themeId}&ort=${t.regionAgs}`} className="flex items-center gap-3 py-3 text-slate-900 no-underline hover:text-teal-700"><ThemeIcon theme={themeId} size={20} className="flex-none text-teal-700"/><span className="flex-1">Mehr zu {subs[0]?.short??themeName} in {regionName}</span><span aria-hidden="true" className="text-teal-700">→</span></Link></li>}
            {themeId&&<li className="border-b border-slate-200"><Link href={`/analytics/atlas?thema=${themeId}${subs[0]?`&sub=${subs[0].id}`:''}`} className="flex items-center gap-3 py-3 text-slate-900 no-underline hover:text-teal-700">{subs[0]?<SubtopicIcon id={subs[0].id} size={20}/>:<ThemeIcon theme={themeId} size={20} className="text-teal-700"/>}<span className="flex-1">{subs[0]?.short??themeName} in anderen Orten</span><span aria-hidden="true" className="text-teal-700">→</span></Link></li>}
            {t.regionAgs&&<li className="border-b border-slate-200"><Link href={`/suche?ort=${t.regionAgs}`} className="flex items-center gap-3 py-3 text-slate-900 no-underline hover:text-teal-700"><MapPin aria-hidden="true" size={20} className="flex-none text-teal-700"/><span className="flex-1">Alle Vorgänge in {regionName}</span><span aria-hidden="true" className="text-teal-700">→</span></Link></li>}
          </ul>}
          <p className="m-0 mt-6 text-[12px] leading-relaxed text-slate-500">{t.reference?`Vorlage ${t.reference} · `:''}Quellenstand {formatDate(t.updatedAt)}. {source.label}. Ohne Gewähr, maßgeblich sind die Originalunterlagen{sourceLink(t.sourceUrl)&&<> · <a className="text-teal-700 no-underline hover:underline" href={sourceLink(t.sourceUrl)} target="_blank" rel="noopener noreferrer">Im Ratsinformationssystem ↗</a></>}.</p>
        </section>
        </aside>
        </div>
      </article>
    </main>
  );
}
