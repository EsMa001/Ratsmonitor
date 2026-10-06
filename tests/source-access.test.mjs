import test from 'node:test';
import assert from 'node:assert/strict';
import {ACCESS_STATUSES,ACCESS_BY_ID,accessStatus,accessOfSource,accessOfReason,accessLabel,automatedAccess,channelOf,robotsApplies,robotsNote} from '../shared/source-access.mjs';
import {NRW_SOURCES} from '../server/integrations/source-catalog.mjs';
import {CATALOG} from '../shared/catalog.mjs';
import {CKAN_NO_PROFILE} from '../server/integrations/ckan.mjs';
import robots from '../server/integrations/source-robots.json' with {type:'json'};
import atlas from '../server/integrations/source-atlas.json' with {type:'json'};

// The hierarchy of shared/source-access.mjs: OParl → API → HTML pages (robots.txt gives the label only here) →
// technical block → nothing found.

test('the statuses: eight, with the labels of the decision of 06.10.2026, and which allow automated access',()=>{
 assert.deepEqual(ACCESS_STATUSES.map(s=>s.label),['OParl verfügbar','API verfügbar','API verfügbar, Leser/Connector fehlt','Scraping erlaubt','robots.txt sperrt HTML-Zugriff','Zugriffsschutz','System ohne Leser','Kein maschinenlesbarer Zugriff gefunden']);
 assert.equal(accessLabel('api'),'API verfügbar');assert.equal(accessLabel('x'),'');
 // Only HTML crawling is restricted (robots) versus no automated access at all (blocked, none).
 assert.equal(automatedAccess('robots'),true);assert.equal(automatedAccess('blocked'),false);assert.equal(automatedAccess('none'),false);
 for(const s of ACCESS_STATUSES)assert.match(s.color,/^#[0-9a-f]{6}$/,s.id);
});

test('case 1: OParl present → OParl verfügbar, whatever robots.txt says about the HTML pages',()=>{
 assert.equal(accessStatus({oparl:{found:true}}),'oparl');
 assert.equal(accessStatus({oparl:{found:true},html:{found:true,robots:'verboten'}}),'oparl');
 assert.equal(accessOfSource({method:'oparl',system:'https://oparl.example.de/system'},'verboten'),'oparl');
 assert.equal(accessOfSource({adapter:'oparl-bezirke'},'verboten'),'oparl');
 assert.match(robotsNote({method:'oparl'},'verboten'),/gilt aber nicht für die Schnittstelle/);
});

test('case 2: CKAN or another API present, robots.txt disallows HTML (and even the API path) → API verfügbar',()=>{
 assert.equal(accessStatus({api:{found:true},html:{found:true,robots:'verboten'}}),'api');
 const hamburg=NRW_SOURCES.find(s=>s.id==='de-02000000');
 assert.equal(hamburg.adapter,'hamburg-transparenz');assert.deepEqual(channelOf(hamburg),{kind:'api',name:'CKAN',documented:true});
 // The Transparenzportal's robots.txt disallows its search interface; the portal documents it for programs.
 assert.equal(robots.sources['de-02000000'],'verboten');
 assert.equal(accessOfSource(hamburg,robots.sources['de-02000000']),'api');assert.equal(robotsApplies(hamburg),false);
 assert.match(robotsNote(hamburg,'verboten'),/gilt aber nicht für die Schnittstelle/);
 for(const adapter of ['ckan','berlin','kic','sessionnet6','more-rubin','councilservice'])assert.equal(accessOfSource({method:'scraper',adapter},'verboten'),'api',adapter);
 assert.equal(accessOfSource({method:'official-api'},'verboten'),'api');
});

test('case 3: no API, crawling allowed by robots.txt (or no robots.txt) → Scraping erlaubt',()=>{
 assert.equal(accessStatus({html:{found:true,robots:'erlaubt'}}),'scraping');
 assert.equal(accessStatus({html:{found:true,robots:'keine'}}),'scraping');
 assert.equal(accessStatus({html:{found:true}}),'scraping');
 assert.equal(accessOfSource({method:'scraper',base:'https://ratsinfo.example.de/bi/'},'erlaubt'),'scraping');
 assert.equal(robotsApplies({method:'scraper',adapter:'allris'}),true);
});

test('case 4: no API, robots.txt disallows the HTML pages → robots.txt sperrt HTML-Zugriff (only crawling restricted)',()=>{
 assert.equal(accessStatus({html:{found:true,robots:'verboten'}}),'robots');
 assert.equal(accessOfSource({method:'scraper',adapter:'ris-portal'},'verboten'),'robots');
 assert.equal(accessOfSource({method:'scraper',adapter:'website'},'verboten'),'robots');
 assert.match(robotsNote({method:'scraper'},'verboten'),/sperrt die HTML-Seiten/);
 assert.equal(automatedAccess(accessStatus({html:{found:true,robots:'verboten'}})),true);
});

test('case 5: technical block (HTTP 401/403, firewall, login) → Zugriffsschutz, unless another channel is open',()=>{
 assert.equal(accessStatus({html:{found:true,blocked:true,robots:'erlaubt'}}),'blocked');
 assert.equal(accessStatus({blocked:true}),'blocked');
 assert.equal(accessStatus({oparl:{found:true,blocked:true}}),'blocked');
 // An OParl interface that refuses, next to HTML pages that answer: the HTML pages decide.
 assert.equal(accessStatus({oparl:{found:true,blocked:true},html:{found:true,robots:'verboten'}}),'robots');
 assert.equal(automatedAccess('blocked'),false);
});

test('case 6: a system recognised without reader or connector → System ohne Leser / API verfügbar, Leser/Connector fehlt',()=>{
 assert.equal(accessStatus({api:{found:true,reader:false}}),'api-noreader');
 assert.equal(accessStatus({html:{found:true,reader:false,robots:'verboten'}}),'noreader');
 // An API without reader still comes before HTML pages with a reader.
 assert.equal(accessStatus({api:{found:true,reader:false},html:{found:true,robots:'erlaubt'}}),'api-noreader');
 assert.equal(accessStatus({}),'none');
});

test('areas without source: the status from the reason of the last check (texts of the reports)',()=>{
 const R=(reason,url,kind)=>accessOfReason(reason,url,kind);
 const robotsRecheck='robots.txt des gefundenen Systems sperrte bei der letzten Prüfung; Neuprüfung ausstehend (robots.txt wird seit 05.10.2026 nur festgehalten)';
 assert.equal(R(robotsRecheck,'https://beispielort.ratsinfomanagement.net/'),'robots');
 // robots.txt does not decide over an interface: an OParl address or an API platform found there keeps its status.
 assert.equal(R(robotsRecheck,'https://ris.example.de/oparl/v1/system'),'oparl');
 assert.equal(R(robotsRecheck,'https://ris.komuna.net/beispielort/'),'api');
 assert.equal(R('robots.txt des Transparenzportals (verboten) erlaubt die Suchschnittstelle nicht','https://suche.transparenz.hamburg.de/','api'),'api');
 assert.equal(R('Zugriffsschutz (HTTP 403) für Programme; OParl nicht aktiviert'),'blocked');
 assert.equal(R('Kommune aktiv: antwortet Programmen mit HTTP 403'),'blocked');
 assert.equal(R('ekom21 (SD.NET): vorgeschaltete Web-Firewall leitet Programme auf eine Fehlerseite um; die OParl-Schnittstelle des Herstellers ist für diese Kommune nicht aktiviert, Freischaltung bei der Kommune anfragen','https://rim.ekom21.de/x/webservice/oparl/v1.1/system'),'blocked');
 assert.equal(R('OParl-Schnittstelle antwortet, lieferte aber keine verwertbaren Sitzungen'),'oparl');
 assert.equal(R('OParl-Schnittstelle antwortet, lieferte aber keine verwertbaren Sitzungen (OParl HTTP 403)'),'blocked');
 assert.equal(R('KIC-RIS (öffentliche Gast-Schnittstelle) gefunden, Abruf lieferte keine öffentlichen Tagesordnungspunkte (Noch keine Artikel erfolgreich erfasst.)'),'api');
 assert.equal(R('SessionNet gefunden, Abruf lieferte keine öffentlichen Tagesordnungspunkte (Nur Mitgliederbereich (Anmeldung), kein öffentlicher Teil)'),'blocked');
 assert.equal(R('SessionNet gefunden, Abruf lieferte keine öffentlichen Tagesordnungspunkte (Noch keine Artikel erfolgreich erfasst.)'),'scraping');
 assert.equal(R('ALLRIS 3 erkannt; Leser noch nicht angewendet (Neuprüfung ausstehend)'),'scraping');
 assert.equal(R('Kein unterstütztes Ratsinformationssystem erkannt'),'noreader');
 assert.equal(R(CKAN_NO_PROFILE,'https://opendata.example.de/'),'api-noreader');
 assert.equal(R('Mitbenutztes System von Stadt Quickborn; die Leser trennen die Gremien eines gemeinsamen Systems nicht'),'scraping');
 assert.equal(R('Kein Ratsinformationssystem erkennbar; Sitzungen nur als Webseite oder PDF'),'scraping');
 assert.equal(R('Verlinktes System führt nur einen Demo-Mandanten des Herstellers (z. B. „Stadt Musterstadt“)'),'none');
 assert.equal(R('Website durchsucht, kein Link zu einem Ratsinformationssystem gefunden; Website geprüft: Bekanntmachungen gefunden, aber keine öffentlichen Tagesordnungspunkte lesbar'),'none');
 assert.equal(R('Auf der offiziellen Website kein Link zu einem Ratsinformationssystem gefunden; Website geprüft: Website nicht erreichbar (HTTP 403) (05.10.2026)'),'blocked');
});

test('catalog: no connected OParl or API source is labelled by robots.txt; source-atlas.json names every area with a status',()=>{
 const connected=NRW_SOURCES.filter(s=>s.method!=='pending');
 for(const s of connected){
  const status=accessOfSource(s,robots.sources[s.id]);
  assert.ok(ACCESS_BY_ID[status],s.id);
  if(channelOf(s).kind!=='html')assert.notEqual(status,'robots',s.id+' reads an interface');
 }
 const ids=new Set(CATALOG.map(r=>r.id));
 for(const [id,row] of Object.entries(atlas.areas)){assert.ok(ids.has(id),id+' is an area of the catalog');assert.ok(ACCESS_BY_ID[row.z],id+': '+row.z);if(row.r!==undefined)assert.equal(typeof atlas.texts[row.r],'string',id+' reason text');}
 assert.equal(Object.keys(atlas.areas).length,CATALOG.length,'one row per area');
});
