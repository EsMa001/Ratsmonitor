// Pure decisions of the link search (crawl.mjs) and of the check (verify.mjs): which links are no candidates, which
// address a wrapper link carries, what is asked after a page failed, where the public part of a system lies, which
// ALLRIS generation a page belongs to and whether an address names the area. Importing this file asks no network;
// tests/source-discovery-rules.test.mjs checks it.
import {CATALOG} from '../../shared/catalog.mjs';
import {detectAllris3} from '../../server/integrations/allris3.mjs';
import {nameParts,aliasInAddress,ALIASES} from './areas.mjs';

// --- links that are no candidates ------------------------------------------------------------------------------------
/** Links the link search never opens or keeps: files, mail, social media, read-aloud, sharing, app stores, directories. */
export const CRAWL_SKIP=/\.(pdf|jpe?g|png|gif|svg|zip|docx?|xlsx?|ics|mp[34])(\?|$)|mailto:|facebook|instagram|youtube|twitter|linkedin|google\.|wikipedia|readspeaker\.com|whatsapp\.com|\/\/wa\.me\/|xing\.com|\/\/t\.me\/|total-lokal\.de|findcity\.de|buergerservice-portal\.de|heimat-info\.de|lifesizecloud|oksh\.de|\.social\/@|x\.com\/intent|twitter\.com\/(?:intent|share)|facebook\.com\/(?:share|sharer)|linkedin\.com\/(?:share|uas)|acrobat\.adobe\.com|atlas\.bayern\.de|\/\/epaper\.|apps\.apple\.com|apps\.microsoft\.com|play\.google\.com|www\.sitzungsdienst\.net|\/\/www\.ratsinfomanagement\.net|somacos\.de|cc-egov\.de|\/(impressum|datenschutz|kontakt|barrierefrei)|\/:translation\//i;
/** Pages under /:translation/<language>/… repeat the website in another language (Saarpfalz-Kreis): never explored or read. */
export const TRANSLATED=/\/:translation\//i;
/** Links to read-aloud and sharing services, directories and vendor pages; they are no council systems (verify.mjs). */
export const SERVICE=/total-lokal\.de|findcity\.de|buergerservice-portal\.de|heimat-info\.de|lifesizecloud|oksh\.de|\.social\/@|x\.com\/intent|twitter\.com\/(?:intent|share)|facebook\.com\/(?:share|sharer)|linkedin\.com\/(?:share|uas)|acrobat\.adobe\.com|atlas\.bayern\.de|\/\/epaper\.|apps\.apple\.com|apps\.microsoft\.com|play\.google\.com|www\.sitzungsdienst\.net|\/\/www\.ratsinfomanagement\.net|somacos\.de|cc-egov\.de|readspeaker\.com|api\.whatsapp\.com|\/\/wa\.me\/|xing\.com|\/\/t\.me\/|threads\.net|bsky\.app|pinterest\.|reddit\.com|tiktok\.com|mastodon/i;

// --- wrapper links ---------------------------------------------------------------------------------------------------
const registrable=host=>String(host||'').toLowerCase().replace(/\.$/,'').split('.').slice(-2).join('.');
// Read-aloud (readspeaker: …&url=<page>) and sharing links (x.com/intent/tweet?url=…, xing …/share?url=…, Facebook's
// sharer ?u=…) carry the address of a page of the website in their query.
const WRAPPER=/(?:^|\.)(?:readspeaker\.com|x\.com|twitter\.com|xing\.com|facebook\.com|linkedin\.com)$/i;
/**
 * The address a read-aloud or sharing link carries, if it lies on the website of the area (same registrable domain as
 * siteHost, the host of the website or of the page that linked it); null otherwise. The enclosed address is an ordinary
 * candidate or page of the website (readspeaker on enzkreis.de reads …/Ratsinfosystem/); an address elsewhere is not
 * proof of anything the area links.
 */
export function unwrapLink(url,siteHost){
 let u,inner;try{u=new URL(url);}catch{return null;}
 if(!siteHost||!WRAPPER.test(u.hostname))return null;
 const carried=u.searchParams.get('url')||u.searchParams.get('u');if(!carried)return null;
 try{inner=new URL(carried);}catch{return null;}
 if(!/^https?:$/.test(inner.protocol)||inner.username||inner.password||WRAPPER.test(inner.hostname))return null;
 if(registrable(inner.hostname)!==registrable(String(siteHost).replace(/^www\./i,'')))return null;
 inner.hash='';return inner.href;
}

// --- after a page failed ---------------------------------------------------------------------------------------------
// Folders and host names of SessionNet (README: ratsinfo., buergerinfo., sessionnet., session., sitzungsdienst.; komm.one
// tenants <name>-sitzungsdienst.komm.one).
const SESSIONNET_PATH=/\/sessionnet\/|\/bi\/|buergerinfo/i,SESSIONNET_HOST=/^(?:www\.)?(?:ratsinfo|buergerinfo|sessionnet|session|sitzungsdienst)\.|-sitzungsdienst\.|buergerinfo/i;
// ALLRIS lives in /bi/ folders as well. Its hosts (sitzung-online.de) block a network after a few requests without a
// session cookie, and a SessionNet entry page is never there: no search next to an ALLRIS address.
const ALLRIS_ADDRESS=/sitzung-online\.de|ratsinfo-online\.(?:de|net)|allris|\/(?:[a-z]{2}\d{3}(?:_[a-z])?|allris\.net|logon)\.asp$/i;
/** Hosts of More! Rubin (gremien.info, more-rubin1.de, KISA's zv-kisa.de). */
export const RUBIN_HOST=/(?:^|\.)(?:gremien\.info|more-rubin1\.de|zv-kisa\.de)$/i;
/**
 * What the check asks after a candidate address did not answer with a page. page: {status, error, robots} as from
 * page() in verify.mjs (status 0: time limit or network error; 3xx: redirect chain broken off).
 * - nearby: look for the SessionNet entry page next to the address (findSessionNet), after 404, 0 or a broken redirect
 *   chain of a SessionNet folder or host. A folder that moved or a start page that times out says nothing about the
 *   system next to it.
 * - root: the root of a More! Rubin host as a further candidate, after 404 or 0 of a deeper path (/users, an old
 *   calendar month); the system itself answers at the root.
 * Never after 401 or 403 or (with ROBOTS_POLICY=obey) when robots.txt disallows the address or a redirect target: a
 * refusal is not worked around (README, "Keine Umgehung"); only the official OParl address is asked then.
 */
export function followUpsAfterFailure(url,page={}){
 const none={nearby:false,root:null};let u;try{u=new URL(url);}catch{return none;}
 const {status,error,robots}=page;
 if(robots==='verboten'||/robots/i.test(String(error||''))||status===401||status===403)return none;
 const gone=status===404||status===0,broken=status>=300&&status<400;
 const nearby=(gone||broken)&&!ALLRIS_ADDRESS.test(u.href)&&(SESSIONNET_PATH.test(u.pathname)||SESSIONNET_HOST.test(u.hostname));
 const root=gone&&RUBIN_HOST.test(u.hostname)&&(u.pathname!=='/'||!!u.search)?u.origin+'/':null;
 return {nearby,root};
}

// --- members' area and public part -----------------------------------------------------------------------------------
/** An address of SessionNet that names the members' area (gi/, ri/, suelze_ri/, ratsinfo, sessionnetri). */
export const MEMBERS_AREA=/(?:\/|[_-])(?:gi|ri)\/$|ratsinfo|sessionnetri/i;
// Platforms with one host per tenant (ratsinfo-<name>.digitalfabrix.de): only the tenant label changes there, never the
// first label of the platform.
const PLATFORM_HOST=/(?:^|\.)(?:digitalfabrix\.de|livingdata\.de|owl-it\.de|komm\.one|sitzung-online\.de|ratsinfo-online\.(?:de|net)|kitu-genossenschaft\.de)$/i;
/** Host labels under which the public Bürgerinfo of SessionNet was found next to a members' host (bis.kreis-lup.de next to ris.kreis-lup.de, sbi. next to ratsinfo.). */
export const PUBLIC_HOST_LABELS=['bis','sbi','buergerinfo','bi'];
/**
 * Hosts of the same registrable domain where the public part may live when host names its members' area: the first
 * label replaced by bis, sbi, buergerinfo and bi (ris.kreis-lup.de → bis.kreis-lup.de). Nothing for a host without a
 * subdomain, for a platform host (there only ratsinfo-<x> → buergerinfo-<x> applies, see publicSiblings) and for a host
 * that already bears a public label.
 */
export function publicHosts(host){
 const labels=String(host||'').toLowerCase().replace(/\.$/,'').split('.');
 if(labels.length<3||PLATFORM_HOST.test(labels.join('.'))||PUBLIC_HOST_LABELS.includes(labels[0]))return [];
 return PUBLIC_HOST_LABELS.map(l=>[l,...labels.slice(1)].join('.'));
}
/**
 * The public part of a system lies next to its members' area under another name: bi/ for gi/ or ri/ (also as the suffix
 * of a tenant folder, suelze_ri/ → suelze_bi/), buergerinfo for ratsinfo (folder or host name, also the tenant label of a
 * platform: ratsinfo-vg-strasskirchen.digitalfabrix.de → buergerinfo-…), sessionnetbi for sessionnetri. Addresses to
 * ask, the given base last among those of its host. With login (the page was the login of SessionNet) also the hosts
 * of publicHosts with the public path, after all addresses of the given host: each is asked once (verify.mjs).
 */
export function publicSiblings(base,{login=false}={}){
 const u=new URL(base),paths=[u.pathname.replace(/\/(gi|ri)\/$/i,'/bi/'),u.pathname.replace(/([_-])(gi|ri)\/$/i,'$1bi/'),u.pathname.replace(/ratsinfo\/$/i,'buergerinfo/'),u.pathname.replace(/sessionnetri\/$/i,'sessionnetbi/'),u.pathname],hosts=[u.hostname,u.hostname.replace(/^ratsinfo(?=[.-])/i,'buergerinfo')];
 const out=hosts.flatMap(host=>paths.map(path=>'https://'+host+path));
 if(login){const path=paths.find(p=>p!==u.pathname)||u.pathname;out.push(...publicHosts(u.hostname).map(host=>'https://'+host+path));}
 return [...new Set(out)];
}

// --- order of the candidates (verify.mjs) ----------------------------------------------------------------------------
/** Addresses that show a council system by themselves; such candidates are checked first. */
export const STRONG_RIS=/ris-portal\.de|komuna\.net|cm-ratsinfos\.de|si00\d\d|sessionnet|\/bi\/|gremien\.info|ratsinfomanagement|sdnetrim|allris|sitzung-online|oparl|buergerinfo|ratsinfo|kdz-ws|session/i;
/** Link texts that name the public part of a system ("Bürgerinformationssystem", "Bürgerinfo", "Rats- und Bürgerinfo"). */
export const PUBLIC_TEXT=/b(?:ü|ue)rgerinfo/i;
/**
 * Candidates in the order the check asks them: a link whose text names the public part (Bürgerinformationssystem) first,
 * since a "Ratsinformationssystem" link next to it often leads to the members' login (bis.kreis-lup.de next to
 * ris.kreis-lup.de); then addresses that show a system themselves (STRONG_RIS); then hits by address before hits by text.
 * Stable: equal candidates keep their order.
 */
export function rankCandidates(candidates){
 const key=c=>[PUBLIC_TEXT.test(c.text||'')?1:0,STRONG_RIS.test(c.url)?1:0,c.byHref?1:0];
 return [...candidates].map((c,i)=>({c,i,k:key(c)})).sort((a,b)=>b.k[0]-a.k[0]||b.k[1]-a.k[1]||b.k[2]-a.k[2]||a.i-b.i).map(x=>x.c);
}

// --- ALLRIS ----------------------------------------------------------------------------------------------------------
/** Absolute http(s) addresses of the links, frames and forms of a page; attribute values in quotes or without them. */
export const hrefs=(html,base)=>[...String(html||'').matchAll(/(?:href|src|action)\s*=\s*(?:["']([^"'#]+)|([^\s>"'#]+))/gi)].map(m=>{try{const u=new URL((m[1]||m[2]).replace(/&amp;/g,'&').trim(),base);return /^https?:$/.test(u.protocol)?u.href:null;}catch{return null;}}).filter(Boolean);
const ALLRIS4_PAGE=/^(https?:\/\/[^?#]*\/)(?:si010|si018|to010|vo020|vo040|gr010|gr020|kp040|tr010)(?:[?#]|$)/;
const ALLRIS3_PAGE=/\/(?:[a-z]{2}\d{3}(?:_[a-z])?|allris\.net|logon)\.asp$/i;
// Links of a page on its own host: folders of ALLRIS 4 programs, and whether ALLRIS 3 programs (.asp) are linked.
function allrisLinks(url,html){
 const host=new URL(url).hostname,own=hrefs(html,url).filter(h=>new URL(h).hostname===host);
 return {folders:own.map(h=>h.match(ALLRIS4_PAGE)?.[1]).filter(Boolean),asp:own.some(h=>ALLRIS3_PAGE.test(new URL(h).pathname))};
}
/**
 * ALLRIS 4 serves its public pages from one folder, usually /public/. A page of the system names that folder, a page of
 * the official website links pages in it (same host, e.g. /allris/si010); a link to the host alone is answered from
 * /public/. Addresses ending in .asp belong to the older ALLRIS 3, and so does a page that links only .asp programs:
 * /public/ is then not asked (ratsinfo-online.net/<name>-bi/ answered it with 404).
 */
export function allrisBases(url,html){
 const u=new URL(url);if(/\.asp$/i.test(u.pathname))return [];
 const wicket=/wicket/i.test(html||''),{folders,asp}=allrisLinks(url,html);
 return [...new Set([wicket?u.origin+u.pathname.replace(/[^/]*$/,''):null,...folders,asp&&!wicket&&!folders.length?null:u.origin+'/public/'].filter(Boolean))].map(b=>b.replace(/^http:/,'https:')).slice(0,3);
}
/** Public folders of ALLRIS 3 found next to the members' area ri/: bi/ (usual), pi/ (Steinburg), pi2/ (Diepholz), bi2/, bi-r/, pi-r/, buergerinfo/. */
export const ALLRIS3_PUBLIC_FOLDERS=['bi','pi','bi2','pi2','bi-r','pi-r','buergerinfo'];
/**
 * Folder addresses where the public part of ALLRIS 3 may lie next to a members' folder (…/ri/, …/<name>-ri/): the
 * folders of ALLRIS3_PUBLIC_FOLDERS in that order, the one detectAllris3 derived (bi/) first; [] for any other address.
 * verify.mjs asks each once (allris.net.asp) only after the login was recognised and the derived folder answered 404.
 */
export function allris3Siblings(base){
 let u;try{u=new URL(base);}catch{return [];}
 const m=u.pathname.match(/^(.*?)(\/|[-_])(ri|bi)\/$/i);if(!m)return [];
 return [...new Set(ALLRIS3_PUBLIC_FOLDERS.map(f=>u.origin+m[1]+m[2]+f+'/'))];
}
/**
 * 3 if a page belongs to ALLRIS 3 (an .asp address, a page detectAllris3 recognises, or a page that links only .asp
 * programs), else 4. Wicket pages and links to ALLRIS 4 programs decide for 4. The check then skips the ALLRIS 4 reader
 * and leaves the page to the ALLRIS 3 reader (readers.mjs), which saves a session and the 404 of the next month.
 */
export function allrisGeneration(url,html=''){
 let u;try{u=new URL(url);}catch{return 4;}
 if(/\.asp$/i.test(u.pathname))return 3;
 const {folders,asp}=allrisLinks(url,html);
 if(/wicket/i.test(html)||folders.length)return 4;
 return detectAllris3(url,html)||asp?3:4;
}

// --- does the system name the area? ----------------------------------------------------------------------------------
const norm=s=>String(s).toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').normalize('NFKD').replace(/[^a-z0-9]/g,'');
const normPlain=s=>String(s).toLowerCase().replace(/ß/g,'ss').normalize('NFKD').replace(/[^a-z0-9]/g,'');
/** Title of a page, at most 160 characters. */
export const title=html=>(String(html||'').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').replace(/\s+/g,' ').trim().slice(0,160);
const text=html=>String(html||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&uuml;/g,'ü').replace(/&auml;/g,'ä').replace(/&ouml;/g,'ö').replace(/&szlig;/g,'ß').replace(/&#(\d+);/g,(m,n)=>String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi,(m,n)=>String.fromCodePoint(parseInt(n,16))).replace(/\s+/g,' ');
// Names of municipal councils; they differ between the states (Stadtverordnetenversammlung, Gemeindevertretung, Amtsausschuss …).
const COUNCIL=/\b(stadtrat|gemeinderat|marktgemeinderat|samtgemeinderat|verbandsgemeinderat|stadtverordnetenversammlung|gemeindevertretung|stadtvertretung|amtsausschuss|gemeinschaftsversammlung|rat der (stadt|gemeinde|samtgemeinde|verbandsgemeinde))\b/i;
/**
 * Whether the linked system names the area: {ok, by} or {ok:false, why}. A city page linking to its district's system is
 * not a source for the city. aliases: short names by area id (identity-aliases.json); areas: the list that decides
 * whether a part of a hyphenated name names another area.
 */
export function identity(region,url,html,{aliases=ALIASES,areas=CATALOG}={}){
 // "Hennef (Sieg)" and "Mülheim an der Ruhr" appear as "hennef" and "muelheim" in addresses.
 // "Dillingen a.d.Donau", "Neumarkt i.d.OPf." and "Bad Homburg v.d.Höhe" appear without their addition as well.
 // "Neukirchen/Erzgeb." and "Lahr/Schwarzwald" without the part after the slash.
 const plain=n=>n.replace(/\(.*?\)/g,'').replace(/\s+(an der|am|im|in der|in|bei|vor der|ob der|unter|über|auf der|auf dem)\s+.*$/i,'').replace(/\s+[a-zäöü]{1,3}\.\s?(?:[a-zäöü]{1,3}\.\s?)?\S.*$/i,'').replace(/\/.*$/,'').trim();
 // A municipal association's system is often named after its seat, one of its members (ris-crimmitschau for the
 // Verwaltungsgemeinschaft Crimmitschau-Dennheritz); the members are part of the area.
 const names=[region.shortName,region.name.replace(/^(Stadt|Gemeinde|Samtgemeinde|Verbandsgemeinde|Verwaltungsgemeinschaft|Verwaltungsverband|Erfüllende Gemeinde|Amt|Kreis|Städteregion|Rhein-Kreis|Landkreis|Regionalverband|Region)\s+/,''),...(Array.isArray(region.members)?region.members.map(m=>m.name):[])].filter(Boolean).flatMap(n=>[n,plain(n)]);
 // "Schladen-Werla" also by "schladen": each part of six letters or more that is not the name of another area.
 const slugs=[...new Set([...names.flatMap(n=>[norm(n),normPlain(n)]),...names.flatMap(n=>nameParts(n,region,areas))])].filter(s=>s.length>=3);
 const u=new URL(url),hay=norm(u.hostname+u.pathname),hayPlain=normPlain(u.hostname+u.pathname);
 const named=slugs.some(s=>hay.includes(s)||hayPlain.includes(s)),alias=named?null:aliasInAddress(region,url,aliases),inUrl=named||!!alias;
 const body=norm(title(html)+' '+text(html).slice(0,6000));const inText=slugs.some(s=>body.includes(s));
 const t=title(html)+' '+text(html).slice(0,1500);
 const kreisPage=/\b(kreistag|kreisverwaltung|kreisausschuss|landrat)\b/i.test(t)||/kreis/i.test(u.hostname.split('.').slice(0,-1).join('.'));
 if(region.kind==='city'&&kreisPage&&!COUNCIL.test(t)&&!inUrl)return {ok:false,why:'Seite gehört erkennbar zu einem Kreis'};
 if(region.kind==='district'&&!kreisPage&&!/kreis|region/i.test(t+url))return {ok:false,why:'Kreisbezug nicht erkennbar'};
 // A district council system linked from the district's own website needs no further name match (e.g. "obk").
 if(region.kind==='district'&&/\b(kreistag|kreistagsinformation\w*|kreisausschuss)\b/i.test(t))return {ok:true,by:'Kreistagsseite, von der offiziellen Website verlinkt'};
 return inUrl||inText?{ok:true,by:named?'Adresse':alias?'Adresse (Alias)':'Seitentext'}:{ok:false,why:'Gebietsname weder in Adresse noch im Seitentext'};
}

// --- a system that several areas share -------------------------------------------------------------------------------
// The council of another municipality among the bodies a system delivered for an area shows a system that several areas
// share (vv-langenau.ris-portal.de: the councils of all members of the Verwaltungsverband). Without its part (client,
// calendarQuery, organizations) each member would get the bodies of all. Joint bodies (Zweckverband, Verbandsversammlung)
// and the councils of localities (Ortschaftsrat, Ortsrat: a locality may bear the name of another municipality) are no
// sign. Members listed with an area (an Amt, a Samtgemeinde) are its own; those of another area count for that area
// (pasewalk.de/allris: the town and the Amt Uecker-Randow-Tal with the councils of its members).
const OTHER_COUNCIL=/(?:^|[^a-z])(?:stadtrat|gemeinderat|marktgemeinderat|marktrat|gemeindevertretung|stadtverordnetenversammlung|stadtvertretung|ratsversammlung|ortsgemeinderat|samtgemeinderat|verbandsgemeinderat|amtsausschuss|rat der (?:stadt|gemeinde|samtgemeinde|verbandsgemeinde))(?:$|[^a-z])/;
const foldName=s=>String(s||'').normalize('NFC').toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
const coreName=n=>foldName(String(n||'').replace(/^(?:Stadt|Gemeinde|Markt|Marktgemeinde|Große Kreisstadt|Hansestadt|Ortsgemeinde|Samtgemeinde|Verbandsgemeinde|Verwaltungsgemeinschaft|Verwaltungsverband|Erfüllende Gemeinde|Amt|Kreis|Landkreis)\s+/,'')).trim();
const wordOf=n=>new RegExp('(?:^|[^a-z0-9])'+n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:$|[^a-z0-9])');
/**
 * Councils of other areas of the area's district among the bodies a system delivered for it: {own, others, foreign} or
 * null. own: the bodies that name the area (its part of the system); others: the names of the other areas.
 */
export function sharedBodies(area,committees,areas=CATALOG){
 const district=area.kind==='district'?area.id:area.district;if(!district)return null;
 const ownNames=[...new Set([area.shortName,area.name,...(area.members||[]).map(m=>m.name)].filter(Boolean).map(coreName))].filter(Boolean);
 const own=ownNames.map(wordOf);
 const others=areas.filter(a=>a.id!==area.id&&a.kind!=='district'&&a.district===district)
  .map(a=>({a,names:[...new Set([a.shortName,a.name,...(a.members||[]).map(m=>m.name)].filter(Boolean).map(coreName))].filter(n=>n&&!ownNames.some(o=>o===n||wordOf(n).test(o))).map(wordOf)}))
  .filter(o=>o.names.length);
 const mine=[],foreign=[];
 for(const c of [...new Set(committees.filter(Boolean).map(String))]){
  const f=foldName(c);
  if(own.some(n=>n.test(f))){mine.push(c);continue;}
  if(!OTHER_COUNCIL.test(f))continue;
  const hit=others.find(o=>o.names.some(n=>n.test(f)));
  if(hit)foreign.push({committee:c,area:hit.a.id,name:hit.a.name});
 }
 return foreign.length?{own:mine,others:[...new Set(foreign.map(f=>f.name))],foreign:foreign.slice(0,12)}:null;
}

// Platforms that give each municipality a host name of its own but answer DNS for every name (wildcard), so a
// lookup proves nothing: guess-hosted.mjs asks the page and keeps it only if the page names the area. itebo answers
// DNS for existing tenants only; its lookup comes first and saves the request. path: where the public part starts.
export const HOSTED=[
 // digitalfabriX: the start page only redirects (meta refresh to default.asp) and names nobody; the SessionNet info page
 // names the client ("Bürgerinfoportal der Gemeinde Aholming"). A name without a tenant answers 503.
 {name:'digitalfabriX',land:'09',hosts:s=>[`buergerinfo-${s}.digitalfabrix.de`],path:'/info.asp',wildcard:true},
 {name:'sitzung-mv.de',land:'13',hosts:s=>[`${s}.sitzung-mv.de`,`amt-${s}.sitzung-mv.de`],path:'/public/',wildcard:true},
 {name:'itebo',land:'03',hosts:s=>[`${s}ris.itebo.de`],path:'/bi/',wildcard:false},
 // Platforms whose DNS knows existing tenants only (checked 05.10.2026 with an invented name: NXDOMAIN/NODATA): the
 // lookup alone makes a candidate, no page of the platform is asked here (dnsOnly); verify.mjs checks it like every
 // link. All Länder (land ''); a name that two areas share is never taken. ratsinfomanagement.net answers every name
 // and is not guessed.
 {name:'allris.cloud',land:'',hosts:s=>[`${s}.allris.cloud`],path:'/public/',wildcard:false,dnsOnly:true},
 // RIS-Portal: /startseite answers on both kinds of tenant (council site at the root or below /web/ratsinformation/).
 {name:'RIS-Portal',land:'',hosts:s=>[`${s}.ris-portal.de`],path:'/startseite',wildcard:false,dnsOnly:true},
 {name:'sitzung-online.de',land:'',hosts:s=>[`www.${s}.sitzung-online.de`],path:'/public/',wildcard:false,dnsOnly:true},
 // KOMFA-RIS (kommunalfabrik): DNS answers every name, a host without a tenant answers HTTP 404. Its customers found so
 // far are in Brandenburg, Mecklenburg-Vorpommern, Sachsen, Sachsen-Anhalt and Thüringen (one entry per Land, so that a
 // name only has to be unique in its Land). marker: what shows the system on the page (default: SessionNet, ALLRIS).
 ...['12','13','14','15','16'].map(land=>({name:'KOMFA',land,hosts:s=>[`ris-${s}.komfa.de`],path:'/index.php?module=komfaris&action=main',wildcard:true,marker:/module=komfaris/})),
 // komuna (KIC app, 291 of 293 known systems in Bavaria): one path per system on one host (ris.komuna.net/<name>/); a
 // name without a system is redirected to a maintenance page, so redirects are not followed (manual). The app page names
 // nobody: the municipalities its interface names (web/clients) must name the area (confirm, guess-hosted.mjs).
 // ALLRIS 3 of ratsinfo-online.de and .net (one folder per system, "<name>-bi"; 40 known systems, 21 of them in
 // Brandenburg, the others in Sachsen, Sachsen-Anhalt and Thüringen): a folder without a system answers HTTP 404; the
 // page home.asp names the municipality (coat of arms, text).
 ...['12','14','15','16'].map(land=>({name:'ratsinfo-online',land,hosts:s=>[`ratsinfo-online.de/${s}-bi`,`ratsinfo-online.net/${s}-bi`],path:'/home.asp',wildcard:true})),
 // SessionNet of OWL-IT (sessionnet.owl-it.de/<name>/bi/; 229 known systems in twelve Länder): a folder without a system
 // answers HTTP 404; the info page names the client ("Bürgerinfoportal der Stadt Heide").
 ...['01','03','05','06','07','08','09','10','12','13','14','15','16'].map(land=>({name:'OWL-IT',land,hosts:s=>[`sessionnet.owl-it.de/${s}/bi`],path:'/info.asp',wildcard:true})),
 // Names of komuna systems besides the usual labels (of 202 known ones, 168 are such a label): a Verwaltungsgemeinschaft
 // with "vg" in front (vgassling), a name with its addition in one word (aschauainn, neufahrninb).
 {name:'komuna',land:'09',hosts:(s,area)=>[`ris.komuna.net/${s}`,...(area?.municipalityType==='Verwaltungsgemeinschaft'?[`ris.komuna.net/vg${s}`]:[])],
  slugs:area=>{const whole=ascii(area.shortName||area.name).replace(/[^a-z0-9]+/g,'');return whole?[whole]:[];},
  path:'/',wildcard:true,manual:true,marker:/<title>\s*Ratsinformationssystem\s*<\/title>/i,confirm:'kic-clients'},
];
const ascii=s=>String(s).toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
/**
 * Areas of the catalog that share a host label with the area (hostSlugs): a guessed address of a platform may belong
 * to any of them ("borken" on sessionnet.owl-it.de is the town in North Rhine-Westphalia, not Borken in Hesse). lands:
 * the Länder the platform serves (platformLands); twins elsewhere do not count. Without lands every Land counts. Only
 * areas of the same kind are twins: a town and the district of its name are told apart by identity() (Kreistag).
 */
export function nameTwins(area,areas=CATALOG,lands=null){
 const own=new Set(hostSlugs(area.shortName||area.name));if(!own.size)return [];
 return areas.filter(a=>a.id!==area.id&&a.kind===area.kind&&(!lands||lands.includes(String(a.ags||'').slice(0,2)))&&hostSlugs(a.shortName||a.name).some(s=>own.has(s)));
}
// Platforms of guess-platforms.mjs (regional providers, one Land each).
const REGIONAL={'komm.one':['08'],KISA:['14']};
/**
 * The Länder a platform serves, from the evidence a guess wrote ("OWL-IT-Adresse, Seite nennt das Gebiet"): its
 * entries in HOSTED or REGIONAL; null (every Land) for a platform of all Länder or one not known here.
 */
export function platformLands(guessed){
 const name=String(guessed||'').match(/^(.+?)-Adresse\b/)?.[1];if(!name)return null;
 if(REGIONAL[name])return REGIONAL[name];
 const entries=HOSTED.filter(p=>p.name===name);
 return entries.length&&entries.every(p=>p.land)?[...new Set(entries.map(p=>p.land))]:null;
}
/**
 * Whether a page (or the evidence of a platform) names the area so that none of its twins is meant: by its full name
 * with the addition no twin shares ("Mühlheim an der Donau", "Borken (Hessen)"), or an association by all its members.
 */
export function namesDistinctly(page,area,twins){
 const fold=s=>' '+ascii(text(String(s||''))).replace(/[^a-z0-9]+/g,' ').trim()+' ';
 const said=fold(page),core=n=>fold(String(n||'').replace(/^(?:Stadt|Gemeinde|Markt|Marktgemeinde|Große Kreisstadt|Hansestadt|Ortsgemeinde|Samtgemeinde|Verbandsgemeinde|Verwaltungsgemeinschaft|Verwaltungsverband|Erfüllende Gemeinde|Amt|Kreis|Landkreis)\s+/,''));
 const full=core(area.name);
 if(full.trim()&&!twins.some(t=>core(t.name).includes(full))&&said.includes(full))return true;
 const members=(area.members||[]).map(m=>core(m.name));
 return members.length>1&&members.every(m=>said.includes(m));
}
/** Host labels for a name: "Bayerisch Gmain" → bayerisch-gmain, bayerischgmain; additions and brackets left out. */
export function hostSlugs(name){
 const b=ascii(name).replace(/\(.*?\)/g,'').replace(/\/.*$/,'').replace(/\s+[a-z]{1,3}\.\s?(?:[a-z]{1,3}\.\s?)?\S.*$/,'').replace(/\s+(an der|am|im|in der|in|bei|vor der|ob der|unter|über|ueber|auf der|auf dem)\s+.*$/,'').trim();
 const dash=b.replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),flat=dash.replace(/-/g,'');
 return [...new Set([dash,flat])].filter(s=>s.length>=4);
}
/**
 * Whether a page names the area itself (title, text, or the title and alt attributes, where ALLRIS names its client:
 * <span id="logo" title="Amt Goldberg-Mildenitz">), not only in its address: the test for wildcard hosts.
 */
export function pageNamesArea(html,area){
 const attributes=[...String(html||'').matchAll(/\b(?:title|alt)=["']([^"'<>]{3,160})["']/gi)].map(m=>m[1]).join(' ');
 const page=ascii(title(html)+' '+text(html).slice(0,8000)+' '+text(attributes)).replace(/Ã¤/g,'ae').replace(/Ã¶/g,'oe').replace(/Ã¼/g,'ue').replace(/ÃŸ/g,'ss').replace(/[^a-z0-9]/g,'');
 return hostSlugs(area.shortName||area.name).some(s=>s.replace(/-/g,'').length>=5&&page.includes(s.replace(/-/g,'')));
}

/** Links of a page as crawl.mjs reads them: address and text (with the title attribute), plus frames. */
const stripLink=s=>s.replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&uuml;/g,'ü').replace(/&auml;/g,'ä').replace(/&ouml;/g,'ö').replace(/\s+/g,' ').trim();
// Links in quotes, and without them as some CMS write them (href=https://www.roedermark.sitzung-online.de/public/).
export function anchors(html,base){
 const out=[];
 for(const m of html.matchAll(/<a\b([^>]*?)href\s*=\s*(?:["']([^"'#]+)[^"']*["']|([^\s>"'#]+)[^\s>]*)([^>]*)>([\s\S]{0,400}?)<\/a>/gi)){
  try{const u=new URL((m[2]||m[3]).replace(/&amp;/g,'&').trim(),base);if(!/^https?:$/.test(u.protocol))continue;out.push({url:u.href,text:(stripLink(m[5])+' '+((m[1]+m[4]).match(/title\s*=\s*["']([^"']*)/i)?.[1]||'')).trim().slice(0,120)});}catch{}
 }
 for(const m of html.matchAll(/<(?:iframe|frame)\b[^>]*src\s*=\s*["']([^"']+)["']/gi)){try{out.push({url:new URL(m[1],base).href,text:'(eingebettet)'});}catch{}}
 return out;
}
