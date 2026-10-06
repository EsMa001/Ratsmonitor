// Readers for the two city states. Both are one area in the catalog; their district assemblies keep their own systems.
//
// Both read interfaces offered for programs: the CKAN API of the Transparenzportal (ckan.mjs), the open-data file of the
// Abgeordnetenhaus and the OParl interfaces of the Berlin districts. robots.txt governs the crawling of HTML pages and
// never decides over them, not even with ROBOTS_POLICY=obey (shared/source-access.mjs; robots.mjs records its verdict).
// A technical refusal (HTTP 401/403, a firewall) still ends the reading of that system.
//
// Hamburg (adapter "hamburg-transparenz"): the systems of the seven Bezirksversammlungen (sitzungsdienst-<bezirk>.hamburg.de)
// refuse programs in robots.txt. The Transparenzportal publishes under the Hamburg Transparency Act (HmbTG) as datasets of
// an open CKAN interface, licence dl-de/by-2.0 (notes on the interface: transparenz.hamburg.de/api-796358): the papers
// (Drucksachen) of the district assemblies, their meetings with the public items of the agenda (published with the
// minutes, weeks after the meeting) and the communications of the Senate to the Bürgerschaft. This reader asks only that
// interface (package_search, filtered by the type of register object). Links into the district systems and to the
// Bürgerschaft's database are kept as links and never requested. A paper carries its date of publication, an agenda item
// the day of its meeting; neither carries a result. Decisions and minutes of the Senate (senatpetitum) are not read.
//
// Berlin (adapter "oparl-bezirke"): the twelve Bezirksverordnetenversammlungen publish their OParl interfaces as open
// data (daten.berlin.de); their systems answered programs with HTTP 403 (05.10.2026). With a consent recorded in the
// catalog entry (consent: {by, date, scope}) every listed district system is read, without one every system that does
// not refuse technically (eligibleSystems). Each is read with the regional OParl reader; the district is named in each
// committee.
import {fetchText,text} from './sessionnet.mjs';
import {isNonPublicText} from './website-text.mjs';
import {ckanSearchUrl,ckanExtra,ckanLinks,ckanActive,ckanSession,CKAN_ROWS,CKAN_MAX_PAGES} from './ckan.mjs';
import {windowStart} from './history-window.mjs';
import {budgeted} from './request-budget.mjs';
import {sourceDecision} from './source-fields.mjs';
import {category,hash,sourceSummary} from './oparl.mjs';
import {collectRegionalOparl} from './oparl-regional.mjs';
import {fetchNoRedirect,SOURCE_USER_AGENT} from './no-redirect.mjs';

export const HAMBURG_DISTRICTS=['Altona','Bergedorf','Eimsbüttel','Hamburg-Mitte','Hamburg-Nord','Harburg','Wandsbek'];
export const HAMBURG_NOTE='Drucksachen und Sitzungen mit öffentlicher Tagesordnung der Bezirksversammlungen sowie Mitteilungen des Senats an die Bürgerschaft aus dem Transparenzportal; Sitzungen erst mit der Niederschrift, ohne Ergebnis.';
export const BERLIN_CONSENT_MISSING='Freigabe fehlt: Die Systeme der Bezirksverordnetenversammlungen sperren Programme technisch aus (HTTP 403). Ohne eingetragene Freigabe wird nichts abgerufen.';
const RESTRICTED=/nicht\s*[-–]?\s*(?:ö|oe)ffentlich|vertraulich/i;
const norm=s=>String(s||'').toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').replace(/[^a-z0-9]/g,'');
const slug=s=>norm(s)||'x';
const isoDay=value=>{const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[1]}-${m[2]}-${m[3]}`:null;};
const extra=ckanExtra;
const https=url=>{try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
const fnv=value=>{let h=0x811c9dc5;for(const c of new TextEncoder().encode(value)){h^=c;h=Math.imul(h,0x01000193);}return (h>>>0).toString(16).padStart(8,'0');};

/**
 * Query of one page of register objects of a district, changed since the start of the period (CKAN/Solr syntax):
 * papers (kind "Drucksache") or meetings (kind "Sitzung"). Both are register objects of the type "beschluss" (field
 * registerobject_type, filter fq as the portal's API notes describe: transparenz.hamburg.de/api-796358).
 */
export function hamburgQuery(source,district,fromDay,start=0,kind='Drucksache'){
 return ckanSearchUrl(source.base,{q:`title:"Bezirk ${district}" AND title:${kind}`,fq:`extras_registerobject_type:beschluss AND metadata_modified:[${fromDay}T00:00:00Z TO *]`,start});
}
/** Query of one page of communications of the Senate to the Bürgerschaft (type "senatmitteil") changed in the period. */
export function hamburgSenateQuery(source,fromDay,start=0){
 return ckanSearchUrl(source.base,{q:'*:*',fq:`extras_registerobject_type:senatmitteil AND metadata_modified:[${fromDay}T00:00:00Z TO *]`,start});
}
// Links of a dataset: the page of the dataset in the portal first, then its resources (only https addresses; documents in
// the district systems and in the Bürgerschaft's database are linked, never requested).
const links=(pkg,source,fallback)=>ckanLinks(pkg,source.base,{fallback,pageTitle:'Datensatz im Transparenzportal Hamburg'});
// A public, active dataset whose register object is of the type asked for, where it names one: the portal stores
// "beschluesse" and "senatmitteilungen" and indexes them stemmed ("beschluss", "senatmitteil" in the queries).
const usable=(pkg,type)=>{if(!ckanActive(pkg))return false;const t=extra(pkg,['registerobject_type']);return !t||type.test(t);};

/**
 * One dataset of the portal as a paper of the district, or null if it is none: the title names the district and a
 * paper number ("Bezirk Wandsbek, Drucksache 22-3451 …"), the dataset is not marked as restricted, and it has a date.
 * Date: date of publication of the register object where given, otherwise the creation of the dataset.
 */
export function hamburgPaper(pkg,district,source){
 if(!usable(pkg,/^beschl/i))return null;
 const title=String(pkg.title||'').replace(/\s+/g,' ').trim(),m=title.match(/^Bezirk\s+(.+?)\s*[,:]\s*Drucksache\s+(?:Nr\.?\s*)?(\d{1,2}-\d{1,6}(?:\.\d+)?)\b\s*[:,–-]?\s*(.*)$/i);
 if(!m||norm(m[1])!==norm(district))return null;
 const notes=text(pkg.notes||'');
 if(RESTRICTED.test(title)||RESTRICTED.test(extra(pkg,['registerobject_type','access'])))return null;
 const date=isoDay(extra(pkg,['publishing_date','date_published','temporal_coverage_from']))||isoDay(pkg.metadata_created);
 if(!date)return null;
 const reference=m[2],subject=(m[3]||'').trim()||(notes&&notes.length<=300?notes:'');
 const {page,documents}=links(pkg,source,'Drucksache');
 if(!documents.length)return null;
 return {district,reference,title:subject||`Drucksache ${reference}`,notes:notes.slice(0,4000),date,url:page||documents[0].url,documents,modified:isoDay(pkg.metadata_modified)};
}

// A meeting of a district body: "Bezirk Hamburg-Nord, SI/2026/576 Sitzung des Hauptausschusses vom 25.08.2026" (the
// date in the title is used only where the dataset has no period). The body is named in the genitive; the reader names
// it as such: "Hauptausschuss", "Regionalausschuss Kerngebiet Wandsbek", the assembly itself as "Bezirksversammlung <district>".
const MEETING=/^Bezirk\s+(.+?)\s*,\s*(\S+)\s+Sitzung\s+(?:des|der)\s+(.+?)(?:\s+vom\s+(\d{1,2}\.\d{1,2}\.(?:\d{4})?)\s*)?$/i;
const bodyName=(phrase,district)=>{
 // Only the head noun: "Unterausschusses für Bauangelegenheiten des Regionalausschusses Rahlstedt" names the
 // "Unterausschuss … des Regionalausschusses Rahlstedt". A leading abbreviation ("(EWi) Unterausschuss …") is dropped.
 const b=phrase.replace(/\s+-\s+DIGITAL\b.*$/i,'').replace(/\s+/g,' ').trim().replace(/^\([^)]{1,12}\)\s*/,'').replace(/(ausschuss|beirat|rat)(?:es|s)\b/i,'$1');
 return /^Bezirksversammlung\b/i.test(b)?'Bezirksversammlung '+district:`${b} (Bezirk ${district})`;
};
// The list of agenda items names an item of the non-public part only as "(nichtöffentlich)" or "(vertraulich)"; such an
// entry, and any title that names the non-public part, is left out (website-text.mjs isNonPublicText).
const PLACEHOLDER=/^\(?\s*(?:nicht\s*[-–]?\s*(?:ö|oe)ffentlich|vertraulich)\s*\)?\.?$/i;
/**
 * One dataset of the portal as a meeting of a district body with the public items of its agenda, or null if it is none:
 * the title names the district, a meeting number and the body; the date of the meeting is the start of the dataset's
 * period (temporal_coverage_from) or the date in the title; the items stand in its description ("Tagesordnungspunkte: …;
 * …"). The portal publishes a meeting once its minutes are approved; date: the publication of the dataset.
 */
export function hamburgMeeting(pkg,district,source){
 if(!usable(pkg,/^beschl/i))return null;
 const title=String(pkg.title||'').replace(/\s+/g,' ').trim(),m=title.match(MEETING);
 if(!m||norm(m[1])!==norm(district)||RESTRICTED.test(m[3]))return null;
 const meetingDay=isoDay(extra(pkg,['temporal_coverage_from']))||(m[4]&&/\.\d{4}$/.test(m[4])?m[4].split('.').reverse().map(x=>x.padStart(2,'0')).join('-'):null);
 const published=isoDay(extra(pkg,['publishing_date','date_published']))||isoDay(pkg.metadata_created);
 if(!meetingDay||!published)return null;
 const number=extra(pkg,['number']).trim()||m[2];
 let left=0;const items=[],seen=new Set();
 for(const raw of text(String(pkg.notes||'').replace(/^\s*Tagesordnungspunkte\s*:\s*/i,'')).split(/\s*;\s*/)){
  const item=raw.replace(/\s+/g,' ').trim();if(!item)continue;
  if(PLACEHOLDER.test(item)||isNonPublicText(item)){left++;continue;}
  if(!seen.has(item)){seen.add(item);items.push(item);}
 }
 const {page,documents}=links(pkg,source,'Sitzungsprotokoll');
 if(!documents.length)return null;
 return {district,number,committee:bodyName(m[3],district),date:meetingDay,published,items,left,url:page||documents[0].url,documents,modified:isoDay(pkg.metadata_modified)};
}

/**
 * One dataset of the portal as a communication of the Senate to the Bürgerschaft (a paper of the Bürgerschaft), or null
 * if it is none: it carries the number of a paper of the Bürgerschaft ("23/5267"); other communications of the Senate
 * (the Bundesrat votes) have none and are left out. Date: publication of the register object.
 */
export function hamburgSenatePaper(pkg,source){
 if(!usable(pkg,/^senatmitteil/i))return null;
 const reference=extra(pkg,['number']).trim();if(!/^\d{1,2}\/\d{1,6}$/.test(reference))return null;
 const title=String(pkg.title||'').replace(/\s+/g,' ').trim();if(!title||RESTRICTED.test(title))return null;
 const date=isoDay(extra(pkg,['publishing_date','date_published']))||isoDay(pkg.metadata_created);if(!date)return null;
 const {page,documents}=links(pkg,source,'Drucksache '+reference);
 if(!documents.length)return null;
 return {reference,title,notes:text(pkg.notes||'').slice(0,4000),date,url:page||documents[0].url,documents,modified:isoDay(pkg.metadata_modified)};
}

// A refusal (HTTP 401/403, or 429 after the budget's one retry) ends the reading of that server for this import: no
// further request goes there, also not for the next district or period.
const refusedBy=e=>/HTTP (?:401|403|429)\b/.test(String(e?.message||e));

export async function collectHamburgTransparenz(source,{now=new Date(),get=fetchText,maxDurationMs=240000,onProgress=()=>{},window:lookback}={}){
 const fromDay=windowStart(now,lookback).toISOString().slice(0,10),today=now.toISOString().slice(0,10);
 const read=budgeted(get,maxDurationMs,2),warnings=[],papers=new Map(),meetings=new Map(),senate=new Map();
 const coverage=extra=>({regionId:source.id,method:'scraper',from:fromDay,to:today,importedAt:now.toISOString(),meetings:0,sourceCount:1,sourceUrl:source.base,note:HAMBURG_NOTE,...extra});
 // The portal documents its search interface for automated retrieval (transparenz.hamburg.de/api-796358); robots.txt,
 // which disallows it for crawlers, does not decide over it (shared/source-access.mjs). All pages of one query; each
 // dataset goes to take (true: it was one of the kind asked for); a refusal ends every request to the portal.
 const {search:query,state}=ckanSession(source.base,read,source,{portal:'Das Transparenzportal'}),issues=state.issues;
 const districts=source.districts?.length?source.districts:HAMBURG_DISTRICTS,quietDistricts=[];
 for(const district of districts){
  if(state.shut)break;
  let found=0,held=0;
  await query(`Bezirk ${district}`,start=>hamburgQuery(source,district,fromDay,start),pkg=>{const p=hamburgPaper(pkg,district,source);if(!p)return false;if(p.date>=fromDay&&p.date<=today){found++;papers.set(slug(p.district)+'-'+p.reference,p);}return true;});
  if(!state.shut&&!found&&!issues.some(i=>i.startsWith(`Bezirk ${district}:`)))warnings.push(`Keine Drucksache der Bezirksversammlung ${district} im Zeitraum gefunden.`);
  // Meetings published in the period (after their minutes were approved); the event is the day of the meeting.
  if(!state.shut)await query(`Sitzungen Bezirk ${district}`,start=>hamburgQuery(source,district,fromDay,start,'Sitzung'),pkg=>{const s=hamburgMeeting(pkg,district,source);if(!s)return false;if(s.published>=fromDay&&s.published<=today&&s.date<=today&&s.items.length){held++;meetings.set(slug(district)+'-'+slug(s.number),s);}return true;});
  if(!state.shut&&!held&&!issues.some(i=>i.startsWith(`Sitzungen Bezirk ${district}:`)))quietDistricts.push(district);
  onProgress(`${source.id}: Bezirk ${district}, ${found} Drucksachen, ${held} Sitzungen`);
 }
 if(quietDistricts.length)warnings.push(`Keine Sitzung mit öffentlicher Tagesordnung im Zeitraum veröffentlicht: ${quietDistricts.join(', ')}.`);
 // The communications of the Senate to the Bürgerschaft (papers of the city-state's parliament).
 if(!state.shut)await query('Mitteilungen des Senats',start=>hamburgSenateQuery(source,fromDay,start),pkg=>{const p=hamburgSenatePaper(pkg,source);if(!p)return false;if(p.date>=fromDay&&p.date<=today)senate.set(slug(p.reference),p);return true;});
 if(state.limited)issues.push(`Mehr als ${CKAN_ROWS*CKAN_MAX_PAGES} geänderte Datensätze je Abfrage; ein kürzerer Zeitraum liest sie vollständig.`);
 const topics=[],fetchedAt=now.toISOString(),checks=detail=>[{name:'Originalquelle',passed:true,detail},{name:'Inhaltliche Prüfung',passed:false,detail:'Automatischer Quellenüberblick, keine geprüfte KI-Zusammenfassung.'}];
 const topic=async(t,place,detail)=>{
  t.events.forEach(e=>{e.attendance={status:'not_collected',sourceUrl:e.url,fetchedAt,people:[]};e.decision=sourceDecision(e);});
  Object.assign(t,sourceSummary(t));if(t.longSummary?.[0])t.longSummary[0]=t.longSummary[0].replace('in Münster','in '+place);
  t.quality={passed:false,checks:checks(detail),checkedAt:fetchedAt,sourceHash:await hash(t.sourceText)};topics.push(t);
 };
 for(const [key,p] of papers){
  const committee='Bezirksversammlung '+p.district,status='unknown';
  const event={date:p.date,committee,status,description:'Drucksache im Transparenzportal veröffentlicht; Sitzung und Ergebnis sind dort nicht angegeben.',result:'',url:p.url,publicEvidence:'Veröffentlicht im Transparenzportal Hamburg (HmbTG, dl-de/by-2.0)'};
  await topic({id:`${source.id}-hh-${key}`,regionId:source.id,source:source.kind,public:true,title:p.title,officialTitle:p.title,reference:p.reference,category:category(p.title),status,committee,eventDate:p.date,updatedAt:fetchedAt,
   relevanceReason:'Öffentliche Drucksache: Bezirksversammlung '+p.district,sourceText:[p.title,'Drucksache '+p.reference+' der Bezirksversammlung '+p.district,p.notes].filter(Boolean).join('\n'),
   identityLinks:[p.url],events:[event],documents:p.documents,sourceUrl:p.url,
   sourceData:{version:'public-source-fields-v1',method:'hamburg-transparenz',fetchedAt,records:[{kind:'paper',url:p.url,fields:{reference:p.reference,district:p.district,published:p.date,modified:p.modified}}],detailStatus:'completed',issues:[]}},
   'Hamburg-'+p.district.replace(/^Hamburg-/,''),'Transparenzportal Hamburg; nur veröffentlichte Drucksachen der Bezirksversammlungen.');
 }
 let left=0;
 for(const [key,s] of meetings){
  left+=s.left;
  for(const item of s.items){
   const status='unknown',event={date:s.date,committee:s.committee,status,description:`Öffentlicher Tagesordnungspunkt; das Ergebnis steht im Protokoll der Sitzung (${s.number}), verlinkt, nicht eingelesen.`,result:'',url:s.url,publicEvidence:'Öffentliche Tagesordnung im Transparenzportal Hamburg (HmbTG, dl-de/by-2.0); Punkte des nichtöffentlichen Teils fehlen dort oder stehen nur als „(nichtöffentlich)“'};
   await topic({id:`${source.id}-hh-${key}-${fnv(item)}`,regionId:source.id,source:source.kind,public:true,title:item,officialTitle:item,reference:'',category:category(item),status,committee:s.committee,eventDate:s.date,updatedAt:fetchedAt,
    relevanceReason:'Öffentlicher Tagesordnungspunkt: '+s.committee,sourceText:[item,`Sitzung ${s.number}: ${s.committee}, ${s.date}`].join('\n'),
    identityLinks:[s.url],events:[event],documents:s.documents,sourceUrl:s.url,
    sourceData:{version:'public-source-fields-v1',method:'hamburg-transparenz',fetchedAt,records:[{kind:'agenda',url:s.url,fields:{meeting:s.number,district:s.district,date:s.date,committee:s.committee,title:item,published:s.published}}],detailStatus:'completed',issues:[]}},
    'Hamburg-'+s.district.replace(/^Hamburg-/,''),'Transparenzportal Hamburg; öffentliche Tagesordnung einer Sitzung der Bezirksversammlung oder ihrer Ausschüsse.');
  }
 }
 if(left)warnings.push(`${left} Tagesordnungspunkte des nichtöffentlichen Teils (oder mit Titeln, die ihn nennen) ausgelassen.`);
 for(const [key,p] of senate){
  const committee='Bürgerschaft (Mitteilung des Senats)',status='unknown';
  const event={date:p.date,committee,status,description:`Mitteilung des Senats an die Bürgerschaft (Drucksache ${p.reference}) im Transparenzportal veröffentlicht; Beratung und Beschluss der Bürgerschaft sind dort nicht angegeben.`,result:'',url:p.url,publicEvidence:'Veröffentlicht im Transparenzportal Hamburg (HmbTG, dl-de/by-2.0)'};
  await topic({id:`${source.id}-hh-bs-${key}`,regionId:source.id,source:source.kind,public:true,title:p.title,officialTitle:p.title,reference:p.reference,category:category(p.title),status,committee,eventDate:p.date,updatedAt:fetchedAt,
   relevanceReason:'Mitteilung des Senats an die Bürgerschaft',sourceText:[p.title,'Drucksache '+p.reference+' der Bürgerschaft (Mitteilung des Senats)',p.notes].filter(Boolean).join('\n'),
   identityLinks:[p.url],events:[event],documents:p.documents,sourceUrl:p.url,
   sourceData:{version:'public-source-fields-v1',method:'hamburg-transparenz',fetchedAt,records:[{kind:'paper',url:p.url,fields:{reference:p.reference,body:'Bürgerschaft',published:p.date,modified:p.modified}}],detailStatus:'completed',issues:[]}},
   'Hamburg','Transparenzportal Hamburg; Mitteilungen des Senats an die Bürgerschaft (Drucksachen der Bürgerschaft).');
 }
 const foreign=state.foreign;
 if(foreign)warnings.push(`${foreign} Treffer der Suche ${foreign===1?'gehört':'gehören'} nicht zur Abfrage (anderer Bezirk, anderes Registerobjekt, Mitteilung ohne Drucksachennummer) und ${foreign===1?'wurde':'wurden'} ausgelassen.`);
 return {topics,marks:{},readMeetings:meetings.size,coverage:coverage({meetings:meetings.size,papers:papers.size+senate.size,...(warnings.length?{warnings}:{}),quiet:topics.length===0&&issues.length===0,complete:issues.length===0&&topics.length>0,issues:topics.length?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.']})};
}

/** A consent recorded in the catalog entry: who gave it, when, and that it covers the OParl interfaces. */
export function consentValid(consent){
 return Boolean(consent&&typeof consent==='object'&&String(consent.by||'').trim()&&/^\d{4}-\d{2}-\d{2}$/.test(String(consent.date||''))&&/oparl|robots/i.test(String(consent.scope||'')));
}

/**
 * Districts that may be read: with a valid consent every listed system; without one every system that does not refuse
 * technically, i.e. the check script saw no HTTP 401/403 and did not find it to be no OParl system (oparl:false).
 * robots.txt does not decide (OParl is an interface for programs; shared/source-access.mjs), also not with
 * ROBOTS_POLICY=obey; its verdict stays recorded in the entry.
 */
export function eligibleSystems(source){
 const systems=(source.systems||[]).filter(s=>s&&s.district&&https(s.system));
 if(consentValid(source.consent))return systems;
 return systems.filter(s=>s.oparl!==false&&!/HTTP 40[13]\b/.test(String(s.error||'')));
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
   // A 403 of the system ends its reading (collectRegionalOparl); robots.txt does not decide over OParl.
   const d=await collectRegionalOparl({...source,name:'BVV '+s.district,system:s.system,...(s.body?{body:s.body}:{})},options);used++;
   for(const t of d.topics){t.committee=prefix(s.district,t.committee);for(const e of t.events||[])e.committee=prefix(s.district,e.committee);topics.push(t);}
   Object.assign(marks,d.marks||{});meetings+=d.coverage.meetings||0;read+=d.readMeetings||0;
   if(!d.coverage.complete)complete=false;if(d.coverage.resumable)resumable=true;
   issues.push(...(d.coverage.issues||[]).filter(i=>!/^Noch keine Artikel/.test(i)).map(i=>`BVV ${s.district}: ${i}`));
  }catch(e){complete=false;issues.push(`BVV ${s.district}: ${e.message}`);}
 }
 const left=12-systems.length;if(left>0)warnings.push(`${left} von 12 Bezirken nicht gelesen (${consent?'keine OParl-Adresse eingetragen':'ohne Freigabe; technische Sperre (HTTP 403) oder keine Adresse'}).`);
 return {topics,marks,readMeetings:read,coverage:{regionId:source.id,method:'oparl',from:fromDay,to:now.toISOString().slice(0,10),importedAt:now.toISOString(),meetings,sourceCount:used,...(resumable?{resumable:true}:{}),...(warnings.length?{warnings}:{}),...(consent?{consent:{by:source.consent.by,date:source.consent.date}}:{}),quiet:topics.length===0&&issues.length===0,complete:complete&&issues.length===0&&topics.length>0&&left===0,issues:topics.length?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.'],sourceUrl:systems[0].system}};
}
const prefix=(district,committee)=>{const c=String(committee||'').trim();return norm(c).includes(norm(district))?c:`BVV ${district}: ${c||'Öffentliche Sitzung'}`;};

// Berlin, Abgeordnetenhaus (adapter "berlin"): in Berlin the Abgeordnetenhaus is the representative body of the Land
// and of the city at once. Its parliamentary documentation (PARDOK) is published as open data, one XML file per
// electoral period (opendata/pardok-wp<N>.xml, updated daily): <Vorgang> elements with nested <Dokument> elements
// (DokArt, DokNr, DokDat as DD.MM.YYYY, Titel, LokURL to the PDF). The file is large; it is read as a stream and only
// procedures with a document inside the period are kept. robots.txt of the site decides before the download.
export const PARDOK_NOTE='Vorgänge des Abgeordnetenhauses (Parlamentsdokumentation, offene Daten); ohne Tagesordnungen der Ausschüsse.';
const DOC_KIND={Drs:'Drucksache',PlPr:'Plenarprotokoll',APr:'Ausschussprotokoll',WPr:'Wortprotokoll',InhPr:'Inhaltsprotokoll',BeschlPr:'Beschlussprotokoll',SchrAnfr:'Schriftliche Anfrage',KlAnfr:'Kleine Anfrage'};
// Written and small questions of single members: many thousand per period, no decision of the body.
const INQUIRY=/schriftliche anfrage|kleine anfrage|^(schrAnfr|klAnfr)$/i;
const field=(block,tag)=>{const m=block.match(new RegExp(`<${tag}\\b[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))</${tag}>`));return m?text(m[1]??m[2]):'';};
const fields=(block,tag)=>[...block.matchAll(new RegExp(`<${tag}\\b[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))</${tag}>`,'g'))].map(m=>text(m[1]??m[2])).filter(Boolean);
const germanDay=value=>{const m=String(value).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:isoDay(value);};

/** One <Vorgang> block: id, type, descriptors and its documents; null without id or documents. */
export function pardokProcedure(block){
 const id=field(block,'VID')||field(block,'VNr');
 const docs=[...block.matchAll(/<Dokument\b[^>]*>([\s\S]*?)<\/Dokument>/g)].map(m=>{const d=m[1];return {kind:field(d,'DokArt'),number:field(d,'DokNr'),date:germanDay(field(d,'DokDat')),title:field(d,'Titel'),url:https(field(d,'LokURL')),period:field(d,'Wp')};}).filter(d=>d.date&&(d.url||d.number));
 if(!id||!docs.length)return null;
 const head=block.replace(/<Dokument\b[\s\S]*?<\/Dokument>/g,'');
 return {id,type:field(head,'VTypL')||field(head,'VTyp'),system:field(head,'VSysL'),title:field(head,'VTitel')||field(head,'Titel'),descriptors:fields(head,'Desk').slice(0,12),documents:docs};
}

/** Splits a stream of XML text into <Vorgang> blocks; calls onBlock for each and keeps only the unfinished rest. */
export async function pardokBlocks(chunks,onBlock){
 let rest='',count=0;
 for await (const chunk of chunks){
  rest+=chunk;let end;
  while((end=rest.indexOf('</Vorgang>'))>=0){const start=Math.max(rest.lastIndexOf('<Vorgang>',end),rest.lastIndexOf('<Vorgang ',end));const block=start>=0?rest.slice(start,end+10):'';rest=rest.slice(end+10);if(block){count++;onBlock(block);}}
  // A text without a started procedure only needs its last characters (a tag may be cut in two).
  if(rest.length>1e6&&rest.indexOf('<Vorgang')<0)rest=rest.slice(-64);
 }
 return count;
}

/** Text chunks of a download, without redirects, with our name and a timeout for the whole transfer. */
export async function* streamText(url,{timeoutMs=150000,request=fetch}={}){
 const r=await fetchNoRedirect(url,{signal:AbortSignal.timeout(timeoutMs),headers:{'User-Agent':SOURCE_USER_AGENT,Accept:'application/xml,text/xml'}},request);
 if(!r.ok){await r.body?.cancel();throw Error('Quelle antwortet mit HTTP '+r.status);}
 const reader=r.body.getReader(),decoder=new TextDecoder('utf-8');
 for(;;){const {done,value}=await reader.read();if(done)break;yield decoder.decode(value,{stream:true});}
 const tail=decoder.decode();if(tail)yield tail;
}

export async function collectPardok(source,{now=new Date(),get=fetchText,stream=streamText,window:lookback,maxDurationMs=120000,onProgress=()=>{}}={}){
 const deadline=Date.now()+maxDurationMs-3000;
 const fromDay=windowStart(now,lookback).toISOString().slice(0,10),today=now.toISOString().slice(0,10),pardok=source.pardok||{};
 const base=pardok.base||'https://www.parlament-berlin.de/',issues=[],warnings=[],kept=new Map();
 const coverage=extra=>({regionId:source.id,method:'scraper',from:fromDay,to:today,importedAt:now.toISOString(),meetings:0,sourceCount:1,sourceUrl:base+'dokumente/open-data',note:PARDOK_NOTE,...extra});
 // Newest period first: after an election its file is small and holds the current procedures.
 const periods=(pardok.periods||[19,20]).map(Number).filter(n=>n>0).sort((a,b)=>b-a);
 let read=0,missing=0,inquiries=0;
 for(const period of periods){
  const url=new URL(`opendata/pardok-wp${period}.xml`,base).href;
  const timeoutMs=Math.min(pardok.timeoutMs||150000,deadline-Date.now());
  if(timeoutMs<5000){issues.push(`Zeitbudget der Quelle erreicht; Wahlperiode ${period} nicht gelesen.`);continue;}
  try{
   const n=await pardokBlocks(stream(url,{timeoutMs}),block=>{
    const p=pardokProcedure(block);if(!p)return;
    const inside=p.documents.filter(d=>d.date>=fromDay&&d.date<=today);if(!inside.length)return;
    if(pardok.inquiries!==true&&(INQUIRY.test(p.type)||p.documents.every(d=>INQUIRY.test(d.kind)))){inquiries++;return;}
    kept.set(p.id,{...p,inside});
   });
   read++;onProgress(`${source.id}: Wahlperiode ${period}, ${n} Vorgänge gelesen`);
   if(!n)issues.push(`Wahlperiode ${period}: Datei ohne erkennbare Vorgänge (Unbekanntes Format).`);
  }catch(e){
   // The file of a period that has not begun yet does not exist.
   if(/HTTP 404/.test(e.message)){missing++;continue;}
   issues.push(`Wahlperiode ${period}: `+(/abort|timeout/i.test(e.message)?'Zeitbudget der Quelle erreicht; die Datei wurde nicht vollständig geladen.':e.message));
   if(refusedBy(e))break;
  }
 }
 if(!read&&!issues.length)issues.push('Keine Datei der Parlamentsdokumentation gefunden ('+periods.map(p=>'pardok-wp'+p+'.xml').join(', ')+').');
 if(inquiries)warnings.push(`${inquiries} Schriftliche und Kleine Anfragen ausgelassen.`);
 const topics=[];
 for(const p of kept.values()){
  const first=p.documents.slice().sort((a,b)=>a.date.localeCompare(b.date))[0],title=(p.title||first.title||p.type||'Vorgang '+p.id).slice(0,300);
  const events=p.inside.sort((a,b)=>a.date.localeCompare(b.date)).map(d=>{const event={date:d.date,committee:'Abgeordnetenhaus',status:'unknown',description:[DOC_KIND[d.kind]||d.kind||'Dokument',d.number,d.title&&d.title!==title?d.title:''].filter(Boolean).join(' · '),result:'',url:d.url||base+'dokumente/open-data',publicEvidence:'Parlamentsdokumentation des Abgeordnetenhauses (offene Daten)',attendance:{status:'not_collected',sourceUrl:d.url||'',fetchedAt:now.toISOString(),people:[]}};event.decision=sourceDecision(event);return event;});
  const last=events.at(-1),documents=[...new Map(p.documents.filter(d=>d.url).map(d=>[d.url,{title:[DOC_KIND[d.kind]||d.kind,d.number].filter(Boolean).join(' ')||'Dokument',url:d.url,kind:'application/pdf'}])).values()];
  const t={id:`${source.id}-pardok-${slug(p.id)}`,regionId:source.id,source:source.kind,public:true,title,officialTitle:title,reference:first.number||p.id,category:category(title),status:'unknown',committee:'Abgeordnetenhaus',eventDate:last.date,updatedAt:now.toISOString(),
   relevanceReason:'Öffentlicher Vorgang des Abgeordnetenhauses von Berlin',sourceText:[title,p.type,p.system,p.descriptors.join(', '),...events.map(e=>e.date+' '+e.description)].filter(Boolean).join('\n'),
   identityLinks:documents.map(d=>d.url),events,documents,sourceUrl:last.url,
   sourceData:{version:'public-source-fields-v1',method:'berlin-pardok',fetchedAt:now.toISOString(),records:[{kind:'procedure',url:last.url,fields:{id:p.id,type:p.type,system:p.system,descriptors:p.descriptors}}],detailStatus:'completed',issues:[]}};
  Object.assign(t,sourceSummary(t));if(t.longSummary?.[0])t.longSummary[0]=t.longSummary[0].replace('in Münster','in Berlin');
  t.quality={passed:false,checks:[{name:'Originalquelle',passed:true,detail:'Parlamentsdokumentation des Abgeordnetenhauses von Berlin (offene Daten).'},{name:'Inhaltliche Prüfung',passed:false,detail:'Automatischer Quellenüberblick, keine geprüfte KI-Zusammenfassung.'}],checkedAt:now.toISOString(),sourceHash:await hash(t.sourceText)};
  topics.push(t);
 }
 if(missing&&read)warnings.push(`${missing} Wahlperiode(n) ohne Datei (noch nicht begonnen).`);
 return {topics,marks:{},readMeetings:0,coverage:coverage({papers:topics.length,...(warnings.length?{warnings}:{}),quiet:topics.length===0&&issues.length===0,complete:issues.length===0&&topics.length>0,issues:topics.length?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.']})};
}

/** Berlin: the Abgeordnetenhaus always; the district assemblies where no technical refusal stands in the way or a consent allows it. */
export async function collectBerlin(source,options={}){
 const house=await collectPardok(source,options);
 if(!eligibleSystems(source).length){
  const note=(source.systems||[]).length?'Bezirksverordnetenversammlungen nicht gelesen: '+BERLIN_CONSENT_MISSING:'Bezirksverordnetenversammlungen nicht gelesen: Freigabe fehlt (HTTP 403).';
  house.coverage.warnings=[...(house.coverage.warnings||[]),note];return house;
 }
 const districts=await collectOparlDistricts(source,options);
 const c=house.coverage,d=districts.coverage,issues=[...c.issues.filter(i=>!/^Noch keine Artikel/.test(i)),...d.issues.filter(i=>!/^Noch keine Artikel/.test(i))],topics=[...house.topics,...districts.topics];
 return {topics,marks:{...house.marks,...districts.marks},readMeetings:districts.readMeetings,coverage:{...c,meetings:d.meetings||0,sourceCount:1+(d.sourceCount||0),...(d.resumable?{resumable:true}:{}),warnings:[...(c.warnings||[]),...(d.warnings||[])],quiet:topics.length===0&&issues.length===0,complete:c.complete&&d.complete,issues:topics.length?issues:[...issues,'Noch keine Artikel erfolgreich erfasst.']}};
}
