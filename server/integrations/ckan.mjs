// CKAN, the software of many open-data portals (Transparenzportal Hamburg, daten.berlin.de, GovData …): a generic
// connector for its action API (docs.ckan.org/en/latest/api/), as oparl.mjs is for OParl. A portal offers this API for
// programs, so robots.txt, which governs the crawling of its HTML pages, does not decide over it
// (shared/source-access.mjs). Every request goes through the reader's fetch (project User-Agent, time budget, at most
// two requests per server); a refusal (HTTP 401/403, or 429 after the budget's one retry) ends every further request
// to the portal in this import.
//
// - ckanSession(base, read): package_search over all pages of a query (100 rows, at most 10 pages), answers checked.
// - ckanExtra, ckanLinks, ckanActive: the fields of a dataset the readers use.
// - detectCkan(url, html), probeCkan(base, get): recognise a portal from one of its pages; confirm it by status_show.
// - collectCkan(source): generic reader of a catalog entry {adapter:'ckan', base, ckan:{queries:[{label, q, fq}],
//   committee, dateFields}}. Every public dataset the queries find and that was published in the period becomes a
//   topic with title, description, date and documents. Without queries nothing is read: which datasets of a portal are
//   council information is laid down per portal (its profile), as for Hamburg (citystates.mjs).
import {fetchText,text} from './sessionnet.mjs';
import {windowStart} from './history-window.mjs';
import {budgeted} from './request-budget.mjs';
import {sourceDecision} from './source-fields.mjs';
import {category,hash,sourceSummary} from './oparl.mjs';

export const CKAN_API='api/3/action/';
export const CKAN_ROWS=100,CKAN_MAX_PAGES=10;
export const CKAN_NOTE='Datensätze eines Open-Data-Portals (CKAN) nach dem Abfrageprofil des Eintrags; ohne Sitzung und Ergebnis.';
export const CKAN_NO_PROFILE='CKAN-Portal erkannt (API verfügbar), Leser/Connector fehlt: Abfrageprofil für die Ratsdaten noch nicht festgelegt.';
const RESTRICTED=/nicht\s*[-–]?\s*(?:ö|oe)ffentlich|vertraulich/i;
const slug=s=>String(s||'').toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'x';
const isoDay=value=>{const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[1]}-${m[2]}-${m[3]}`:null;};
const https=url=>{try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};

/** Address of an action of the API (status_show, package_search …) below the portal's base. */
export const ckanUrl=(base,action,params={})=>new URL(CKAN_API+action+(Object.keys(params).length?'?'+new URLSearchParams(params):''),base).href;
/** Address of one page of package_search (CKAN/Solr syntax: q, fq; newest change first). */
export function ckanSearchUrl(base,{q='*:*',fq='',sort='metadata_modified desc',rows=CKAN_ROWS,start=0}={}){
 return ckanUrl(base,'package_search',{q,...(fq?{fq}:{}),sort,rows:String(rows),start:String(start)});
}
/** The value of an extra field of a dataset, or of the dataset's own field of that name; '' if none. */
export const ckanExtra=(pkg,keys)=>{for(const k of keys){const e=(pkg?.extras||[]).find(x=>x&&x.key===k);if(e&&e.value)return String(e.value);if(pkg?.[k])return String(pkg[k]);}return '';};
/** A public, active dataset (not private, not deleted). */
export const ckanActive=pkg=>!!pkg&&typeof pkg==='object'&&pkg.private!==true&&(!pkg.state||pkg.state==='active');
/**
 * The page of a dataset in the portal, and its documents: that page first, then the resources with an https address
 * (linked, never requested). fallback: title of a resource without name; pageTitle: title of the dataset page.
 */
export function ckanLinks(pkg,base,{fallback='Dokument',pageTitle='Datensatz im Portal'}={}){
 const page=pkg?.name?new URL('dataset/'+encodeURIComponent(pkg.name),base).href:null,documents=[];
 for(const r of pkg?.resources||[]){const url=https(r?.url);if(url)documents.push({title:String(r.name||r.description||fallback).replace(/\s+/g,' ').trim().slice(0,160)||fallback,url,kind:String(r.format||'').toLowerCase().includes('pdf')?'application/pdf':'html'});}
 if(page)documents.unshift({title:pageTitle,url:page,kind:'html'});
 return {page,documents};
}
/** A refusal of the portal: HTTP 401/403, or 429 after the budget's one retry. */
export const ckanRefused=e=>/HTTP (?:401|403|429)\b/.test(String(e?.message||e));
/** Whether an answer comes from the action API (success flag and result). */
export const isCkanAnswer=body=>body?.success===true&&!!body.result&&typeof body.result==='object';

/**
 * A search session over one portal. search(label, query, take) reads all pages of package_search for one query and
 * hands every dataset to take, which says whether it was of the kind asked for (the others count in state.foreign).
 * query: the parameters of ckanSearchUrl, or a function start → address of that page (100 rows each).
 * A refusal ends the session (state.shut): no further request to the portal in this import.
 * @param {string} base
 * @param {(url:string,source:object)=>Promise<string>} read
 * @param {object} source
 * @param {{portal?:string}} [names]
 */
export function ckanSession(base,read,source,{portal='Das Portal'}={}){
 const state={issues:[],foreign:0,limited:false,shut:false};
 const search=async(label,query,take)=>{
  const rows=typeof query==='function'?CKAN_ROWS:query.rows||CKAN_ROWS,address=start=>typeof query==='function'?query(start):ckanSearchUrl(base,{...query,rows,start});
  for(let page=0;page<CKAN_MAX_PAGES&&!state.shut;page++){
   let body;
   try{body=JSON.parse(await read(address(page*rows),source));}
   catch(e){state.issues.push(`${label}: ${e.message}`);if(ckanRefused(e)){state.shut=true;state.issues.push(`${portal} hat den Abruf abgewiesen; in diesem Import keine weiteren Anfragen dorthin.`);}return;}
   if(!isCkanAnswer(body)||!Array.isArray(body.result.results)){state.issues.push(`${label}: Unbekanntes Antwortformat der Suchschnittstelle`);return;}
   for(const pkg of body.result.results)if(!take(pkg))state.foreign++;
   if(body.result.results.length<rows)return;
   if(page===CKAN_MAX_PAGES-1&&Number(body.result.count)>(page+1)*rows)state.limited=true;
  }
 };
 return {search,state};
}

/**
 * A CKAN portal recognised from one of its pages: the generator tag of CKAN ("ckan 2.9.5"), or the body attributes
 * every CKAN page template sets (data-site-root with data-locale-root). {base} (the site root) or null.
 */
export function detectCkan(url,html){
 const h=String(html||'');
 const generator=[...h.matchAll(/<meta\b[^>]*>/gi)].some(m=>/\bname=["']generator["']/i.test(m[0])&&/\bcontent=["']ckan\b/i.test(m[0]));
 const body=h.match(/<body\b[^>]*>/i)?.[0]||'',root=body.match(/\bdata-site-root=["']([^"']+)["']/i);
 if(!generator&&!(root&&/\bdata-locale-root=/i.test(body)))return null;
 let base;try{base=new URL(root?root[1]:'/',url).href;}catch{return null;}
 if(!/^https:/.test(base))return null;
 return {base:base.endsWith('/')?base:base+'/'};
}
/** Confirms a portal by its status_show action: {version, title}, or null (no CKAN, no answer). One request. */
export async function probeCkan(base,get=fetchText){
 try{const body=JSON.parse(await get(ckanUrl(base,'status_show'),{base}));return isCkanAnswer(body)&&body.result.ckan_version?{version:String(body.result.ckan_version),title:String(body.result.site_title||'')}:null;}
 catch{return null;}
}

/**
 * Generic reader of a CKAN portal by the query profile of its catalog entry (see above). Date of a dataset: the first
 * of profile.dateFields (default: publishing_date, date_published, issued), otherwise its creation in the portal.
 */
export async function collectCkan(source,{now=new Date(),get=fetchText,maxDurationMs=120000,onProgress=()=>{},window:lookback}={}){
 const fromDay=windowStart(now,lookback).toISOString().slice(0,10),today=now.toISOString().slice(0,10);
 const profile=source.ckan||{},queries=(profile.queries||[]).filter(q=>q&&(q.q||q.fq));
 const coverage=extra=>({regionId:source.id,method:'scraper',from:fromDay,to:today,importedAt:now.toISOString(),meetings:0,sourceCount:1,sourceUrl:source.base,note:CKAN_NOTE,...extra});
 if(!queries.length)return {topics:[],marks:{},readMeetings:0,coverage:coverage({complete:false,quiet:false,issues:[CKAN_NO_PROFILE]})};
 const read=budgeted(get,maxDurationMs,2),{search,state}=ckanSession(source.base,read,source),found=new Map();
 const changed=`metadata_modified:[${fromDay}T00:00:00Z TO *]`,dateFields=profile.dateFields||['publishing_date','date_published','issued'];
 for(const query of queries){
  if(state.shut)break;
  await search(query.label||query.q||query.fq,{q:query.q||'*:*',fq:[query.fq,changed].filter(Boolean).join(' AND ')},pkg=>{
   if(!ckanActive(pkg))return false;
   const title=String(pkg.title||'').replace(/\s+/g,' ').trim();if(!title||RESTRICTED.test(title))return false;
   const date=isoDay(ckanExtra(pkg,dateFields))||isoDay(pkg.metadata_created);if(!date)return false;
   const {page,documents}=ckanLinks(pkg,source.base);if(!documents.length)return false;
   if(date>=fromDay&&date<=today)found.set(pkg.name||pkg.id,{pkg,title,date,page,documents});
   return true;
  });
  onProgress(`${source.id}: ${query.label||'Abfrage'}, ${found.size} Datensätze`);
 }
 if(state.limited)state.issues.push(`Mehr als ${CKAN_ROWS*CKAN_MAX_PAGES} geänderte Datensätze je Abfrage; ein kürzerer Zeitraum liest sie vollständig.`);
 const topics=[],fetchedAt=now.toISOString(),committee=profile.committee||'Offene Daten';
 for(const [key,{pkg,title,date,page,documents}] of found){
  const url=page||documents[0].url,notes=text(pkg.notes||'').slice(0,4000),reference=ckanExtra(pkg,['number']).trim(),status='unknown';
  const event={date,committee,status,description:'Datensatz im Open-Data-Portal veröffentlicht; Beratung und Ergebnis sind dort nicht angegeben.',result:'',url,publicEvidence:'Veröffentlicht im Open-Data-Portal'+(pkg.license_id?` (${pkg.license_id})`:''),attendance:{status:'not_collected',sourceUrl:url,fetchedAt,people:[]}};
  event.decision=sourceDecision(event);
  const t={id:`${source.id}-ckan-${slug(key)}`,regionId:source.id,source:source.kind,public:true,title,officialTitle:title,reference,category:category(title),status,committee,eventDate:date,updatedAt:fetchedAt,
   relevanceReason:'Öffentlicher Datensatz: '+committee,sourceText:[title,reference&&'Nummer '+reference,notes].filter(Boolean).join('\n'),identityLinks:[url],events:[event],documents,sourceUrl:url,
   sourceData:{version:'public-source-fields-v1',method:'ckan',fetchedAt,records:[{kind:'dataset',url,fields:{name:pkg.name||'',reference,published:date,modified:isoDay(pkg.metadata_modified)}}],detailStatus:'completed',issues:[]}};
  Object.assign(t,sourceSummary(t));if(t.longSummary?.[0])t.longSummary[0]=t.longSummary[0].replace('in Münster','in '+(source.name||'dem Gebiet'));
  t.quality={passed:false,checks:[{name:'Originalquelle',passed:true,detail:'Open-Data-Portal (CKAN) nach dem Abfrageprofil des Eintrags.'},{name:'Inhaltliche Prüfung',passed:false,detail:'Automatischer Quellenüberblick, keine geprüfte KI-Zusammenfassung.'}],checkedAt:fetchedAt,sourceHash:await hash(t.sourceText)};
  topics.push(t);
 }
 const warnings=state.foreign?[`${state.foreign} Treffer der Suche ohne Titel, Datum oder Link, nicht öffentlich oder gelöscht; ausgelassen.`]:[];
 return {topics,marks:{},readMeetings:0,coverage:coverage({papers:topics.length,...(warnings.length?{warnings}:{}),quiet:topics.length===0&&state.issues.length===0,complete:state.issues.length===0&&topics.length>0,issues:topics.length?state.issues:[...state.issues,'Noch keine Artikel erfolgreich erfasst.']})};
}
