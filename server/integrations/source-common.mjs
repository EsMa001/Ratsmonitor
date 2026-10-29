// Small helpers of the source readers (server/integrations/*), one copy instead of one per reader. Pure, without state;
// the readers import them under their former local names (germanDay as day, asciiSlug as slug, httpsUrl as https).
// website-feeds.mjs keeps its own copies: it imports nothing (website-plan.mjs, tests/website-discovery.test.mjs).
import {withoutPrivateNames} from '../../shared/private-names.mjs';
/** Part of a topic id from a raw value of the source; a value of allowed characters stays as it is (shared/topic-identity.mjs). */
export {safeIdPart} from '../../shared/topic-identity.mjs';

/** FNV-1a (32 bit) as 8 hex digits: stable ids of meetings, items and papers. */
export const fnv=value=>{let h=0x811c9dc5;for(const c of new TextEncoder().encode(value)){h^=c;h=Math.imul(h,0x01000193);}return (h>>>0).toString(16).padStart(8,'0');};
/** Lower case, every run of other characters '-'; umlauts are not folded (small-common.mjs folds them), ids depend on it. */
export const asciiSlug=value=>String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
/** First German date of a value ("1.2.2026", "01.02.2026") as "2026-02-01", or null. */
export const germanDay=value=>{const m=String(value).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:null;};
/** As germanDay, but only with two-digit day and month ("01.02.2026"). */
export const germanDayStrict=value=>{const m=String(value).match(/(\d{2})\.(\d{2})\.(\d{4})/);return m?`${m[3]}-${m[2]}-${m[1]}`:null;};
/** Month names (lower case, März also as maerz) and their number. */
export const MONTHS={januar:1,februar:2,märz:3,maerz:3,april:4,mai:5,juni:6,juli:7,august:8,september:9,oktober:10,november:11,dezember:12};
/** Long German date ("1. März 2026") as "2026-03-01"; otherwise as germanDay. */
export const germanLongDay=value=>{const m=String(value).match(/(\d{1,2})\.\s*(Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})/i);return m?`${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2,'0')}-${m[1].padStart(2,'0')}`:germanDay(value);};
/** ISO date at the start of a value ("2026-02-01T…") as "2026-02-01", or null. */
export const isoDay=value=>{const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[1]}-${m[2]}-${m[3]}`:null;};
/** The address when it is https without user name or password, otherwise null. */
export const httpsUrl=url=>{try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
/** At most max characters, cut at a word boundary, then ' …'. */
export const clip=(value,max)=>value.length>max?value.slice(0,max).replace(/\s+\S*$/,'')+' …':value;
/** A non-public part ("nicht öffentlich", "nichtöffentlich", "vertraulich"). */
export const RESTRICTED=/nicht\s*[-–]?\s*(?:ö|oe)ffentlich|vertraulich/i;
/** decodeURIComponent that keeps a malformed value as it is. */
export const safeDecode=s=>{try{return decodeURIComponent(s);}catch{return s;}};

// --- publicity (decision of the project owner, 24.10.2026) -----------------------------------------------------------
// Two rules only. 1. Nothing is fetched that calls itself non-public: a document whose title, link text or file name says
// „nichtöffentlich“, „vertraulich“ or „nur für Ratsmitglieder“, and pages of the members' area. 2. Titles of non-public items
// lose the names of private persons. Everything else a source shows is taken; what it says of the non-public part in its
// text (a heading, „§ 35 GO“, no mark Ö/N) only marks the items: publicity 'nonpublic' or 'unclear', never left out.
/** A document that calls itself non-public (rule 1). A report of decisions taken there („Bekanntgabe nichtöffentlich gefasster Beschlüsse“) is public. */
export const SELF_CLOSED=/nicht\s*[-–_]?\s*(?:ö|oe|o)ffentl|vertraulich|nur\s+(?:für|fuer)\s+(?:die\s+)?(?:\p{L}*mitglieder|mandatstr(?:ä|ae)ger)|mitgliederbereich|ratsmitgliederbereich/iu;
const REPORTED=/gefasst|bekanntgabe|bekanntgegeben|bekannt\s*zu\s*geben|weggefallen|entfallen/i;
export const selfClosed=(...texts)=>texts.some(t=>{const s=safeDecode(String(t||'')).replace(/[_+]/g,' ');return SELF_CLOSED.test(s)&&!REPORTED.test(s);});
/** Documents that may be linked and fetched: none that calls itself non-public. */
export const openDocuments=docs=>(docs||[]).filter(d=>!selfClosed(d.title,d.url));
export const CLOSED_DESCRIPTION='Nichtöffentlicher Punkt laut veröffentlichter Tagesordnung; öffentlich bekannt sind Titel, Sitzung und Gremium.';
export const UNCLEAR_DESCRIPTION='Auf der veröffentlichten Tagesordnung; ob öffentlich beraten wird, gibt die Quelle nicht an.';
/** A report row ({title, event, documents}) of an item with its publicity; public rows stay as they are (rule 2 for non-public titles). */
export function markPublicity(row,publicity){
 const docs=row.documents?{documents:openDocuments(row.documents)}:{};
 if(!publicity||publicity==='public')return {...row,...docs};
 const title=publicity==='nonpublic'?withoutPrivateNames(row.title):row.title;
 return {...row,...docs,title,publicity,event:{...row.event,publicity,publicEvidence:publicity==='nonpublic'?'nichtöffentlicher Teil laut Quelle':'öffentliche Beratung nicht belegt',description:row.event?.result?row.event.description:publicity==='nonpublic'?CLOSED_DESCRIPTION:UNCLEAR_DESCRIPTION}};
}
/** Publicity of a report from its events: none while one event is public, otherwise 'nonpublic' if one is, else 'unclear'. */
export const topicPublicity=events=>(events||[]).some(e=>!e.publicity||e.publicity==='public')?null:(events||[]).some(e=>e.publicity==='nonpublic')?'nonpublic':'unclear';
/** A placeholder instead of a title („Nichtöffentlicher Tagesordnungspunkt“, „(nichtöffentlich)“, „N.N.“): no report of its own. */
export const PLACEHOLDER=/^[\s([{]*(?:(?:nicht\s*-?\s*öffentliche?r?\s+)?(?:tagesordnungs)?punkt|n\.?\s*n\.?|-+|–+|nichtöffentlich|nicht öffentlich)[\s)\]}.]*$/i;
