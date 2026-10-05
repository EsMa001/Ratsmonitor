import test from 'node:test';
import assert from 'node:assert/strict';
import register from '../server/integrations/source-consents.json' with {type:'json'};
import {CATALOG,landName} from '../shared/catalog.mjs';
import {validConsent,consentFor,consentAllows,consentsOf,robotsOverride,parseConsentCsv,parseAddressCsv,mergeConsents} from '../server/integrations/consents.mjs';

const own={id:'fr-2026-0001',area:'billerbeck',date:'2026-05-12',grantedBy:'Ratsbüro',scope:['robots'],system:'https://ratsinfo.billerbeck.de/bi/',revokedAt:null};
const tenant={id:'fr-2026-0002',area:'nrw-05766024',date:'2026-06-01',grantedBy:'Hauptamt',scope:['robots'],system:'https://sessionnet.owl-it.de/doerentrup/bi/'};

test('a consent counts only complete and not revoked; it covers its own system and nothing beside it',()=>{
 assert.equal(validConsent(own),true);
 for(const broken of [{...own,date:'12.05.2026'},{...own,grantedBy:''},{...own,scope:[]},{...own,scope:['alles']},{...own,revokedAt:'2026-07-01'},{...own,area:''}])assert.equal(validConsent(broken),false);
 const list=[own,tenant];
 assert.equal(consentFor('https://ratsinfo.billerbeck.de/bi/si0040.asp',{list}).id,'fr-2026-0001');
 assert.equal(consentFor('https://ratsinfo.billerbeck.de/oparl/system',{list}),null,'another folder of the host is not covered');
 assert.equal(consentFor('https://sessionnet.owl-it.de/doerentrup/bi/si0057.asp',{list}).id,'fr-2026-0002');
 assert.equal(consentAllows('https://sessionnet.owl-it.de/lemgo/bi/si0040.asp',{list}),false,'the consent of one tenant never covers the others on the platform');
 assert.equal(consentAllows('https://ratsinfo.billerbeck.de/bi/',{list,scope:'oparl'}),false,'only the scope given');
 assert.equal(consentAllows('https://ratsinfo.billerbeck.de/bi/',{list:[{...own,revokedAt:'2026-07-01'}]}),false);
 assert.deepEqual(consentsOf('billerbeck',list).map(c=>c.id),['fr-2026-0001']);
 assert.deepEqual(robotsOverride(own),{by:'Kommune',role:'Ratsbüro',date:'2026-05-12',evidence:'fr-2026-0001'});
});

test('a consent list is matched to areas by name and Land; doubtful lines are listed, never guessed',()=>{
 const csv=['Gebiet;Land;Datum;Umfang;Kanal;Stelle;Adresse;Betreiber',
  'Stadt Billerbeck;Nordrhein-Westfalen;12.05.2026;robots;E-Mail;Ratsbüro;https://ratsinfo.billerbeck.de/bi/;',
  'Dörentrup;05;2026-06-01;robots, freischaltung;Schreiben;Hauptamt;sessionnet.owl-it.de/doerentrup/bi/;owl-it',
  'Gemeinde Nirgendwo;;01.01.2026;robots;E-Mail;Ratsbüro;;',
  'Billerbeck;;;robots;E-Mail;Ratsbüro;;',
  'Stadt Billerbeck;05;12.05.2026;alles erlaubt;E-Mail;Ratsbüro;;'].join('\n');
 const {consents,problems}=parseConsentCsv(csv,CATALOG,{landName});
 assert.deepEqual(consents.map(c=>c.area),['billerbeck','nrw-05766024']);
 assert.deepEqual(consents[1].scope,['robots','freischaltung']);assert.equal(consents[1].system,'https://sessionnet.owl-it.de/doerentrup/bi/');assert.equal(consents[1].operatorState,'offen');
 assert.equal(consents[0].reviewAt,'2027-05-12');
 assert.equal(problems.length,3);assert.match(problems[0],/kein Gebiet/);assert.match(problems[1],/Datum/);assert.match(problems[2],/Umfang unbekannt/);
 /* Ein Name, den zwei Länder kennen, braucht das Land */
 const twice=CATALOG.filter(r=>r.shortName==='Neustadt');
 if(twice.length>1){const r=parseConsentCsv('Gebiet;Datum;Stelle\nNeustadt;2026-01-01;Ratsbüro',CATALOG);assert.equal(r.consents.length,0);assert.match(r.problems[0],/mehrdeutig/);}
});

test('the register is only added to; the same consent counts once and gets a register number',()=>{
 const first=mergeConsents([],[{...own,id:undefined},{...tenant,id:undefined}]);
 assert.equal(first.list.length,2);assert.match(first.list[0].id,/^fr-\d{4}-0001$/);assert.equal(first.list[0].evidence,'beleg:'+first.list[0].id);
 const again=mergeConsents(first.list,[{...own,id:undefined}]);assert.equal(again.added.length,0);assert.equal(again.list.length,2);
 const revoked={...first.list[0],revokedAt:'2026-09-01'},kept=mergeConsents([revoked,first.list[1]],[]);assert.equal(kept.list[0].revokedAt,'2026-09-01','nothing is changed or removed');
 assert.ok(Array.isArray(register.consents)&&register.consents.every(validConsent),'every entry of the register is complete');
 assert.ok(!JSON.stringify(register).match(/@|\btel\b|\+49/i),'no addresses of persons in the register');
});

test('addresses found by hand become candidates of their area',()=>{
 const {rows,problems}=parseAddressCsv('Gebiet;Land;Adresse\nPleiskirchen;Bayern;buergerinfo-pleiskirchen.digitalfabrix.de\nUnbekanntdorf;;https://x.de/',CATALOG,{landName});
 assert.equal(rows.length,1);assert.equal(rows[0].area.shortName,'Pleiskirchen');assert.equal(rows[0].url,'https://buergerinfo-pleiskirchen.digitalfabrix.de/');
 assert.equal(problems.length,1);
});
