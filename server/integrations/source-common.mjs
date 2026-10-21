// Small helpers of the source readers (server/integrations/*), one copy instead of one per reader. Pure, without state;
// the readers import them under their former local names (germanDay as day, asciiSlug as slug, httpsUrl as https).
// website-feeds.mjs keeps its own copies: it imports nothing (website-plan.mjs, tests/website-discovery.test.mjs).

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
