import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeChecks,openReason,foundLink,mainEntry,sourceAddress,fixedBody,PLATFORMS,ROBOTS_RECHECK} from '../scripts/source-discovery/reasons.mjs';
import {CKAN_NO_PROFILE} from '../server/integrations/ckan.mjs';
import {accessOfReason} from '../shared/source-access.mjs';
// These tests check the old rule (robots.txt obeyed, ROBOTS_POLICY=obey); the tests marked "standard rule" switch to
// the rule of server/integrations/robots-policy.mjs: robots.txt is recorded, not obeyed, and a refusal stays final.
process.env.ROBOTS_POLICY='obey';
const standardRule=async fn=>{const was=process.env.ROBOTS_POLICY;delete process.env.ROBOTS_POLICY;try{return await fn();}finally{process.env.ROBOTS_POLICY=was;}};

/* Synthetische Prüfergebnisse im Format von verify.mjs (tried-Einträge) und crawl.mjs (candidates.json) */
const area={id:'de-1',name:'Gemeinde Beispielort',kind:'city',ags:'09999001'};
const row=(tried,extra={})=>({id:'de-1',name:area.name,kind:'city',tried,systems:[...new Set(tried.map(t=>t.system).filter(Boolean))],...extra});
const ok={ok:true,by:'Adresse'},fails={ok:false,why:'Gebietsname weder in Adresse noch im Seitentext'};
const reason=(r,crawl=null,ctx={})=>openReason(area,r,crawl,{readerName:a=>({allris3:'ALLRIS 3 (öffentliche Seiten)'})[a]||a,...ctx});
const KREIS_PORTAL='https://www.landkreis-x.ris-portal.de/sitzungen';

test('mergeChecks: accepted sources first, then targeted checks that tried something, then guessed findings',()=>{
 const verified={a:{id:'a',tried:[{url:'https://www.a.de/rat',system:'unknown',identity:ok}]},b:{id:'b',accepted:{id:'b'},tried:[]}};
 const files={
  'verified-search.json':{a:{id:'a',tried:[{url:'https://ratsinfo.a.de/',robots:'verboten'}]},b:{id:'b',tried:[{url:'https://x.de/',status:404}]},c:{id:'c',tried:[]}},
  'verified-fix.json':{d:{id:'d',tried:[{url:'https://fix.d.de/',status:403}]}},
  'verified-guessed-own.json':{e:{id:'e',tried:[{url:'https://ratsinfo.e.de/',system:'unknown'}],systems:['unknown']},f:{id:'f',tried:[{url:'https://ratsinfo.f.de/',robots:'verboten'}],systems:[]}},
  'verified-oparl.json':{g:{id:'g',accepted:{id:'g',method:'oparl'},tried:[]}},
 };
 const merged=mergeChecks(verified,files);
 assert.equal(merged.a.tried[0].robots,'verboten','a targeted check without source replaces the check of the website links');
 assert.ok(merged.b.accepted,'an accepted source is never replaced');
 assert.equal(merged.c,undefined,'a targeted check that tried nothing is no finding');
 assert.equal(merged.d.tried[0].status,403);
 assert.equal(merged.e,undefined,'a guessed page without a system changes nothing');
 assert.equal(merged.f.tried[0].robots,'verboten');
 assert.ok(merged.g.accepted);
 /* Die Korrekturdatei kommt nach der Websuche */
 const both=mergeChecks({},{'verified-search.json':{h:{id:'h',tried:[{url:'https://s.de/',status:404}]}},'verified-fix.json':{h:{id:'h',tried:[{url:'https://f.de/',status:404}]}}});
 assert.equal(both.h.tried[0].url,'https://f.de/');
 /* Kandidaten aus der Länderrecherche zählen wie die Websuche, die Korrekturdatei kommt danach */
 const research=mergeChecks({},{'verified-research.json':{i:{id:'i',tried:[{url:'https://r.de/',robots:'verboten'}]},j:{id:'j',accepted:{method:'sessionnet'},tried:[]}},'verified-fix.json':{i:{id:'i',tried:[{url:'https://f.de/',status:404}]}}});
 assert.equal(research.i.tried[0].url,'https://f.de/');assert.ok(research.j.accepted);
 /* Der Teil eines gemeinsamen Systems ersetzt eine Quelle, die das ganze System nahm; sonst bleibt die erste Annahme */
 const whole={id:'k',accepted:{id:'k',method:'scraper',adapter:'allris',base:'https://www.eutin.sitzung-online.de/public/'},tried:[]};
 const part={id:'k',accepted:{...whole.accepted,organizations:{exclude:['Süsel']}},tried:[]};
 assert.deepEqual(mergeChecks({k:whole},{'verified-fix.json':{k:part}}).k.accepted.organizations,{exclude:['Süsel']});
 assert.equal(mergeChecks({k:part},{'verified-fix.json':{k:whole}}).k.accepted.organizations.exclude[0],'Süsel','a later source without a part does not replace a part');
 assert.equal(mergeChecks({k:whole},{'verified-guessed.json':{k:part}}).k.accepted.organizations,undefined,'a guessed address is no correction');
 const client={id:'k',accepted:{id:'k',method:'scraper',adapter:'kic',base:'https://ris.gvvschoenau.de/',client:36},tried:[]};
 assert.equal(mergeChecks({},{'verified-search.json':{k:{...whole,accepted:{...client.accepted,client:undefined}}},'verified-fix.json':{k:client}}).k.accepted.client,36);
});

test('no link on the website: the crawl result says why',()=>{
 assert.equal(reason(null,{sites:[],candidates:[],pages:0,log:[]}),'Keine offizielle Website in Wikidata (P856)');
 assert.equal(reason(null,{sites:['https://a.de/'],candidates:[],pages:1,log:['https://a.de/: HTTP 403']}),'Offizielle Website antwortet Programmen nicht (HTTP 403/503)');
 assert.equal(reason(null,{sites:['https://a.de/'],candidates:[],pages:3,log:['https://a.de/x: HTTP 503']}),'Offizielle Website antwortet Programmen nicht (HTTP 403/503)');
 assert.equal(reason(null,{sites:['https://a.de/'],candidates:[],pages:21,log:[]}),'Website durchsucht, kein Link zu einem Ratsinformationssystem gefunden');
 assert.equal(reason(null,{sites:['https://a.de/'],candidates:[],pages:9,log:[]}),'Auf der offiziellen Website kein Link zu einem Ratsinformationssystem gefunden');
 /* Ein abgestürzter Lauf ist kein Beleg für eine fehlende Website */
 assert.equal(reason(null,{sites:[],candidates:[],log:['Fehler: kaputt']}),'Auf der offiziellen Website kein Link zu einem Ratsinformationssystem gefunden');
 assert.equal(reason(null,null),'Auf der offiziellen Website kein Link zu einem Ratsinformationssystem gefunden');
 /* Alle Texte bleiben über „kein Link“ auswählbar (website.mjs REASONS) außer dem ohne Website */
 for(const pages of [9,21])assert.match(reason(null,{sites:['https://a.de/'],candidates:[],pages,log:[]}),/kein Link/);
 /* Die Website-Prüfung ergänzt den Grund; die Zusammenfassung schneidet das Datum ab */
 const websiteChecks=new Map([['de-1',{reason:'Keine Seite mit Sitzungsbekanntmachungen gefunden',checkedAt:Date.UTC(2026,9,4)}]]);
 assert.equal(reason(null,{sites:['https://a.de/'],candidates:[],pages:21,log:[]},{websiteChecks}),'Website durchsucht, kein Link zu einem Ratsinformationssystem gefunden; Website geprüft: Keine Seite mit Sitzungsbekanntmachungen gefunden (04.10.2026)');
 assert.equal(reason(null,{sites:['https://a.de/'],candidates:[{url:'https://ratsinfo.a.de/'}],pages:2}),'Link auf der Website gefunden, noch nicht geprüft');
});

test('B1: a municipality linking the RIS-Portal of its district besides its own gremien.info is no RIS-Portal case',()=>{
 /* Neue Prüfung: robots.txt des RIS-Portals sperrt, das eigene More-Rubin-System ist erlaubt */
 const tried=[{url:KREIS_PORTAL,robots:'verboten'},{url:'https://beispielort.gremien.info/',system:'more-rubin',identity:ok,rubinTopics:0,rubinIssues:['Keine Sitzungen im Zeitraum']}];
 const r=reason(row(tried));
 assert.doesNotMatch(r,/RIS-Portal/);assert.doesNotMatch(r,/robots/);
 assert.equal(r,'More! Rubin gefunden, Abruf lieferte keine öffentlichen Tagesordnungspunkte (Keine Sitzungen im Zeitraum)');
 assert.equal(foundLink(row(tried)),'https://beispielort.gremien.info/');
 /* Ältere Prüfung ohne robots.txt: die Portalseite wurde gelesen und für SessionNet gehalten, nennt aber den Kreis */
 const old=[{url:KREIS_PORTAL,system:'sessionnet',identity:{ok:false,why:'Seite gehört erkennbar zu einem Kreis'}},{url:'https://beispielort.gremien.info/',system:'more-rubin',identity:ok}];
 assert.doesNotMatch(reason(row(old)),/RIS-Portal/);
 assert.equal(mainEntry(old).url,'https://beispielort.gremien.info/');
 /* Nur das Portal verlinkt: dessen robots-Sperre entscheidet (alte Regel) */
 assert.match(reason(row([{url:KREIS_PORTAL,robots:'verboten'}])),/^robots\.txt sperrt den HTML-Zugriff auf das gefundene System/);
});

test('B1: a robots.txt refusal on ratsinfo.<ort>.de decides reason and address',()=>{
 const tried=[{url:'https://www.beispielort.de/rathaus/politik',system:'unknown',identity:ok},{url:'https://ratsinfo.beispielort.de/bi/',robots:'verboten'},{url:'https://www.kreis-x.de/kreistag',system:'unknown',identity:fails}];
 assert.equal(reason(row(tried)),'robots.txt sperrt den HTML-Zugriff auf das gefundene System (keine OParl-Schnittstelle oder API gefunden); Freigabe beim Betreiber anfragen');
 assert.equal(foundLink(row(tried)),'https://ratsinfo.beispielort.de/bi/');
 /* Auch eine Weiterleitung, die robots.txt untersagt (verify.mjs: Fehler statt robots-Feld) */
 assert.match(reason(row([{url:'https://ris.beispielort.de/',status:0,error:'robots.txt untersagt die Weiterleitungsadresse'}])),/^robots\.txt sperrt den HTML-Zugriff/);
 /* Erkanntes System mit robots-Sperre vor einer ersten robots-Sperre ohne System */
 const two=[{url:'https://www.other.de/',robots:'verboten'},{url:'https://www.sitzung-online.de/beispielort/',system:'allris',identity:fails,robots:'verboten'}];
 assert.equal(foundLink(row(two)),'https://www.sitzung-online.de/beispielort/');
});

test('B1: RIS-Portal and komuna have readers and are no platform reason; the platforms still match pages that answer with errors',()=>{
 assert.ok(!PLATFORMS.some(([host])=>host.test('ris.komuna.net')||host.test('beispielort.ris-portal.de')));
 assert.ok(PLATFORMS.every(([,text])=>!/AKDB/.test(text)));
 assert.equal(reason(row([{url:'https://www.beispielort.de/x',status:404},{url:'https://beispielort.kommune-aktiv.de/',status:403}])),'Kommune aktiv: antwortet Programmen mit HTTP 403');
 const ekom=row([{url:'https://rim.ekom21.de/beispielort/webservice/oparl/v1.1/system',register:'ekom21'}]);
 assert.match(reason(ekom,null,{oparlAsked:new Set(['de-1'])}),/^ekom21 \(SD\.NET\).*nicht aktiviert, Freischaltung bei der Kommune anfragen$/);
});

test('DE2 (a): the result of a reader comes before the ALLRIS 4 error',()=>{
 const tried=[{url:'https://www.beispielort.de/ris/si010_e.asp',system:'allris',identity:ok,allrisGeneration:3,allrisError:'kein ALLRIS 4',reader:'allris3',readerTopics:0,readerIssues:['Keine Sitzungen im Zeitraum']}];
 assert.equal(reason(row(tried)),'ALLRIS 3 (öffentliche Seiten) gefunden, Abruf lieferte keine öffentlichen Tagesordnungspunkte (Keine Sitzungen im Zeitraum)');
 /* Ohne Leser bleibt es beim ALLRIS-4-Grund */
 assert.equal(reason(row([{url:'https://ris.beispielort.de/public/',system:'allris',identity:ok,allrisTopics:0,allrisIssues:['Keine Sitzungen']}])),'ALLRIS 4 gefunden, Abruf der öffentlichen Seiten lieferte keine Tagesordnungspunkte (Keine Sitzungen)');
});

test('DE2 (b): SessionNet names its issue or error',()=>{
 assert.equal(reason(row([{url:'https://ratsinfo.beispielort.de/bi/',system:'sessionnet',identity:ok,snTopics:0,snIssues:['Kalender 11/2026: Quelle antwortet mit HTTP 404']}])),'SessionNet gefunden, Abruf lieferte keine öffentlichen Tagesordnungspunkte (Kalender 11/2026: Quelle antwortet mit HTTP 404)');
 assert.equal(reason(row([{url:'https://ratsinfo.beispielort.de/bi/',system:'sessionnet',identity:ok,snError:'Zeitbudget erreicht'}])),'SessionNet gefunden, Abruf lieferte keine öffentlichen Tagesordnungspunkte (Zeitbudget erreicht)');
 assert.equal(reason(row([{url:'https://ratsinfo.beispielort.de/bi/',system:'sessionnet',identity:ok,snTopics:0}])),'SessionNet gefunden, Abruf lieferte keine öffentlichen Tagesordnungspunkte');
});

test('DE2 (c): an ALLRIS page that does not name the area is an assignment problem, not a missing OParl',()=>{
 assert.equal(reason(row([{url:'https://www.kreis-x.sitzung-online.de/public/',system:'allris',identity:fails}])),'Gefundenes System nicht eindeutig dem Gebiet zuzuordnen');
 assert.equal(reason(row([{url:'https://ris.beispielort.de/public/',system:'allris',identity:ok}])),'ALLRIS ohne erreichbare OParl-Schnittstelle');
});

test('DE2 (d): linked pages that do not answer name their status',()=>{
 assert.equal(reason(row([{url:'https://ratsinfo.beispielort.de/',status:404},{url:'https://www.beispielort.de/rat',status:404}])),'Verlinkte Seite antwortet Programmen mit HTTP 404');
 assert.equal(reason(row([{url:'https://ratsinfo.beispielort.de/',status:0,error:'The operation was aborted due to timeout'}])),'Verlinkte Seite antwortet Programmen nicht (Zeitüberschreitung)');
 assert.equal(reason(row([{url:'https://ratsinfo.beispielort.de/',status:500},{url:'https://b.de/',status:0,error:'fetch failed'}])),'Verlinkte Seite antwortet Programmen mit HTTP 500 oder gar nicht (keine Verbindung)');
 /* Nur 403 bleibt beim Zugriffsschutz */
 assert.equal(reason(row([{url:'https://ratsinfo.beispielort.de/',status:403}])),'Zugriffsschutz (HTTP 403) für Programme; OParl nicht aktiviert');
 /* Eine gelesene Seite ohne System ist kein Antwortfehler */
 assert.equal(reason(row([{url:'https://ratsinfo.beispielort.de/',status:404},{url:'https://www.beispielort.de/politik',system:'unknown',identity:ok}])),'Kein unterstütztes Ratsinformationssystem erkannt');
});

test('DE2 (e): SD.NET names the status of its list of papers; 403 counts as access protection',()=>{
 const sd=issue=>row([{url:'https://sitzungsdienst.beispielort.de/',system:'sdnet',identity:ok,sdTopics:0,sdIssues:[issue]}]);
 assert.equal(reason(sd('Vorlagenliste: Quelle antwortet mit HTTP 500')),'SD.NET: Startseite erreichbar, Vorlagenliste antwortet mit HTTP 500');
 assert.equal(reason(sd('Vorlagenliste: Quelle antwortet mit HTTP 403')),'Zugriffsschutz (HTTP 403) für Programme; OParl nicht aktiviert');
 assert.equal(reason(sd('Keine lesbare öffentliche Tagesordnung: …')),'SD.NET gefunden, Abruf der öffentlichen Seiten lieferte keine Tagesordnungspunkte (Keine lesbare öffentliche Tagesordnung: …)');
});

test('DE2 (f) and A1 (4): ALLRIS 3 without a reader result waits for a new check',()=>{
 assert.equal(reason(row([{url:'https://www.beispielort.sitzung-online.de/bi/si010_e.asp',system:'allris',identity:ok,allrisGeneration:3}])),'ALLRIS 3 erkannt; Leser noch nicht angewendet (Neuprüfung ausstehend)');
});

test('DE2 (g): links only to services, FG5 (5): meetings only as web page or document',()=>{
 const checked=row([]);
 assert.equal(reason(checked,{sites:['https://a.de/'],candidates:[{url:'https://api.whatsapp.com/send?text=x'},{url:'https://www.readspeaker.com/x'}]}),'Nur Links auf Vorlese-, Teilen-, App- oder Herstellerseiten gefunden, kein Ratsinformationssystem');
 /* Berne: Teilen-Link auf den Sitzungskalender der eigenen Website */
 const berne={sites:['https://www.berne.de/'],candidates:[{url:'https://x.com/intent/tweet?url=https%3A%2F%2Fwww.berne.de%2Fseite%2F177679%2Fsitzungskalender-halbjahr.html'}]};
 assert.equal(reason(checked,berne),'Kein Ratsinformationssystem erkennbar; Sitzungen nur als Webseite oder PDF');
 /* Hartheim: ePaper des Amtsblatts, gelesen und keinem System zugeordnet */
 assert.equal(reason(row([{url:'https://epaper.buergerinformation.de/epaper-Breisgau_2025-2026/page2.html',system:'unknown',title:'ePaper',identity:fails}])),'Kein Ratsinformationssystem erkennbar; Sitzungen nur als Webseite oder PDF');
 /* Arnstorf: Seite des Kreisportals */
 assert.equal(reason(row([{url:'https://www.rottal-inn.de/landkreis-region/buergerinfoportal/',system:'unknown',identity:{ok:false,why:'Seite gehört erkennbar zu einem Kreis'}}])),'Kein Ratsinformationssystem erkennbar; Sitzungen nur als Webseite oder PDF');
 /* Eine nicht erkannte Seite auf einer RIS-Adresse oder ein erkanntes System bleibt ein Zuordnungsproblem */
 assert.equal(reason(row([{url:'https://ratsinfo.nachbarort.de/',system:'unknown',identity:fails}])),'Gefundenes System nicht eindeutig dem Gebiet zuzuordnen');
 assert.equal(reason(row([{url:'https://www.nachbarort.de/kalender',system:'unknown',identity:fails},{url:'https://nachbarort.gremien.info/',system:'more-rubin',identity:fails}])),'Gefundenes System nicht eindeutig dem Gebiet zuzuordnen');
});

test('A1 (2): the address shown comes from the deciding entry, else from candidates.json, the web search or the own domain',()=>{
 assert.equal(foundLink(null,[{candidates:[]},{candidates:[{url:'https://ratsinfo.beispielort.de/'}]},{candidates:[{url:'https://own.de/'}]}]),'https://ratsinfo.beispielort.de/');
 assert.equal(foundLink(null,[undefined,undefined,{candidates:[{url:'https://ratsinfo.beispielort.de/bi/'}]}]),'https://ratsinfo.beispielort.de/bi/');
 assert.equal(foundLink(row([]),[{candidates:[{url:'https://www.website.de/rat'}]}]),'https://www.website.de/rat');
 assert.equal(foundLink(row([{url:'https://a.de/',status:404},{url:'https://b.de/',status:404}])),'https://a.de/');
 assert.equal(foundLink(null,[]),'');
});

test('lists of build.mjs decide before the check: city state, duplicate address, demo tenant, shared system, abort',()=>{
 const r=row([{url:'https://ratsinfo.beispielort.de/',robots:'verboten'}]);
 assert.match(openReason({...area,ags:'11000000'},r,null,{skipReason:a=>a.ags==='11000000'?'Stadtstaat':null}),/^Stadtstaat/);
 assert.equal(reason(r,null,{dropped:new Set(['de-1'])}),'Adresse mehreren Gebieten zugeordnet');
 assert.match(reason(r,null,{placeholder:new Set(['de-1'])}),/^Verlinktes System führt nur einen Demo-Mandanten/);
 assert.match(reason(r,null,{foreign:new Map([['de-1','Stadt Nachbarort']])}),/^Mitbenutztes System von Stadt Nachbarort;/);
 assert.equal(reason(row([],{error:'Netzwerk weg'})),'Prüfung abgebrochen: Netzwerk weg');
 /* Mehrere Körperschaften im More-Rubin-System */
 assert.equal(reason(row([{url:'https://x.gremien.info/',system:'more-rubin',identity:ok,rubinError:'Mehrere Körperschaften im System (A, B); keine gehört zum Gebiet'}])),'Mehrere Körperschaften im System (A, B); keine gehört zum Gebiet; der Leser trennt sie noch nicht');
});

test('FG2: entries with fixed bodies are no foreign owners and have their own address',()=>{
 const town={system:'',base:'https://lauenburg.gremien.info/',method:'official-api',bodies:['1']},amt={base:'https://lauenburg.gremien.info/',method:'official-api',bodies:['2']};
 assert.notEqual(sourceAddress(town),sourceAddress(amt));
 assert.equal(sourceAddress({base:'https://x/',bodies:['2','1']}),sourceAddress({base:'https://x/',bodies:['1','2']}),'the same bodies in another order are the same address');
 assert.equal(sourceAddress({base:'https://x/'}),sourceAddress({base:'https://x/'}));
 assert.equal(sourceAddress({system:'https://o/system',body:'https://o/bodies/1'}),'https://o/system|https://o/bodies/1|');
 assert.equal(fixedBody(town),true);assert.equal(fixedBody({method:'scraper',base:'https://x/',body:'b'}),true);assert.equal(fixedBody({method:'oparl',system:'https://o/'}),true);
 assert.equal(fixedBody({method:'scraper',base:'https://x/'}),false);assert.equal(fixedBody({method:'official-api',base:'https://x/',bodies:[]}),false);
});

test('standard rule: a robots.txt refusal of an older check waits for its new check, on RIS-Portal and komuna as well',()=>standardRule(()=>{
 const tried=[{url:'https://www.beispielort.de/rathaus/politik',system:'unknown',identity:ok},{url:'https://ratsinfo.beispielort.de/bi/',robots:'verboten'}];
 assert.equal(reason(row(tried)),ROBOTS_RECHECK);assert.match(ROBOTS_RECHECK,/Neuprüfung ausstehend/);
 assert.equal(foundLink(row(tried)),'https://ratsinfo.beispielort.de/bi/');
 // RIS-Portal and komuna: an older check that obeyed robots.txt waits for its new check like any other.
 assert.equal(reason(row([{url:KREIS_PORTAL,robots:'verboten'}])),ROBOTS_RECHECK);
 assert.equal(reason(row([{url:'https://ris.komuna.net/beispielort/',robots:'verboten'}])),ROBOTS_RECHECK);
 // A check that ended because the operator refused repeatedly in that run.
 assert.equal(reason(row([{url:'https://www.beispielort.sitzung-online.de/bi/',status:0,error:'Betreiber wies Programme in diesem Lauf wiederholt ab (HTTP 403/429); nicht gefragt'}])),'Betreiber wies Programme bei der Prüfung wiederholt ab (HTTP 403/429); Neuprüfung später');
 // Technical refusals stay what they are.
 assert.equal(reason(row([{url:'https://beispielort.kommune-aktiv.de/',status:403}])),'Kommune aktiv: antwortet Programmen mit HTTP 403');
 assert.equal(reason(row([{url:'https://ratsinfo.beispielort.de/bi/',status:403},{url:'https://ratsinfo.beispielort.de/',status:403}])),'Zugriffsschutz (HTTP 403) für Programme; OParl nicht aktiviert');
}));

test('a CKAN portal without query profile: the interface is there, the reader needs the profile (API verfügbar, Leser/Connector fehlt)',()=>{
 const tried=[{url:'https://www.beispielort.de/rathaus/politik',system:'unknown',identity:ok},{url:'https://opendata.beispielort.de/',system:'unknown',identity:ok,reader:'ckan',readerTopics:0,readerIssues:[CKAN_NO_PROFILE]}];
 assert.equal(reason(row(tried)),CKAN_NO_PROFILE);
 assert.equal(accessOfReason(reason(row(tried)),'https://opendata.beispielort.de/'),'api-noreader');
});

test('an SD.NET RIM tenant asked again: pages refuse, OParl webservice not activated (no longer "Neuprüfung ausstehend")',()=>{
 const tried=[{url:'https://beispielort.ratsinfomanagement.net/',robots:'verboten'},{url:'https://beispielort.ratsinfomanagement.net/webservice/oparl/v1.1/system',status:400,error:'SD.NET RIM: Webservice "OParl" ist nicht aktiviert',oparlInactive:true}];
 assert.match(reason(row(tried)),/^SD\.NET RIM: Seiten antworten Programmen mit HTTP 403, OParl-Webservice nicht aktiviert/);
 assert.equal(accessOfReason(reason(row(tried)),'https://beispielort.ratsinfomanagement.net/'),'blocked');
});
