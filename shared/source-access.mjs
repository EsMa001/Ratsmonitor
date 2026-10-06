// Access to the council information of an area: over which channel programs can read it, and what limits that.
//
// The channels are weighed in a fixed order (decision of 06.10.2026):
//   1. An OParl interface that answers → "OParl verfügbar".
//   2. Otherwise another documented or recognisable API: CKAN of an open-data portal, an open-data file, the JSON
//      interface of an app → "API verfügbar", or "API verfügbar, Leser/Connector fehlt" while no reader uses it.
//   3. Otherwise the HTML pages of a system or website: "System ohne Leser" while no reader exists; else robots.txt
//      gives the label: "robots.txt sperrt HTML-Zugriff" where it disallows the reader's path, else "Scraping erlaubt".
//   4. Otherwise a technical block (HTTP 401/403, web firewall, access check, login, members' area) → "Zugriffsschutz".
//   5. Otherwise → "Kein maschinenlesbarer Zugriff gefunden".
// robots.txt governs the crawling of HTML pages. It never overrides OParl or an API offered for programs, even where
// its rules name the API's path: robots.txt of the Transparenzportal Hamburg disallows its search interface, while the
// portal documents that interface for automated retrieval (transparenz.hamburg.de/api-796358). Since 05.10.2026
// robots.txt is recorded, not obeyed (server/integrations/robots-policy.mjs); the label says what it says about the
// HTML pages, it does not stop a reader.
//
// Used by the gap atlas (scripts/dashboard/build.mjs, which also writes server/integrations/source-access.json for the
// areas without source) and by the admin view (server/integrations/admin-data.mjs).

/**
 * The statuses in the order of the hierarchy. group: machine (interface), html (pages), reader (reader missing),
 * closed (no automated access). color: colour of the admin map (the gap atlas has its own light and dark colours).
 */
export const ACCESS_STATUSES=Object.freeze([
 {id:'oparl',label:'OParl verfügbar',group:'machine',automated:true,color:'#0f766e',explain:'Die OParl-Schnittstelle antwortet; sie ist für Programme gedacht. robots.txt gilt für sie nicht.'},
 {id:'api',label:'API verfügbar',group:'machine',automated:true,color:'#14b8a6',explain:'Eine dokumentierte oder erkennbare Schnittstelle (CKAN, offene Daten, JSON-Schnittstelle der Anwendung) wird gelesen. robots.txt gilt für sie nicht.'},
 {id:'api-noreader',label:'API verfügbar, Leser/Connector fehlt',group:'machine',automated:true,color:'#99f6e4',explain:'Eine Schnittstelle ist vorhanden, aber noch kein Leser nutzt sie.'},
 {id:'scraping',label:'Scraping erlaubt',group:'html',automated:true,color:'#60a5fa',explain:'Keine Schnittstelle; die öffentlichen HTML-Seiten werden gelesen, robots.txt erlaubt das oder fehlt.'},
 {id:'robots',label:'robots.txt sperrt HTML-Zugriff',group:'html',automated:true,color:'#a78bfa',explain:'Keine Schnittstelle; robots.txt untersagt Programmen die HTML-Seiten. Technisch sind sie erreichbar; seit dem 05.10.2026 wird robots.txt festgehalten, nicht befolgt.'},
 {id:'blocked',label:'Zugriffsschutz',group:'closed',automated:false,color:'#ad392d',explain:'Technische Sperre (HTTP 401/403, Web-Firewall, Zugriffsprüfung, Anmeldung); sie wird nicht umgangen.'},
 {id:'noreader',label:'System ohne Leser',group:'reader',automated:true,color:'#f2ce82',explain:'Ein System ist gefunden, aber für seine Art gibt es noch keinen Leser.'},
 {id:'none',label:'Kein maschinenlesbarer Zugriff gefunden',group:'closed',automated:false,color:'#e4e7eb',explain:'Weder Schnittstelle noch lesbares System gefunden.'},
]);
export const ACCESS_BY_ID=Object.freeze(Object.fromEntries(ACCESS_STATUSES.map(s=>[s.id,s])));
/** The label of a status id ('' for an unknown id). */
export const accessLabel=id=>ACCESS_BY_ID[id]?.label||'';
/** Whether programs can read the area at all: false only for a technical block or nothing found. */
export const automatedAccess=id=>ACCESS_BY_ID[id]?.automated===true;

/**
 * The status from what was found for an area, by the hierarchy above. Each channel: {found, blocked, reader};
 * html also {robots: 'erlaubt'|'verboten'|'keine'|'unklar'}; blocked: a technical block where no channel is known.
 * reader defaults to true: a channel without reader is named with reader:false.
 * @param {{oparl?:{found?:boolean,blocked?:boolean},api?:{found?:boolean,blocked?:boolean,reader?:boolean},html?:{found?:boolean,blocked?:boolean,reader?:boolean,robots?:string},blocked?:boolean}} found
 */
export function accessStatus(found={}){
 const open=c=>!!c?.found&&!c.blocked;
 if(open(found.oparl))return 'oparl';
 if(open(found.api))return found.api.reader===false?'api-noreader':'api';
 if(open(found.html))return found.html.reader===false?'noreader':found.html.robots==='verboten'?'robots':'scraping';
 if(found.blocked||[found.oparl,found.api,found.html].some(c=>c?.found&&c.blocked))return 'blocked';
 return 'none';
}

/**
 * The channel a catalog entry is read over. method "oparl" reads OParl; the readers named here read an interface;
 * all others read HTML pages. documented: the operator offers the interface for programs (API description, open data).
 */
export const READER_CHANNELS=Object.freeze({
 'oparl-bezirke':{kind:'oparl',name:'OParl'},
 'hamburg-transparenz':{kind:'api',name:'CKAN',documented:true},
 ckan:{kind:'api',name:'CKAN',documented:true},
 berlin:{kind:'api',name:'Offene Daten (PARDOK-XML)',documented:true},
 kic:{kind:'api',name:'JSON-Schnittstelle (KIC-Gastzugang)'},
 sessionnet6:{kind:'api',name:'JSON-Schnittstelle (SessionNet 6)'},
 'more-rubin':{kind:'api',name:'JSON-Schnittstelle (More! Rubin)'},
 councilservice:{kind:'api',name:'JSON-Export (mein-intra)'},
});
/** {kind: 'oparl'|'api'|'html', name, documented?} of a catalog entry. */
export function channelOf(source){
 if(source?.method==='oparl')return {kind:'oparl',name:'OParl'};
 if(source?.method==='official-api')return {kind:'api',name:'Offizielle Schnittstelle',documented:true};
 return READER_CHANNELS[source?.adapter]||{kind:'html',name:'HTML-Seiten'};
}
/** Whether robots.txt can decide over the channel at all: only for HTML pages (ROBOTS_POLICY=obey). */
export const robotsApplies=source=>channelOf(source).kind==='html';

/** The status of a connected source (catalog entry) with the robots.txt verdict recorded for its reader's path. */
export function accessOfSource(source,robots){
 const channel=channelOf(source);
 return accessStatus({[channel.kind]:{found:true,reader:true,...(channel.kind==='html'?{robots}:{})}});
}

/** What the recorded robots.txt verdict means for a connected source, in words (for detail views). */
export function robotsNote(source,robots){
 if(!robots)return '';
 if(channelOf(source).kind!=='html')return robots==='verboten'?'robots.txt nennt den Pfad, gilt aber nicht für die Schnittstelle':robots==='erlaubt'?'robots.txt erlaubt den Pfad':robots==='keine'?'keine robots.txt':'robots.txt nicht lesbar';
 return robots==='verboten'?'robots.txt sperrt die HTML-Seiten (festgehalten, nicht befolgt)':robots==='erlaubt'?'robots.txt erlaubt den Abruf':robots==='keine'?'keine robots.txt':'robots.txt nicht lesbar';
}

// Areas without source: the status from the reason of the last check (reasons.mjs, reports of build.mjs) and the
// address it names. The rules are tried in order; the first that matches decides.
const BLOCK=/HTTP 40[13]\b|HTTP 40[13]\/|Web-Firewall|Zugriffsprüfung|Zugriffsschutz|Mitgliederbereich|Anmeldung|Login|wies Programme .*ab/i;
const OPARL_ADDRESS=/\/oparl(?:\/|$|\.)|\/webservice\/oparl/i;
const API_SYSTEM=/KIC-RIS|komuna|SessionNet 6|öffentliche Schnittstelle|Gast-Schnittstelle|More! Rubin|councilservice|mein-intra|CKAN/;
// Addresses of systems whose reader reads an interface: komuna and other KIC apps (/app/), More! Rubin, mein-intra.
const API_ADDRESS=/ris\.komuna\.net|\/app\/?(?:[?#]|$)|gremien\.info|more-rubin\d*\.de|mein-intra\.net/i;
const READ_FAILED=/gefunden, Abruf|Abruf der öffentlichen Seiten|Vorlagenliste|Leser noch nicht angewendet|erkannt; Leser/;
// (A demo tenant of the vendor holds no data of the area: no access, rule "none".)
const ASSIGNMENT=/nicht eindeutig|mehreren Gebieten|Mitbenutztes System|Gemeinsames System mehrerer|Mehrere Körperschaften|Teil des Gebiets/;
/**
 * The status of an area without source from the reason of its last check and the address found (empty if none).
 * kind: the channel of a switched-off catalog entry (channelOf), where the area has one.
 * @param {string} reason
 * @param {string} [url]
 * @param {''|'oparl'|'api'|'html'} [kind]
 */
export function accessOfReason(reason,url='',kind=''){
 const r=String(reason||''),oparl=kind==='oparl'||OPARL_ADDRESS.test(url)||/OParl-Schnittstelle antwortet|mit antwortender OParl-Schnittstelle/.test(r);
 const api=!oparl&&(kind==='api'||API_SYSTEM.test(r)||API_ADDRESS.test(url)),blocked=BLOCK.test(r);
 // An older check that obeyed robots.txt: the HTML pages of the system it found. robots.txt never decides over OParl
 // or an API, so an interface found there (address or catalog entry) keeps its status.
 if(/robots\.txt/.test(r))return accessStatus({oparl:{found:oparl},api:{found:api},html:{found:!oparl&&!api,robots:'verboten'}});
 // A CKAN portal or another interface recognised without a reader for its data.
 if(/Leser\/Connector fehlt|Abfrageprofil fehlt/.test(r))return 'api-noreader';
 // A system with a reader whose reading failed: the channel of that reader; a refusal or a login is a block.
 if(oparl&&!/OParl[^;]*nicht aktiviert/.test(r))return accessStatus({oparl:{found:true,blocked:/OParl HTTP 40[13]\b/.test(r)}});
 if(READ_FAILED.test(r)||kind==='api')return accessStatus({[api?'api':'html']:{found:true,blocked}});
 if(blocked)return 'blocked';
 if(/Kein unterstütztes Ratsinformationssystem/.test(r))return 'noreader';
 // A system found whose assignment to the area is open: access is possible, the assignment is not.
 if(ASSIGNMENT.test(r))return accessStatus({[api?'api':'html']:{found:true}});
 // Sessions only as web pages or PDF: the website reader reads them.
 if(/Sitzungen nur als Webseite oder PDF/.test(r))return 'scraping';
 return 'none';
}
