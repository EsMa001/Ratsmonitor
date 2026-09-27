'use client';
import {useRef,useState,Fragment} from 'react';
import {ChevronRight} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {ToggleGroup,ToggleGroupItem} from '@/components/ui/toggle-group';
import {ProcessProgress} from './process-progress';
import {WhatsApp} from './whatsapp';
import {STATUS,formatDate,type FeedPage,type UpcomingSession} from '@/shared/types';
import {regionName} from '@/shared/regions';
import type {TopicFilter} from '@/shared/pagination';
export function NewsFeed({initialPage,sessions=[],region="billerbeck"}:{initialPage:FeedPage;sessions?:UpcomingSession[];region?:string}){
 const [topics,setTopics]=useState(initialPage.topics),[cursor,setCursor]=useState(initialPage.nextCursor),[total,setTotal]=useState(initialPage.total);
 const [filter,setFilter]=useState<TopicFilter>('alle'),[loading,setLoading]=useState(false),[error,setError]=useState(''),[stale,setStale]=useState(false);
 const requestId=useRef(0),busy=useRef(false);
 async function fetchPage(nextFilter:TopicFilter,append=false){
  if(append&&(busy.current||!cursor))return;
  const id=++requestId.current;busy.current=true;setLoading(true);setError('');setStale(false);
  if(!append){setFilter(nextFilter);setTopics([]);setCursor(null);}
  try{
   const query=new URLSearchParams({limit:'12',filter:nextFilter,region});if(append&&cursor)query.set('cursor',cursor);
   const response=await fetch('/api/topics?'+query);
   if(id!==requestId.current)return;
   if(response.status===409){setStale(true);throw Error('Der Datenstand hat sich geändert. Bitte lade die Seite neu.');}
   if(!response.ok)throw Error('Die Themen konnten nicht geladen werden. Bitte versuche es erneut.');
   const page:FeedPage=await response.json();if(id!==requestId.current)return;
   setTopics(previous=>append?[...previous,...page.topics.filter(t=>!previous.some(p=>p.id===t.id))]:page.topics);setTotal(page.total);setCursor(page.nextCursor);
  }catch(e){if(id===requestId.current)setError(e instanceof Error?e.message:'Laden fehlgeschlagen.');}
  finally{if(id===requestId.current){busy.current=false;setLoading(false);}}
 }
 return <><ToggleGroup type="single" value={filter} onValueChange={v=>{if(v&&v!==filter)void fetchPage(v as TopicFilter)}} className="tabs" aria-label="Nach Stand filtern">{[['alle','Alle'],['offen','Offen'],['entschieden','Entschieden']].map(([v,l])=><ToggleGroupItem key={v} value={v} className="tabs__tab">{l}</ToggleGroupItem>)}</ToggleGroup><div aria-busy={loading}>{topics.map((t,index)=><Fragment key={t.id}><article className={'topic'+(!index?' topic--lead':'')}><span className="topic__kicker">{t.category} · {regionName(t.regionId)}</span><h2 className="topic__title"><a href={'/thema/'+t.id}>{t.title}</a></h2>{t.image&&<img className="topic-image" src={t.image.src} alt={t.image.alt} loading="lazy"/>}<p className="topic__teaser">{t.shortSummary}</p><div className="topic__footer"><div className="topic__state"><div className="topic__status"><span className={'tag'+(['approved','rejected'].includes(t.status)?' tag--final':'')}>{STATUS[t.status].label}</span><ProcessProgress topic={t} compact/></div><span className="topic__meta">Aktualisiert {formatDate(t.updatedAt)} · {t.generatedBy}</span></div><WhatsApp id={t.id} title={t.title}/></div></article>{index===0&&filter==='alle'&&sessions.length>0&&<section className="sessions" aria-labelledby="demnaechst"><h2 id="demnaechst" className="section-title">Nächste Sitzungen</h2>{sessions.map(s=><a key={s.date+s.committee} className="session" href={'/thema/'+s.id}><span className="session__date"><span className="session__day">{new Intl.DateTimeFormat('de-DE',{day:'numeric',month:'numeric',timeZone:'Europe/Berlin'}).format(new Date(s.date))}</span></span><span className="session__body"><span className="session__title">{s.committee}</span><span className="session__topic">{s.title}</span></span><ChevronRight size={20}/></a>)}</section>}</Fragment>)}</div>{!topics.length&&!loading&&!error&&<div className="empty-state"><span className="empty-state__title">Keine Themen in dieser Auswahl</span><span className="empty-state__text">{initialPage.coverage.from?<>Erfasst sind Vorgänge seit {formatDate(initialPage.coverage.from)}.</>:<>Dieses Gebiet ist im NRW-Verzeichnis enthalten. Es sind noch keine politischen Vorgänge verfügbar.</>}</span></div>}{error&&<div className="feed-message" role="alert"><p>{error}</p>{stale?<a href={"/?region="+region}>Neu laden</a>:<Button variant="outline" onClick={()=>fetchPage(filter,topics.length>0)}>Erneut versuchen</Button>}</div>}{(cursor||loading)&&!stale&&<Button variant="outline" className="load-more" disabled={loading} onClick={()=>fetchPage(filter,true)}>{loading?'Themen werden geladen …':`Weitere Themen anzeigen (${Math.max(0,total-topics.length)})`}</Button>}<p className="sr-only" role="status">{topics.length} von {total} Themen geladen.</p><div className="export-footer"><a href={"/ueber?region="+region}>Über vor Ort</a><a href={"/quellen?region="+region}>So liest du den Verfahrensstand</a></div></>;
}
