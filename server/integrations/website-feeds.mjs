// Pure helpers of the reader "website" (Website der Kommune, öffentliche Bekanntmachungen): they find, on pages and files
// a municipality publishes itself, the documents and entries that may concern meetings of its bodies. Nothing here asks
// the network; the reader decides what is read (robots.txt, origins, limits) and what of it is public.
// - Links are scored by words only. A link that names the non-public part ("nichtöffentlich", "nicht öffentlich") scores
//   -100 so that no threshold can ever take it; noise (jobs, waste calendars, statutes without meeting) scores below 0.
// - Dates are taken as the municipality writes them. Only a time with an explicit zone (UTC "Z", "+0000") is moved to
//   German local time, because a meeting at 00:30 local time stands as 22:30Z on the previous day in a feed.
// - The WordPress endpoints never use the search parameter: the search service of a site is not used.
const ENT={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',auml:'ä',ouml:'ö',uuml:'ü',Auml:'Ä',Ouml:'Ö',Uuml:'Ü',szlig:'ß',ndash:'–',mdash:'—',sbquo:'‚',bdquo:'„',ldquo:'“',rdquo:'”',lsquo:'‘',rsquo:'’',laquo:'«',raquo:'»',lsaquo:'‹',rsaquo:'›',sect:'§',euro:'€',hellip:'…',middot:'·',bull:'•',shy:'',eacute:'é',egrave:'è',aacute:'á',agrave:'à',ccedil:'ç',deg:'°',copy:'©',reg:'®',times:'×',minus:'−'};
const decodeStep=s=>String(s??'').replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi,(m,k)=>{if(k[0]!=='#')return ENT[k]??m;const n=/^#x/i.test(k)?parseInt(k.slice(2),16):Number(k.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):m;});
// Entities escaped once or twice more ("Nicht&amp;ouml;ffentlich") are decoded until nothing changes.
const decode=s=>{let t=String(s??'');for(let k=0;k<5;k++){const n=decodeStep(t);if(n===t)break;t=n;}return t;};
// Text with its line breaks (<br>, ends of paragraphs and list items, written breaks): the head of a part ("Teil B") or a signature
// below the items stays a line of its own.
const BLOCKS='p|div|li|ul|ol|tr|table|h[1-6]|dt|dd|dl|section|article|header|footer|blockquote|pre|hr|address|details|summary';
const stripLines=html=>decode((/&lt;\/?[a-z]/i.test(String(html??''))?decode(html):String(html??'')).replace(/<!--[\s\S]*?-->/g,' ').replace(/<(script|style|noscript)\b[\s\S]*?<\/\1\s*>/gi,' ').replace(/<br\b[^>]*>/gi,'\n').replace(new RegExp(`</?(?:${BLOCKS})\\b[^>]*>`,'gi'),'\n').replace(/<[^>]+>/g,' ')).split(/\r?\n/).map(l=>l.replace(/[ \t\u00a0]+/g,' ').trim()).filter(Boolean).join('\n');
const strip=html=>decode(String(html??'').replace(/<!--[\s\S]*?-->/g,' ').replace(/<(script|style|noscript)\b[\s\S]*?<\/\1\s*>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
const attr=(attrs,name)=>{const m=String(attrs).match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`,'i'));return m?decode(m[1]??m[2]??m[3]):null;};
const safeDecode=s=>{try{return decodeURIComponent(s);}catch{return s;}};
// Scripts are left out of the markup searched for links: their templates hold "<a href" strings that link nowhere.
const markup=html=>String(html??'').replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi,'');
const anchors=html=>[...markup(html).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)].map(m=>({attrs:m[1],inner:m[2]}));
const tags=(html,name)=>[...markup(html).matchAll(new RegExp(`<${name}\\b([^>]*)>`,'gi'))].map(m=>m[1]);
// webcal:// is the same file over https; other schemes (mail, phone, script) name no document.
const resolve=(href,base)=>{const h=String(href??'').trim().replace(/^webcal:\/\//i,'https://');if(!h||h.startsWith('#')||/^(?:mailto|tel|javascript|data|sms|fax|callto|skype|whatsapp):/i.test(h))return null;try{const u=new URL(h,base);if(!/^https?:$/.test(u.protocol))return null;u.hash='';return u.href;}catch{return null;}};
const pathOf=url=>{try{const u=new URL(url);return {path:safeDecode(u.pathname),query:safeDecode(u.search)};}catch{return {path:'',query:''};}};

// --- dates ---------------------------------------------------------------------------------------------------------
const MONTHS={januar:1,jänner:1,jan:1,februar:2,feb:2,märz:3,maerz:3,mär:3,april:4,apr:4,mai:5,juni:6,jun:6,juli:7,jul:7,august:8,aug:8,september:9,sept:9,sep:9,oktober:10,okt:10,november:11,nov:11,dezember:12,dez:12};
const EN={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
const pad=n=>String(n).padStart(2,'0');
const iso=(y,m,d)=>{y=+y;m=+m;d=+d;if(!(y>=1990&&y<=2100&&m>=1&&m<=12&&d>=1&&d<=new Date(Date.UTC(y,m,0)).getUTCDate()))return null;return `${y}-${pad(m)}-${pad(d)}`;};
const LABEL_DATES=[[/(?<!\d)(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})(?!\d)/g,m=>iso(m[3],m[2],m[1])],
 [new RegExp(`(?<!\\d)(\\d{1,2})\\.\\s*(${Object.keys(MONTHS).join('|')})\\.?\\s+(\\d{4})(?!\\d)`,'giu'),m=>iso(m[3],MONTHS[m[2].toLowerCase()],m[1])]];
// File names and paths carry the date in several orders; the one that starts first wins.
const URL_DATES=[LABEL_DATES[0],[/(?<!\d)(\d{4})\/(\d{1,2})\/(\d{1,2})(?!\d)/g,m=>iso(m[1],m[2],m[3])],[/(?<!\d)(\d{4})[-_.](\d{1,2})[-_.](\d{1,2})(?!\d)/g,m=>iso(m[1],m[2],m[3])],
 [/(?<!\d)(\d{1,2})[-_.](\d{1,2})[-_.](\d{4})(?!\d)/g,m=>iso(m[3],m[2],m[1])],[/(?<!\d)(\d{4})(\d{2})(\d{2})(?!\d)/g,m=>iso(m[1],m[2],m[3])]];
const firstDate=(s,patterns)=>{let best=null;for(const [re,make] of patterns)for(const m of String(s??'').matchAll(re)){const d=make(m);if(d){if(!best||m.index<best.index)best={index:m.index,date:d};break;}}return best?.date??null;};
const urlDate=url=>{const {path,query}=pathOf(url);return firstDate(path+query,URL_DATES);};
// German local time follows the EU rule: summer time from the last Sunday of March to the last Sunday of October,
// both at 01:00 UTC.
const lastSunday=(y,m)=>{const d=new Date(Date.UTC(y,m+1,0));return Date.UTC(y,m,d.getUTCDate()-d.getUTCDay(),1);};
const berlin=ms=>{const y=new Date(ms).getUTCFullYear(),summer=ms>=lastSunday(y,2)&&ms<lastSunday(y,9),l=new Date(ms+(summer?2:1)*3600000).toISOString();return {date:l.slice(0,10),time:l.slice(11,16)};};
// An ISO stamp keeps its written day unless it names a zone; RFC 822 ("Wed, 14 Oct 2026 18:00:00 +0200") likewise.
const stamp=value=>{const s=String(value??'').trim();if(!s)return null;
 const i=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?)?/i);
 if(i){const date=iso(i[1],i[2],i[3]);if(!date)return null;if(i[4]&&i[6]){const ms=Date.parse(`${i[1]}-${i[2]}-${i[3]}T${i[4]}:${i[5]}:00${i[6].toUpperCase()==='Z'?'Z':i[6].replace(/^([+-]\d{2})(\d{2})$/,'$1:$2')}`);if(!Number.isNaN(ms))return berlin(ms);}return {date,time:i[4]?`${i[4]}:${i[5]}`:null};}
 const r=s.match(/(\d{1,2})\s+([a-z]{3})[a-z]*\.?\s+(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/i);
 if(r&&EN[r[2].toLowerCase()]){const y=r[3].length===2?2000+Number(r[3]):r[3],date=iso(y,EN[r[2].toLowerCase()],r[1]);if(!date)return null;
  if(r[4]&&/(?:[+-]\d{4}|\b(?:GMT|UTC?|Z|[ECMP][SD]T))\s*$/i.test(s)){const ms=Date.parse(s);if(!Number.isNaN(ms))return berlin(ms);}return {date,time:r[4]?`${pad(r[4])}:${r[5]}`:null};}
 const g=firstDate(s,LABEL_DATES);return g?{date:g,time:null}:null;};
const dayOf=value=>stamp(value)?.date??null;

// --- addresses that are never read ------------------------------------------------------------------------------------
// A council information system, also one on the municipality's own domain (ratsinfo.<domain>, /buergerinfo/, si0040.asp,
// PIO, PIWi, RISI, the council service of mein-intra.net that a website embeds on a page of its own,
// …?href=/councilservice/…). An area may be searched because its RIS forbids programs or is not supported; neither the search nor
// the reader reads that system through another door. "/sitzungsdienst" counts as a system at the root of a domain and with
// a system's paths below it (sitzung/, gremium/ …), not as a section of a CMS (lg-uder.de/buergerservice/sitzungsdienst/sitzungen
// lists the invitations as PDF).
const RIS_HOST=/^(?:ratsinfo|ratsinformation|buergerinfo|bürgerinfo|sessionnet|session|ris|risi|rim|sd|sdnet|allris|gremien|gremieninfo|sitzungsdienst|kreistagsinfo|bi|sitzungen|piwi|pio)[.-]/i;
const RIS_ADDRESS=/sessionnet|\bsi00\d\d\b|\/(?:si|to|vo|kp|gr|pa|au|yw|do)0\d{3}\.(?:asp|php)|\/(?:si|to|vo|kp|gr)0\d0(?:[?#]|$)|allris|buergerinfo|bürgerinfo|ratsinfo|sdnet|ris-portal\.de|komuna\.net|gremien\.info|more-rubin|kdz-ws\.net|sitzung-online\.de|ratsinfomanagement|cm-ratsinfos|komm\.one|zv-kisa\.de|\/oparl\b|\/bi\/|\/ris\/|\/risi(?:[/;?]|$)|\/piwi(?:[/;?]|$)|\/sitzung\/detail(?:[/;?]|$)|[?&]aktiv=tagesordnungen|\.[a-z]+\/sitzungsdienst(?:[/;?]|$)|\/sitzungsdienst\/(?:sitzung|gremium|vorlage|person|recherche)(?:[/;?.]|$)|\/gremieninfo(?:[/;?.]|$)|sessionweb|provox|\/ti_\d+|ekom21|kommune-aktiv\.de|councilservice|mein-intra\.net/i;
// File storage of a website CMS on a host of its provider: the municipality's own pages link their notices there
// (daten2.verwaltungsportal.de for the websites that verwaltungsportal.de runs). Such an origin is read only as a
// document origin that an entry names in alsoFrom, because the municipality's list pages link it; never as a website.
export const CMS_FILE_HOST=/^daten\d*\.verwaltungsportal\.de$/i;
/** Whether an address lies on the file storage of a website CMS (CMS_FILE_HOST), over https. */
export const isCmsFileUrl=url=>{try{const u=new URL(url);return u.protocol==='https:'&&CMS_FILE_HOST.test(u.hostname)&&!u.username&&!u.password;}catch{return false;}};
/** Whether an address belongs to a council information system (host name or a path typical of one). */
export function isRisLink(url){try{const u=new URL(url);return RIS_HOST.test(u.hostname)||RIS_ADDRESS.test(u.hostname+u.pathname+u.search);}catch{return true;}}
// The site's own search: its pages and its query parameters (TYPO3 ke_search and Solr, WordPress "s", Joomla "q").
const SEARCH=/\/(?:suche|search|suchergebnis(?:se)?)(?:[/.?#;]|$)|[?&](?:q|s|query|search|sword|keyword|keywords|suchbegriff|searchterm|tx_kesearch_pi1|tx_solr)(?:%5B|\[|=)/i;
/** Whether an address asks the website's search function; such addresses are never read. */
export const isSearchLink=url=>SEARCH.test(String(url??''));

// --- links -----------------------------------------------------------------------------------------------------------
const PAGE_EXT=new Set(['html','htm','php','php3','php5','phtml','asp','aspx','jsp','jsf','shtml','cfm','do']);
const kindOf=(url,type)=>{const t=String(type??'').toLowerCase();if(t.includes('pdf'))return 'pdf';if(t.includes('calendar'))return 'ics';if(/rss|atom/.test(t))return 'feed';if(t.includes('html'))return 'html';
 const {path,query}=pathOf(url),ext=path.match(/\.([a-z][a-z0-9]{1,4})$/i)?.[1]?.toLowerCase();
 // Download scripts name the file in the query (IKISS: download.php?fid=….PDF).
 if(ext==='pdf'||/\.pdf(?![a-z0-9])/i.test(query))return 'pdf';
 if(['ics','ical','ifb'].includes(ext))return 'ics';
 if(['rss','atom'].includes(ext)||/\/(?:feed|rss|atom)(?:\.xml)?\/?$/i.test(path)||/[?&](?:type=9818|format=feed)(?:&|$)/i.test(query))return 'feed';
 if(!ext||PAGE_EXT.has(ext))return 'html';return 'other';};
// A link that holds only an image is named by the image's alt text.
const labelOf=({attrs,inner})=>{const img=String(inner).match(/<img\b([^>]*)>/i)?.[1];const parts=[strip(inner)||(img?attr(img,'alt'):''),attr(attrs,'title'),attr(attrs,'aria-label')].map(p=>String(p??'').replace(/\s+/g,' ').trim()).filter(Boolean);
 return parts.filter((p,i)=>parts.findIndex(q=>q.toLowerCase()===p.toLowerCase())===i).join(' ');};
/** Addresses of PDF files a text names (links of its markup, plain addresses in a calendar text): [{url,label,date,kind:'pdf'}]. */
export function pdfLinksOf(text,base){
 const out=new Map();
 for(const l of documentLinks(text,base))if(l.kind==='pdf')out.set(l.url,l);
 for(const m of String(text??'').replace(/<[^>]+>/g,' ').matchAll(/https?:\/\/[^\s"'<>()]+/gi)){const url=resolve(m[0].replace(/[.,;:]+$/,''),base);if(url&&kindOf(url)==='pdf'&&!out.has(url))out.set(url,{url,label:'',date:urlDate(url),kind:'pdf'});}
 return [...out.values()];
}
/**
 * PDF files a page shows in a frame instead of linking them: <iframe|embed|object> whose address is the file, the viewer of a
 * PDF plugin that names it ("?file=https://…/x.pdf"), or the PDF Embedder plugin ("?pdfemb-data=<base64 of {"url":"…"}>").
 * The frame's title names the document. [{url,label}]
 */
export function embeddedPdfs(html,base){
 const out=[];
 for(const m of markup(html).matchAll(/<(?:iframe|embed|object)\b([^>]*)>/gi)){
  const attrs=m[1],label=String(attr(attrs,'title')??'').replace(/\s+/g,' ').trim();
  for(const raw of [attr(attrs,'data-src'),attr(attrs,'src'),attr(attrs,'data')]){
   if(!raw||/^data:/i.test(raw))continue;
   let target=null;
   try{
    const u=new URL(raw,base),emb=u.searchParams.get('pdfemb-data'),file=u.searchParams.get('file');
    if(emb){try{target=JSON.parse(Buffer.from(emb.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8')).url;}catch{/* not the plugin's data */}}
    else target=file||u.href;
   }catch{continue;}
   const url=target&&resolve(String(target),base);
   if(url&&kindOf(url)==='pdf'&&!out.some(o=>o.url===url))out.push({url,label});
  }
 }
 return out;
}
/** Links of a page: [{url,label,date,kind}], fragments removed, relative addresses resolved, one entry per address. */
export function documentLinks(html,base){
 const out=new Map();
 for(const e of embeddedPdfs(html,base)){if(!out.has(e.url))out.set(e.url,{url:e.url,label:e.label,type:'application/pdf'});}
 for(const a of anchors(html)){const url=resolve(attr(a.attrs,'href'),base);if(!url)continue;const label=labelOf(a);
  // An icon and a text often link the same file; their words are joined.
  const seen=out.get(url);if(seen){if(label&&!seen.label.toLowerCase().includes(label.toLowerCase()))seen.label=`${seen.label} ${label}`.trim();continue;}
  out.set(url,{url,label,type:attr(a.attrs,'type')});}
 return [...out.values()].map(({url,label,type})=>({url,label,date:firstDate(label,LABEL_DATES)??urlDate(url),kind:kindOf(url,type)}));
}

// --- scores ----------------------------------------------------------------------------------------------------------
// Words are compared without umlauts and punctuation, so that a slug ("nicht-oeffentliche-sitzung") reads like a label.
// NFC first: pdf.js and some editors write "ö" as "o" with a combining or spacing diaeresis.
const norm=s=>String(s??'').replace(/\u00a8\s?([AOUaou])/g,'$1\u0308').replace(/([AOUaou])\u00a8/g,'$1\u0308').normalize('NFC').toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,' ').trim();
// Also the short forms of labels and file names: "(nö)", "N.Ö.", "protokoll_noe_…", "nichtoeff-…".
// Also typos and abbreviations: "nichtöfentlich", "nichtöfftl.", "n.öff.", "nöff.", "NÖS", "geschl. Sitzung", "(vertr.)".
// Also "NÖT"/"NOeT" (nichtöffentlicher Teil), "(geschl.)", "geheim" and a name part "np" (gr-2026-09-16-np.pdf).
// Also "NS", "NOS", "N-Teil", "N-Sitzung", "Teil B", a name part "-N" before the extension, "intern", "nur für Ratsmitglieder" and
// typos ("Nichföffentlich", "Nicht öffentich").
// Also "(o. Ö.)", "nichtöffntl.", "ohneÖff", "…_ohne_Oeffentlichkeit.pdf".
// Also "(nur Ratsmitglieder)", "(GR-intern)", "(Interna)", a folder "/intern/" and "/ratsmitglieder/protokolle/".
const NONPUBLIC=/nicht ?o?e?ff?(?:entl|n?tl\b|\b)|\bo oe\b|\bohne ?o?e?ff|\bnich[a-z]? ?oe?ff?entl|\bnicht ?o?e?ff?enti?ch\b|vertraulich|\bvertr\b|geschlossene[nr]? (?:sitzung|teil)|\bgeschl\b|\bgeheim\b|\bnp\b|\bn ?oe(?: ?ff?(?: ?tl)?)?(?: ?[st])?\b|unter ausschluss (?:der|von) (?:presse und (?:der )?)?oeffentlichkeit|\bteil ?[nb]\b|\bn (?:teil|sitzung)\b|\bns\b|\bnos\b|\b(?:n|intern) (?:pdf|html?|php|aspx?|docx?)\b|\bnur (?:fuer )?(?:die )?(?:[a-z]+ )?(?:[a-z]*mitglieder|[a-z]*raete)\b|\binterna?\b|\b[a-z]*mitglieder (?:[a-z]+ )?(?:protokoll\w*|niederschrift\w*|unterlagen|sitzungsunterlagen)\b/;
// Old servers write umlauts of addresses in Latin-1 ("nicht%F6ffentlich").
const latinUmlauts=s=>String(s??'').replace(/%(?:f6|d6)/gi,'oe').replace(/%(?:e4|c4)/gi,'ae').replace(/%(?:fc|dc)/gi,'ue').replace(/%df/gi,'ss');
const BODY=/gemeinderat|stadtrat|marktrat|ortschaftsrat|ortsrat|ortsbeirat|beirat\b|bezirksrat|kreistag|gemeindevertret|stadtverordnet|stadtvertretung|ausschuss|ausschuess|\brat der (?:stadt|gemeinde|verbandsgemeinde|samtgemeinde)|ratssitzung|gemeindeversammlung/;
// Short forms of bodies at the start of a file name: Gemeinderat, Marktgemeinderat, Gemeinschaftsversammlung, Stadtrat, …
const BODY_SHORT=/^(?:gr|mgr|lgr|sr|gv|vv|stv|gvv)(?: |$)/;
/** Links whose score reaches this count as documents of meetings. */
export const SESSION_THRESHOLD=3;
/** How much a link looks like a document of a meeting: -100 for the non-public part, below 0 for noise. */
export function sessionScore({url,label}={}){
 const t=norm(`${decode(label??'')} ${Object.values(pathOf(url)).join(' ')}`);
 if(NONPUBLIC.test(t)||NONPUBLIC.test(norm(latinUmlauts(url))))return -100;
 const sitting=/sitzung/.test(t),body=BODY.test(t);
 let n=sitting&&body?3:sitting||body?1:0;
 if(/tagesordnung/.test(t))n+=3;
 // A PDF in a folder of the municipality's meeting service ("/pdf/sitzungsdienst/Penkun/Penkun_09_09_2026.pdf") whose link text is
 // only a date (or nothing): the folder says what the document is, the date when. The text decides what is public.
 if(sitting&&!body&&kindOf(url)==='pdf'&&/(?:^| )(?:sitzungsdienst|sitzungsunterlagen|sitzungsdokumente|sitzungsprotokolle)(?: |$)/.test(norm(pathOf(url).path.replace(/\/[^/]*$/,'')))&&/^(?:\d{1,2} \d{1,2} (?:\d{2}|\d{4})|)$/.test(norm(decode(label??''))))n+=2;
 if(/einladung/.test(t)&&(sitting||body))n+=2;
 // "Bekanntmachung SR 2026-09-24.pdf" in the folder of the town council: the notice of a body's meeting, named by its date.
 // Also a file name that starts with the short form of a body ("MGR-2026-060_Bekanntmachung_13.10.2026.pdf").
 const filed=kindOf(url)==='pdf'&&(firstDate(decode(label??''),LABEL_DATES)||urlDate(url));
 const short=filed&&!body&&BODY_SHORT.test(norm(pathOf(url).path.split('/').pop()));
 if(short&&/bekanntmachung|einladung|tagesordnung/.test(t))n+=1;
 if(/bekanntmachung/.test(t)&&(sitting||(body||short)&&filed))n+=2;
 if(/niederschrift|sitzungsbericht|sitzungsprotokoll/.test(t))n+=3;else if(/protokoll/.test(t))n+=sitting||body?2:0;
 if(/beschluesse|beschlussuebersicht|beschlussfassungen|beschlussbuch|beschlussliste|gefasste beschl/.test(t))n+=3;
 if(/\baus (?:dem|der|den) (?:\w+ )?(?:gemeinderat|stadtrat|marktgemeinderat|ortschaftsrat|rat|sitzung|gemeindevertretung|stadtverordnetenversammlung|ausschuss|ausschuessen|kreistag)\b/.test(t))n+=3;
 if(/ratssitzung/.test(t))n+=2;
 // Official gazettes hold notices of meetings among much else: worth a look, never enough on their own.
 if(/amtsblatt|mitteilungsblatt|gemeindeblatt|amtsbote|gemeindebote|nachrichtenblatt|amtliche nachrichten/.test(t)){
  n+=kindOf(url)==='pdf'?2:1;
  // An issue of the gazette as PDF with its date ("Mitteilungsblatt vom 07. Oktober 2026"): what is in it is decided by the text.
  if(kindOf(url)==='pdf'&&(firstDate(decode(label??''),LABEL_DATES)||urlDate(url)))n+=1;
 }
 if(!sitting&&/haushaltssatzung|haushaltsplan|nachtragshaushalt/.test(t))n-=4;
 if(!sitting&&/bebauungsplan|flaechennutzungsplan|bauleitplan|planfeststellung|\bb plan\b/.test(t))n-=4;
 if(/stellenausschreibung|stellenangebot|ausbildungsplatz|ausbildungsstelle|\bjobs?\b|karriere/.test(t))n-=6;
 if(/abfallkalender|abfuhrkalender|abfuhrtermin|muellabfuhr|muellkalender|wertstoffhof|gelbe[rn]? sack|biotonne/.test(t))n-=6;
 if(!body&&/veranstaltung|konzert|kirmes|kerwe|weihnachtsmarkt|flohmarkt|\bfest\b|festival|ausstellung/.test(t))n-=4;
 if(/datenschutz|impressum|barrierefreiheit|cookie/.test(t))n-=8;
 if(/formular|vordruck/.test(t))n-=6;
 if(/wahlbekanntmachung|wahlvorschl|briefwahl|waehlerverzeichnis|wahlschein|wahlbezirk|stimmbezirk|wahlergebnis/.test(t)||!sitting&&/bekanntmachung\b.*\bwahl\b|\b(?:bundestags|landtags|kommunal|europa|buergermeister|landrats|gemeinderats|stadtrats|kreistags)wahl/.test(t))n-=6;
 return n;
}
const HEADINGS=[/\bsitzungen\b|sitzungstermine|sitzungskalender/,/bekanntmachungen/,/amtstafel|amtliche bekanntmachungen|schwarzes brett/,/gemeinderat|stadtrat|gemeindevertretung|stadtverordnet/,/niederschriften|protokolle|sitzungsberichte/];
/** How strongly a page is a list of meeting documents: its links that reach the threshold, plus 2 per kind of heading. */
export function listPageScore(html,url){
 const links=documentLinks(html,url).filter(l=>sessionScore(l)>=SESSION_THRESHOLD).length;
 const heads=[...markup(html).matchAll(/<(h[1-4]|title)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi)].map(m=>norm(strip(m[2]))).join(' | ');
 return links+2*HEADINGS.filter(re=>re.test(heads)).length;
}

// --- pagination ------------------------------------------------------------------------------------------------------
const PAGE_KEY=/^(?:page|seite|p|paged|pg|start|offset|tx_news_pi1\[@widget_0\]\[currentpage\]|.*\[currentpage\])$/i;
const pageNumber=u=>{for(const [k,v] of u.searchParams)if(PAGE_KEY.test(k)&&/^\d+$/.test(v))return {key:k.toLowerCase(),value:Number(v)};const p=u.pathname.match(/\/(?:page|seite)\/(\d+)\/?$/i);return p?{key:'/page',value:Number(p[1])}:null;};
// "/bekanntmachungen/page/2/" (WordPress) belongs to "/bekanntmachungen/", and "index.php" to its folder.
const listRoot=path=>path.replace(/\/(?:page|seite)\/\d+\/?$/i,'').replace(/\/index\.(?:php|html?)$/i,'').replace(/\/+$/,'')||'/';
const NEXT=/^(?:»|›|>{1,2}|weiter\b|vorwärts|nächste|ältere|seite 2\b|next\b|older\b)/;
/** Following pages of the same list (same origin and list path), at most three; the page itself and earlier pages are not. */
export function paginationLinks(html,pageUrl){
 let page;try{page=new URL(pageUrl);page.hash='';}catch{return [];}
 const here=pageNumber(page),root=listRoot(page.pathname),found=new Map();
 const offer=(href,rel,label)=>{const url=resolve(href,page.href);if(!url||url===page.href||found.has(url))return;const u=new URL(url);if(u.origin!==page.origin||listRoot(u.pathname)!==root)return;
  const n=pageNumber(u),next=/(?:^|\s)next(?:\s|$)/i.test(rel??''),textual=NEXT.test(label.toLowerCase().replace(/\s+/g,' ').trim());
  // A "weiter" that names no page leads into an article; only rel=next is taken without a page number.
  if(!n&&!next)return;
  if(n){const now=here&&here.key===n.key?here.value:(/^(?:start|offset)$/.test(n.key)?0:1);if(n.value<=now)return;}
  found.set(url,{url,rank:next?0:textual?1:2,value:n?.value??0});};
 for(const a of tags(html,'link'))offer(attr(a,'href'),attr(a,'rel'),'');
 for(const a of anchors(html))offer(attr(a.attrs,'href'),attr(a.attrs,'rel'),labelOf(a));
 return [...found.values()].sort((a,b)=>a.rank-b.rank||a.value-b.value).slice(0,3).map(f=>f.url);
}

// --- feeds -----------------------------------------------------------------------------------------------------------
/** Feeds a page announces or links: [{url,type:'rss'|'atom'|'ics',title}]. */
export function feedLinks(html,base){
 const out=new Map(),add=(url,type,title)=>{if(url&&type&&!out.has(url))out.set(url,{url,type,title:title??''});};
 for(const a of tags(html,'link')){const rel=String(attr(a,'rel')??'').toLowerCase().split(/\s+/);if(!rel.includes('alternate'))continue;const t=String(attr(a,'type')??'').toLowerCase();
  add(resolve(attr(a,'href'),base),t.includes('rss')?'rss':t.includes('atom')?'atom':t.includes('calendar')?'ics':null,attr(a,'title'));}
 for(const a of anchors(html)){const href=String(attr(a.attrs,'href')??'').trim(),url=resolve(href,base);if(!url)continue;const t=String(attr(a.attrs,'type')??'').toLowerCase(),{path,query}=pathOf(url);
  // TYPO3 serves its news feed as page type 9818, Joomla as format=feed (type=rss|atom).
  const type=/^webcal:/i.test(href)||/\.(?:ics|ical|ifb)$/i.test(path)||t.includes('calendar')||/[?&](?:format|type|export)=ic(?:s|al)(?:&|$)/i.test(query)?'ics'
   :t.includes('atom')||/[?&](?:type|format)=atom(?:&|$)/i.test(query)||/\/atom(?:\.xml)?\/?$|\.atom$/i.test(path)?'atom'
   :/rss|feed/.test(t)||/[?&](?:type=(?:9818|rss|feed)|format=feed)(?:&|$)/i.test(query)||/\/(?:feed|rss)(?:\.xml)?\/?$|\.rss$|rss\.xml$/i.test(path)?'rss':null;
  add(url,type,attr(a.attrs,'title')||strip(a.inner));}
 return [...out.values()];
}
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const elements=(block,name)=>[...String(block).matchAll(new RegExp(`<${esc(name)}(?=[\\s>/])([^>]*?)(?:/>|>([\\s\\S]*?)</${esc(name)}\\s*>)`,'gi'))].map(m=>({attrs:m[1]??'',body:m[2]??''}));
const element=(block,name)=>elements(block,name)[0]??null;
// CDATA is taken as written; everything else is entity-decoded once, which turns escaped HTML into HTML.
const xmlText=body=>{const s=String(body??'');let out='',last=0;for(const m of s.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)){out+=decodeStep(s.slice(last,m.index))+m[1];last=m.index+m[0].length;}return (out+decodeStep(s.slice(last))).trim();};
const firstText=(block,names)=>{for(const n of names){const e=element(block,n);const v=e&&xmlText(e.body);if(v)return v;}return '';};
/** Entries of an RSS 2.0 or Atom feed: [{title,url,date,html}]. */
export function parseFeed(xml,base){
 const s=String(xml??''),out=[];
 for(const m of s.matchAll(/<(item|entry)(?=[\s>])[^>]*>([\s\S]*?)<\/\1\s*>/gi)){const b=m[2];
  let url=null;for(const l of elements(b,'link')){const rel=attr(l.attrs,'rel');if(rel&&rel.toLowerCase()!=='alternate')continue;url=resolve(attr(l.attrs,'href')??xmlText(l.body),base);if(url)break;}
  // A guid is an address only where it says so and is written as one.
  if(!url){const g=element(b,'guid'),v=g?xmlText(g.body):'';if(g&&attr(g.attrs,'isPermaLink')!=='false'&&/^https?:\/\//i.test(v))url=resolve(v);}
  out.push({title:strip(firstText(b,['title'])),url,date:dayOf(firstText(b,['pubDate','dc:date','published','updated','issued'])),html:firstText(b,['content:encoded','content','description','summary'])});}
 return out;
}
const unescapeIcs=v=>v.replace(/\\([nN,;\\])/g,(m,c)=>c==='n'||c==='N'?'\n':c);
/**
 * Events of an iCalendar file: [{uid,summary,date,time,description,url,location,organizer,cancelled,attachments}]; recurrence rules
 * are not expanded. cancelled: STATUS:CANCELLED, or a calendar of METHOD:CANCEL.
 */
export function parseIcs(text){
 const lines=String(text??'').replace(/\r\n?/g,'\n').replace(/\n[ \t]/g,'').split('\n'),out=[];let ev=null,nested=0;
 const cancelAll=/^METHOD:\s*CANCEL\s*$/im.test(lines.join('\n'));
 for(const line of lines){const m=line.match(/^([A-Za-z0-9-]+)((?:"[^"]*"|[^":])*):(.*)$/);if(!m)continue;const name=m[1].toUpperCase(),value=m[3];
  if(name==='BEGIN'){if(value.trim().toUpperCase()==='VEVENT'&&!ev){ev={uid:'',summary:'',date:null,time:null,description:'',url:null,location:'',organizer:'',cancelled:cancelAll,attachments:[]};nested=0;}else if(ev)nested++;continue;}
  if(name==='END'){if(!ev)continue;if(nested){nested--;continue;}if(value.trim().toUpperCase()==='VEVENT'){if(ev.date)out.push(ev);ev=null;}continue;}
  if(!ev||nested)continue;
  const params=Object.fromEntries([...m[2].matchAll(/;([A-Za-z0-9-]+)=("[^"]*"|[^;]*)/g)].map(p=>[p[1].toUpperCase(),p[2].replace(/^"|"$/g,'')]));
  if(name==='DTSTART'){const d=value.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(?:\d{2})?(Z)?)?$/i);if(!d)continue;
   // A UTC time (or TZID=UTC) is moved to German local time; a TZID of a German zone or a floating time stays as written.
   if(!d[4]||String(params.VALUE).toUpperCase()==='DATE')Object.assign(ev,{date:iso(d[1],d[2],d[3]),time:null});
   else if(d[6]||/^(?:utc|etc\/utc|gmt|z)$/i.test(params.TZID??''))Object.assign(ev,iso(d[1],d[2],d[3])?berlin(Date.UTC(+d[1],d[2]-1,+d[3],+d[4],+d[5])):{date:null,time:null});
   else Object.assign(ev,{date:iso(d[1],d[2],d[3]),time:`${d[4]}:${d[5]}`});}
  else if(name==='UID')ev.uid=value.trim();else if(name==='SUMMARY')ev.summary=unescapeIcs(value).trim();else if(name==='DESCRIPTION')ev.description=unescapeIcs(value).trim();
  else if(name==='LOCATION')ev.location=unescapeIcs(value).trim();else if(name==='URL')ev.url=resolve(value)??null;
  else if(name==='ORGANIZER')ev.organizer=String(params.CN??unescapeIcs(value).replace(/^mailto:/i,'')).trim();
  else if(name==='STATUS'){if(/^CANCELL?ED$/i.test(value.trim()))ev.cancelled=true;}
  else if(name==='ATTACH'){const u=resolve(value.trim());if(u)ev.attachments.push(u);}}
 return out;
}

// --- sitemaps --------------------------------------------------------------------------------------------------------
/** A sitemap index ({sitemaps}) or a URL set ({urls:[{url,lastmod}]}). */
export function parseSitemap(xml,base){
 const s=String(xml??''),loc=b=>{const e=element(b,'loc');return e?resolve(xmlText(e.body),base):null;},sitemaps=[],urls=[];
 for(const m of s.matchAll(/<sitemap(?=[\s>])[^>]*>([\s\S]*?)<\/sitemap\s*>/gi)){const u=loc(m[1]);if(u)sitemaps.push(u);}
 for(const m of s.matchAll(/<url(?=[\s>])[^>]*>([\s\S]*?)<\/url\s*>/gi)){const u=loc(m[1]);if(u)urls.push({url:u,lastmod:dayOf(xmlText(element(m[1],'lastmod')?.body))});}
 return {sitemaps,urls};
}
/** Sitemaps named in a robots.txt ("Sitemap:" lines, any case). */
export function robotsSitemaps(robotsText){
 const out=[];for(const m of String(robotsText??'').matchAll(/^[ \t]*sitemap[ \t]*:[ \t]*(\S+)/gim)){const u=resolve(m[1]);if(u&&!out.includes(u))out.push(u);}return out;
}

// --- WordPress -------------------------------------------------------------------------------------------------------
/** The address of the WordPress REST API a page announces (<link rel="https://api.w.org/">), or null. */
export function wpApiRoot(html,base){
 for(const a of tags(html,'link')){if(!String(attr(a,'rel')??'').split(/\s+/).includes('https://api.w.org/'))continue;const u=resolve(attr(a,'href'),base);if(u)return u;}return null;
}
/** Posts and PDF media published after a day; the search parameter of the API is never used. */
export function wpEndpoints(root,fromIso){
 const day=String(fromIso??'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw new RangeError(`wpEndpoints: kein Datum: ${fromIso}`);
 const after=`after=${day}T00:00:00&per_page=50`;
 // Sites without pretty permalinks answer under "?rest_route=/" instead of "/wp-json/".
 const at=(route,params)=>/[?&]rest_route=/.test(root)?root.replace(/([?&]rest_route=)[^&]*/,`$1/${route}`)+'&'+params:root.replace(/\/?$/,'/')+route+'?'+params;
 return {posts:at('wp/v2/posts',`${after}&orderby=date&order=desc&_fields=id,date,link,title,content`),media:at('wp/v2/media',`${after}&mime_type=application/pdf&_fields=id,date,link,title,source_url`)};
}
const jsonList=json=>{let v=json;if(typeof v==='string'){try{v=JSON.parse(v);}catch{return [];}}return Array.isArray(v)?v.filter(x=>x&&typeof x==='object'):[];};
const rendered=v=>v&&typeof v==='object'?v.rendered??'':v??'';
/** Posts of the REST API: [{title,url,date,html}]. */
export function parseWpPosts(json){
 return jsonList(json).map(p=>({title:strip(rendered(p.title)),url:resolve(p.link),date:dayOf(p.date),html:String(rendered(p.content))})).filter(p=>p.url);
}
/** PDF media of the REST API: [{title,url,date,kind:'pdf'}]. */
export function parseWpMedia(json){
 return jsonList(json).filter(m=>!m.mime_type||/pdf/i.test(m.mime_type)).map(m=>({title:strip(rendered(m.title)),url:resolve(m.source_url),date:dayOf(m.date),kind:'pdf'})).filter(m=>m.url);
}

// --- page metadata ---------------------------------------------------------------------------------------------------
// The place of an event as one line: its name and address ("Rathaus Nachbarhausen, Kirchplatz 2, 99999 Nachbarhausen").
const placeOf=v=>[].concat(v??[]).map(p=>typeof p==='string'?strip(p):p&&typeof p==='object'?[p.name,...(typeof p.address==='string'?[p.address]:[p.address?.streetAddress,[p.address?.postalCode,p.address?.addressLocality].filter(Boolean).join(' ')])].map(x=>strip(x)).filter(Boolean).join(', '):'').filter(Boolean).join('; ');
const isEvent=n=>[].concat(n['@type']??[]).some(t=>/(?:^|[:/])\w*Event$/.test(String(t)));
/** schema.org events of a page (JSON-LD, also inside @graph and arrays): [{name,date,time,description,url}]. */
export function jsonLdEvents(html,base){
 const out=[],seen=new Set();
 const walk=(n,depth)=>{if(!n||typeof n!=='object'||depth>8)return;if(Array.isArray(n)){for(const x of n)walk(x,depth+1);return;}
  if(isEvent(n)){const at=stamp(n.startDate);if(!at)return;const id=typeof n['@id']==='string'&&/^https?:/i.test(n['@id'])?n['@id']:null;
   const ev={name:strip(n.name),date:at.date,time:at.time,description:stripLines(n.description),url:resolve(typeof n.url==='string'?n.url:id,base),
    location:placeOf(n.location),organizer:[].concat(n.organizer??[]).map(o=>typeof o==='string'?o:o?.name).filter(Boolean).map(strip).join(', '),
    cancelled:/(?:Cancelled|Postponed)$/i.test(String(n.eventStatus?.['@id']??n.eventStatus??'')),links:pdfLinksOf(String(n.description??''),base).map(l=>l.url)};const key=`${ev.name}|${ev.date}|${ev.url}`;if(!seen.has(key)){seen.add(key);out.push(ev);}return;}
  for(const v of Object.values(n))walk(v,depth+1);};
 for(const m of String(html??'').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){if(!/ld\+json/i.test(attr(m[1],'type')??''))continue;
  try{walk(JSON.parse(m[2].trim().replace(/^<!--|-->$/g,'').replace(/^\/\/\s*<!\[CDATA\[|\/\/\s*\]\]>$/g,'').trim()),0);}catch{/* broken JSON-LD names no event */}}
 return out;
}
/** The content of <meta name="generator"> (TYPO3, WordPress, IKISS, Weblication, Contao, Joomla! …), or null. */
export function generatorOf(html){
 for(const a of tags(html,'meta'))if(String(attr(a,'name')??'').toLowerCase()==='generator'){const c=String(attr(a,'content')??'').trim();if(c)return c;}return null;
}
