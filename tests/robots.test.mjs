import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRobots,robotsAllow,robotsVerdict} from '../server/integrations/robots.mjs';
import recorded from '../server/integrations/source-robots.json' with {type:'json'};
import {NRW_SOURCES} from '../server/integrations/source-catalog.mjs';
import {SOURCES} from '../server/integrations/regions.mjs';

const T=['vorort-politicaltopics','ratsmonitor-sourcecatalog'];
const allow=(text,path)=>robotsAllow(parseRobots(text),path,T);
test('robots.txt after RFC 9309: own group before "*", longest rule, Allow wins a tie, wildcards',()=>{
 /* sessionnet.owl-it.de: alles verboten außer einem freigegebenen Mandanten */
 const owl='User-agent: *\nDisallow: /\nAllow: /stadt-weingarten/bi/\n';
 assert.equal(allow(owl,'/lehrte/bi/'),false);assert.equal(allow(owl,'/stadt-weingarten/bi/si0040.asp'),true);
 /* More! Rubin: nur Konfiguration und Dokumentenliste gesperrt, die Schnittstelle nicht */
 const rubin='User-agent: *\nDisallow: /config/\nDisallow: /documents.php\n';
 assert.equal(allow(rubin,'/api.php'),true);assert.equal(allow(rubin,'/documents.php'),false);
 /* Eine Gruppe für unser Programm geht der allgemeinen vor; Gruppen anderer Programme gelten nicht für uns */
 assert.equal(allow('User-agent: *\nDisallow: /\n\nUser-agent: VorOrt-PoliticalTopics\nAllow: /\n','/bi/'),true);
 assert.equal(allow('User-agent: SemrushBot\nDisallow: /\n','/bi/'),true);
 assert.equal(allow('User-agent: *\nDisallow:\n','/bi/'),true,'an empty Disallow forbids nothing');
 assert.equal(allow('User-agent: *\nDisallow: /bi\nAllow: /bi\n','/bi/x'),true,'Allow wins a tie');
 assert.equal(allow('User-agent: *\nDisallow: /*.pdf$\n','/a/b.pdf'),false);assert.equal(allow('User-agent: *\nDisallow: /*.pdf$\n','/a/b.pdf?x=1'),true);
 /* Kommentare, Groß- und Kleinschreibung der Schlüssel, mehrere Programme in einer Gruppe */
 assert.equal(allow('# Kommentar\nUSER-AGENT: Googlebot\nuser-agent: *\nDISALLOW: /ris/ # privat\n','/ris/x'),false);
 /* Ohne robots.txt ist alles erlaubt; ein Serverfehler lässt die Frage offen */
 assert.equal(robotsVerdict(404,'','/x',T),'keine');assert.equal(robotsVerdict(503,'','/x',T),'unklar');assert.equal(robotsVerdict(0,'','/x',T),'unklar');
 assert.equal(robotsVerdict(200,'User-agent: *\nDisallow: /\n','/x',T),'verboten');
});
test('every connected source has a recorded robots.txt verdict',()=>{
 const ids=[...SOURCES.map(s=>s.id),...NRW_SOURCES.filter(s=>s.method!=='pending').map(s=>s.id),'muenster'];
 const missing=ids.filter(id=>!recorded.sources[id]);
 assert.deepEqual(missing,[],'node scripts/source-discovery/robots.mjs ausführen');
 assert.ok(Object.values(recorded.sources).every(v=>['erlaubt','verboten','keine','unklar'].includes(v)));
});
