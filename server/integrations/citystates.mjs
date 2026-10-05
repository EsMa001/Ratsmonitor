// Readers for the two city states. Both are one area in the catalog; their district assemblies keep their own systems.
//
// Hamburg (adapter "hamburg-transparenz"): the systems of the seven Bezirksversammlungen (sitzungsdienst-<bezirk>.hamburg.de)
// refuse programs in robots.txt. The Transparenzportal publishes their papers (Drucksachen) under the Hamburg
// Transparency Act (HmbTG) as datasets of an open CKAN interface, licence dl-de/by-2.0. This reader asks only that
// interface (package_search), after robots.txt of the portal allowed it. Links into the district systems are kept as
// links and never requested. The portal lists papers, not meetings: a topic carries the paper and its date of
// publication, no agenda and no result.
//
// Berlin (adapter "oparl-bezirke"): the twelve Bezirksverordnetenversammlungen publish their OParl interfaces as open
// data (daten.berlin.de) but refuse programs in robots.txt and with HTTP 403. Without a consent recorded in the catalog
// entry (consent: {by, date, scope}) it reads only districts whose robots.txt allows the OParl path (recorded by
// scripts/source-discovery/stadtstaaten.mjs and checked again before each import); with one, every listed district
// system. Each is read with the regional OParl reader; the district is named in each committee.
import {fetchText,text} from './sessionnet.mjs';
import {robotsGate} from './website.mjs';
import {windowStart} from './history-window.mjs';
import {budgeted} from './request-budget.mjs';
import {sourceDecision} from './source-fields.mjs';
import {category,hash,sourceSummary} from './oparl.mjs';
import {collectRegionalOparl} from './oparl-regional.mjs';

export const HAMBURG_DISTRICTS=['Altona','Bergedorf','Eimsbüttel','Hamburg-Mitte','Hamburg-Nord','Harburg','Wandsbek'];
export const HAMBURG_NOTE='Drucksachen der Bezirksversammlungen aus dem Transparenzportal; ohne Sitzungskalender, Tagesordnung und Ergebnis.';
export const BERLIN_CONSENT_MISSING='Freigabe fehlt: Die Systeme der Bezirksverordnetenversammlungen untersagen Programmen den Abruf (robots.txt, HTTP 403). Ohne eingetragene Freigabe wird nichts abgerufen.';
const API='api/3/action/package_search';
const ROWS=100,MAX_PAGES=10;
const RESTRICTED=/nicht\s*[-–]?\s*(?:ö|oe)ffentlich|vertraulich/i;
const norm=s=>String(s||'').toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').replace(/[^a-z0-9]/g,'');
const slug=s=>norm(s)||'x';
const isoDay=value=>{const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[1]}-${m[2]}-${m[3]}`:null;};
const extra=(pkg,keys)=>{for(const k of keys){const e=(pkg.extras||[]).find(x=>x&&x.key===k);if(e&&e.value)return String(e.value);if(pkg[k])return String(pkg[k]);}return '';};
const https=url=>{try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};

/** Query of one page of papers of a district, changed since the start of the period (CKAN/Solr syntax). */
export function hamburgQuery(source,district,fromDay,start=0){
 const p=new URLSearchParams({q:`title:"Bezirk ${district}" AND title:Drucksache`,fq:`metadata_modified:[${fromDay}T00:00:00Z TO *]`,sort:'metadata_modified desc',rows:String(ROWS),start:String(start)});
 return new URL(API+'?'+p,source.base).href;
}

/**
 * One dataset of the portal as a paper of the district, or null if it is none: the title names the district and a
 * paper number ("Bezirk Wandsbek, Drucksache 22-3451 …"), the dataset is not marked as restricted, and it has a date.
 * Date: date of publication of the register object where given, otherwise the creation of the dataset.
 */
export function hamburgPaper(pkg,district,source){
 if(!pkg||typeof pkg!=='object'||pkg.private===true||pkg.state&&pkg.state!=='active')return null;
 const title=String(pkg.title||'').replace(/\s+/g,' ').trim(),m=title.match(/^Bezirk\s+(.+?)\s*[,:]\s*Drucksache\s+(?:Nr\.?\s*)?(\d{1,2}-\d{1,6}(?:\.\d+)?)\b\s*[:,–-]?\s*(.*)$/i);
 if(!m||norm(m[1])!==norm(district))return null;
 const notes=text(pkg.notes||'');
 if(RESTRICTED.test(title)||RESTRICTED.test(extra(pkg,['registerobject_type','access'])))return null;
 const date=isoDay(extra(pkg,['publishing_date','date_published','temporal_coverage_from']))||isoDay(pkg.metadata_created);
 if(!date)return null;
 const reference=m[2],subject=(m[3]||'').trim()||(notes&&notes.length<=300?notes:'');
 const page=pkg.name?new URL('dataset/'+encodeURIComponent(pkg.name),source.base).href:null;
 const documents=[];
 for(const r of pkg.resources||[]){const url=https(r?.url);if(url)documents.push({title:String(r.name||r.description||'Drucksache').replace(/\s+/g,' ').trim().slice(0,160)||'Drucksache',url,kind:String(r.format||'').toLowerCase().includes('pdf')?'application/pdf':'html'});}
 if(page)documents.unshift({title:'Datensatz im Transparenzportal Hamburg',url:page,kind:'html'});
 if(!documents.length)return null;
 return {district,reference,title:subject||`Drucksache ${reference}`,notes:notes.slice(0,4000),date,url:page||documents[0].url,documents,modified:isoDay(pkg.metadata_modified)};
}

export async function collectHamburgTransparenz(source,{now=new Date(),get=fetchText,maxDurationMs=240000,onProgress=()=>{},window:lookback}={}){
 const fromDay=windowStart(now,lookback).toISOString().slice(0,10),today=now.toISOString().slice(0,10);
 const read=budgeted(get,maxDurationMs,2),issues=[],warnings=[],papers=new Map();
 const coverage=extra=>({regionId:source.id,method:'scraper',from:fromDay,to:today,importedAt:now.toISOString(),meetings:0,sourceCount:1,sourceUrl:source.base,note:HAMBURG_NOTE,...extra});
 // robots.txt of the portal decides before the first query; if it cannot be read, nothing is read.
 const allows=await robotsGate(read,source);
 if(!(await allows(new URL(API,source.base).href))){
  const why=allows.issues[0]||'robots.txt des Transparenzportals untersagt Programmen die Suchschnittstelle.';
  return {topics:[],marks:{},readMeetings:0,coverage:coverage({complete:false,quiet:false,issues:[why]})};
 }
 const districts=source.districts?.length?source.districts:HAMBURG_DISTRICTS;let foreign=0,limited=false;
 for(const district of districts){
  let found=0;
  try{
   for(let page=0;page<MAX_PAGES;page++){
    const body=JSON.parse(await read(hamburgQuery(source,district,fromDay,page*ROWS),source));
    if(body?.success!==true||!Array.isArray(body?.result?.results))throw Error('Unbekanntes Antwortformat der Suchschnittstelle');
    for(const pkg of body.result.results){const p=hamburgPaper(pkg,district,source);if(!p){foreign++;continue;}if(p.date<fromDay||p.date>today)continue;found++;papers.set(slug(p.district)+'-'+p.reference,p);}
    if(body.result.results.length<ROWS)break;
    if(page===MAX_PAGES-1&&Number(body.result.count)>(page+1)*ROWS)limited=true;
   }
   if(!found)warnings.push(`Keine Drucksache der Bezirksversammlung ${district} im Zeitraum gefunden.`);
  }catch(e){issues.push(`Bezirk ${district}: ${e.message}`);}
  onProgress(`${source.id}: Bezirk ${district}, ${found} Drucksachen`);
 }
 if(limited)issues.push(`Mehr als ${ROWS*MAX_PAGES} geänderte Datensätze je Bezirk; ein kürzerer Zeitraum liest sie vollständig.`);
 const topics=[];
 for(const [key,p] of papers){
  const committee='Bezirksversammlung '+p.district,status='unknown';
  const event={date:p.date,committee,status,description:'Drucksache im Transparenzportal veröffentlicht; Sitzung und Ergebnis sind dort nicht angegeben.',result:'',url:p.url,publicEvidence:'Veröffentlicht im Transparenzportal Hamburg (HmbTG, dl-de/by-2.0)',attendance:{status:'not_collected',sourceUrl:p.url,fetchedAt:now.toISOString(),people:[]}};
  event.decision=sourceDecision(event);
  const t={id:`${source.id}-hh-${key}`,regionId:source.id,source:source.kind,public:true,title:p.title,officialTitle:p.title,reference:p.reference,category:category(p.title),status,committee,eventDate:p.date,updatedAt:now.toISOString(),
   relevanceReason:'Öffentliche Drucksache: Bezirksversammlung '+p.district,sourceText:[p.title,'Drucksache '+p.reference+' der Bezirksversammlung '+p.district,p.notes].filter(Boolean).join('\n'),
   identityLinks:[p.url],events:[event],documents:p.documents,sourceUrl:p.url,
   sourceData:{version:'public-source-fields-v1',method:'hamburg-transparenz',fetchedAt:now.toISOString(),records:[{kind:'paper',url:p.url,fields:{reference:p.reference,district:p.district,published:p.date,modified:p.modified}}],detailStatus:'completed',issues:[]}};
  Object.assign(t,sourceSummary(t));if(t.longSummary?.[0])t.longSummary[0]=t.longSummary[0].replace('in Münster','in Hamburg-'+p.district.replace(/^Hamburg-/,''));
  t.quality={passed:false,checks:[{name:'Originalquelle',passed:true,detail:'Transparenzportal Hamburg; nur veröffentlichte Drucksachen der Bezirksversammlungen.'},{name:'Inhaltliche Prüfung',passed:false,detail:'Automatischer Quellenüberblick, keine geprüfte KI-Zusammenfassung.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText)};
  topics.push(t);
 }
 if(foreign)warnings.push(`${foreign} Treffer der Suche sind keine Drucksache des gesuchten Bezirks und wurden ausgelassen.`);
 return {topics,marks:{},readMeetings:0,coverage:coverage({papers:topics.length,...(warnings.length?{warnings}:{}),quiet:topics.length===0&&issues.length===0,complete:issues.length===0&&topics.length>0,issues:topics.length?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.']})};
}

/** A consent recorded in the catalog entry: who gave it, when, and that it covers the OParl interfaces. */
export function consentValid(consent){
 return Boolean(consent&&typeof consent==='object'&&String(consent.by||'').trim()&&/^\d{4}-\d{2}-\d{2}$/.test(String(consent.date||''))&&/oparl|robots/i.test(String(consent.scope||'')));
}

/**
 * Districts that may be read: with a valid consent every listed system; without one only those whose robots.txt the
 * check script found to allow the OParl path (robots: 'erlaubt'). robots.txt is read again before each import.
 */
export function eligibleSystems(source){
 const systems=(source.systems||[]).filter(s=>s&&s.district&&https(s.system));
 return consentValid(source.consent)?systems:systems.filter(s=>s.robots==='erlaubt');
}
export async function collectOparlDistricts(source,options={}){
 const now=options.now||new Date(),fromDay=windowStart(now,options.window).toISOString().slice(0,10),get=options.get||fetchText;
 const consent=consentValid(source.consent),listed=(source.systems||[]).filter(s=>s&&s.district&&https(s.system));
 const empty=issues=>({topics:[],marks:{},readMeetings:0,coverage:{regionId:source.id,method:'oparl',from:fromDay,to:now.toISOString().slice(0,10),importedAt:now.toISOString(),meetings:0,sourceCount:0,complete:false,quiet:false,issues,sourceUrl:source.base||''}});
 if(!listed.length)return empty(['Keine OParl-Adresse eines Bezirks eingetragen (scripts/source-discovery/stadtstaaten.mjs berlin).']);
 const systems=eligibleSystems(source);
 if(!systems.length)return empty([BERLIN_CONSENT_MISSING]);
 const topics=[],marks={},issues=[],warnings=[];let meetings=0,read=0,complete=true,resumable=false,used=0;
 for(const s of systems){
  try{
   // Without consent robots.txt decides again before the first request to the district system.
   if(!consent){const origin=new URL(s.system).origin,allows=await robotsGate(get,{base:origin+'/'});if(!(await allows(s.system))){issues.push(`BVV ${s.district}: `+(allows.issues[0]||'robots.txt untersagt den Abruf der OParl-Schnittstelle; nichts gelesen.'));complete=false;continue;}}
   const d=await collectRegionalOparl({...source,name:'BVV '+s.district,system:s.system,...(s.body?{body:s.body}:{})},options);used++;
   for(const t of d.topics){t.committee=prefix(s.district,t.committee);for(const e of t.events||[])e.committee=prefix(s.district,e.committee);topics.push(t);}
   Object.assign(marks,d.marks||{});meetings+=d.coverage.meetings||0;read+=d.readMeetings||0;
   if(!d.coverage.complete)complete=false;if(d.coverage.resumable)resumable=true;
   issues.push(...(d.coverage.issues||[]).filter(i=>!/^Noch keine Artikel/.test(i)).map(i=>`BVV ${s.district}: ${i}`));
  }catch(e){complete=false;issues.push(`BVV ${s.district}: ${e.message}`);}
 }
 const left=12-systems.length;if(left>0)warnings.push(`${left} von 12 Bezirken nicht gelesen (${consent?'keine OParl-Adresse eingetragen':'ohne Freigabe; robots.txt untersagt den Abruf oder keine Adresse'}).`);
 return {topics,marks,readMeetings:read,coverage:{regionId:source.id,method:'oparl',from:fromDay,to:now.toISOString().slice(0,10),importedAt:now.toISOString(),meetings,sourceCount:used,...(resumable?{resumable:true}:{}),...(warnings.length?{warnings}:{}),...(consent?{consent:{by:source.consent.by,date:source.consent.date}}:{}),quiet:topics.length===0&&issues.length===0,complete:complete&&issues.length===0&&topics.length>0&&left===0,issues:topics.length?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.'],sourceUrl:systems[0].system}};
}
const prefix=(district,committee)=>{const c=String(committee||'').trim();return norm(c).includes(norm(district))?c:`BVV ${district}: ${c||'Öffentliche Sitzung'}`;};
