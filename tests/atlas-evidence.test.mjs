import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryOf,reasonDate,resolveEvidence} from '../scripts/source-discovery/atlas-evidence.mjs';

const evidence=(extra={})=>({id:'de-1',category:'website',access:'scraping',reason:'Sitzungen nur als Webseite oder PDF',url:'https://gemeinde.example/bekanntmachungen/',checkedAt:'2026-10-10',dateBasis:'reason',origin:{kind:'atlas',path:'server/integrations/source-atlas.json',pointer:'/areas/de-1'},...extra});
const work=(extra={})=>evidence({origin:{kind:'work',path:'tmp/source-discovery-de/open.json',pointer:'/0'},...extra});

test('legacy category groups and newer diagnoses remain recognised',()=>{
 for(const [reason,expected] of [
  ['Prüflauf vom Rechner des Projektinhabers ausstehend','ready'],
  ['Stadtstaat: Bezirke führen eigene Systeme','special'],
  ['Adresse mehreren Gebieten zugeordnet','shared'],
  ['Mitbenutztes System einer Nachbargemeinde; HTTP 403','shared'],
  ['robots.txt sperrte bei der letzten Prüfung','robots'],
  ['robots.txt des Systems sperrt; HTTP 403','robots'],
  ['Kommune aktiv: antwortet Programmen mit HTTP 403','blocked'],
  ['Nur Links auf Vorlese-, Teilen-, App- oder Herstellerseiten gefunden','website'],
  ['Website durchsucht, kein Link zu einem Ratsinformationssystem gefunden','nolink'],
  ['ALLRIS 3 erkannt; Leser noch nicht angewendet','noreader'],
  ['Kein unterstütztes Ratsinformationssystem erkannt','noreader'],
  ['SD.NET: Vorlagenliste antwortet mit HTTP 500','readfail'],
  ['Unbekannter Befund','other'],
  ['Gemeinsames System bei ris-portal.de, Prüfung wegen HTTP 403 offen','shared'],
  ['Sitzungsunterlagen nur auf der Gemeinde-Website (Link gespeichert), kein Ratsinformationssystem erkennbar (Recherche 10.10.2026)','website'],
  ['Sitzungstermine oder Unterlagen stehen nur als Webseite oder PDF auf der Gemeinde-Website','website'],
  ['Sitzungsbekanntmachungen oder Unterlagen auf der Gemeinde-Website gefunden, aber keine öffentlichen Tagesordnungspunkte lesbar (Scan-PDF ohne Textebene; Recherche 10.10.2026)','website'],
  ['Website der Gemeinde geprüft, keine Sitzungsseite oder keine Sitzungsunterlagen im Zeitraum gefunden','website'],
  ['Website der Gemeinde zurzeit nicht abrufbar (Recherche 10.10.2026)','website'],
  ['Website und Rathausseiten durchsucht (Recherche 10.10.2026): kein öffentliches Ratsinformationssystem gefunden','nolink'],
  ['System öffentlich erreichbar, aber ohne passenden Leser (Recherche 10.10.2026)','noreader'],
  ['Eigenes Ratsinformationssystem der Gemeinde, kein Leser (10.10.2026)','noreader'],
  ['Nur über http erreichbar, https scheitert (Zertifikat passt nicht zum Hostnamen; geprüft 10.10.2026); Leser vorhanden','noreader'],
  ['Link gefunden; die Seite antwortet Programmen mit HTTP 401/403','blocked'],
  ['Nur für angemeldete Mitglieder oder passwortgeschützt, kein öffentlicher Teil','blocked'],
 ])assert.equal(categoryOf(reason),expected,reason);
 assert.equal(categoryOf(null),'other');
});

test('reasonDate recognises explicit research, checked status and final check dates',()=>{
 for(const value of [
  'Kein RIS erkannt (Recherche 10.10.2026)',
  'Quelle gefunden; geprüft am 10.10.2026',
  'Prüfstatus vom 2026-10-10: HTTP 403',
  'Website geprüft: Keine Seite gefunden (10.10.2026)',
  'SD.NET RIM: Seiten HTTP 403, OParl-Webservice nicht aktiviert (10.10.2026); Freischaltung anfragen',
 ]){
  assert.deepEqual(reasonDate(value),{checkedAt:'2026-10-10',basis:'reason',candidates:['2026-10-10']});
 }
 assert.equal(reasonDate('geprüft 29.02.2024').checkedAt,'2024-02-29');
});

test('reasonDate rejects invalid, policy, licence, calendar and creation dates',()=>{
 for(const value of [
  'Recherche 31.02.2026','geprüft 29.02.2025','geprüft 00.10.2026','geprüft 13.13.2026',
  'Kalender 10.10.2026','Sitzung am 10.10.2026','System mit Lizenz vom 10.10.2026',
  'Quelle: Freigabe (10.10.2026)','Systemänderung seit 05.10.2026',
  'Website veröffentlicht (10.10.2026)','Quelle erstellt (10.10.2026)',
  'robots.txt wird seit 05.10.2026 nicht befolgt','Erzeugt am 10.10.2026','Stand: 10.10.2026',
 ])assert.deepEqual(reasonDate(value),{checkedAt:null,basis:'unknown',candidates:[]},value);
 assert.equal(reasonDate('Lizenz vom 01.10.2026; geprüft 10.10.2026').checkedAt,'2026-10-10');
 assert.equal(reasonDate('Website geprüft 10.10.2026; Kalender vom 01.11.2026').checkedAt,'2026-10-10');
});

test('reasonDate reports ambiguity and deduplicates repeated check dates',()=>{
 assert.deepEqual(reasonDate('Recherche 09.10.2026; geprüft 10.10.2026'),{checkedAt:null,basis:'unknown',candidates:['2026-10-09','2026-10-10']});
 assert.equal(reasonDate('Recherche 10.10.2026; geprüft 2026-10-10').checkedAt,'2026-10-10');
});

test('older work and report evidence cannot replace the saved atlas category',()=>{
 const current=Object.freeze(evidence({category:'website',reason:'Kein unterstütztes Ratsinformationssystem erkannt',builtAt:'2026-10-09'}));
 const old=work({category:'noreader',checkedAt:'2026-10-05',builtAt:'2026-10-13'});
 const result=resolveEvidence(current,[old]);
 assert.strictEqual(result.selected,current);
 assert.equal(result.selected.category,'website');
 assert.strictEqual(result.alternatives[0],old);
 assert.equal(result.conflict,false);assert.equal(result.decision,'keep-current');
});

test('a strictly newer explicit check can replace dated current without mutating provenance',()=>{
 const current=evidence(),newer=Object.freeze(work({category:'blocked',access:'blocked',reason:'HTTP 403',checkedAt:'2026-10-11',reportDate:'2026-09-01'}));
 const result=resolveEvidence(current,[newer]);
 assert.strictEqual(result.selected,newer);assert.strictEqual(result.selected.origin,newer.origin);
 assert.deepEqual(result.alternatives,[current]);
 assert.equal(result.conflict,false);assert.equal(result.decision,'newer-evidence');
});

test('unknown current, unknown candidate, invalid date and same-day contradictions stay open',()=>{
 for(const [current,candidate] of [
  [evidence({checkedAt:null,dateBasis:'unknown'}),work({reason:'HTTP 403',checkedAt:'2026-10-12'})],
  [evidence(),work({reason:'HTTP 403',checkedAt:null,dateBasis:'unknown',builtAt:'2026-10-13'})],
  [evidence(),work({reason:'HTTP 403',checkedAt:'2026-02-30'})],
  [evidence(),work({reason:'HTTP 403'})],
 ]){
  const result=resolveEvidence(current,[candidate]);
  assert.strictEqual(result.selected,current);assert.equal(result.conflict,true);
  assert.deepEqual(result.alternatives,[candidate]);
 }
});

test('same content with unknown dates is no conflict and retains saved evidence',()=>{
 const current=evidence({checkedAt:null,dateBasis:'unknown'}),copy=work({checkedAt:null,dateBasis:'unknown'});
 const result=resolveEvidence(current,[copy]);
 assert.strictEqual(result.selected,current);assert.equal(result.conflict,false);
});

test('conflicting newest candidates retain current independent of input order',()=>{
 const current=evidence(),a=work({reason:'HTTP 403',checkedAt:'2026-10-12'}),b=work({reason:'Kein Link',checkedAt:'2026-10-12'});
 for(const options of [[a,b],[b,a]]){
  const result=resolveEvidence(current,options);
  assert.strictEqual(result.selected,current);assert.equal(result.conflict,true);
 }
});

test('same-day conflict with current remains open even when a later candidate exists',()=>{
 const current=evidence(),sameDay=work({reason:'HTTP 403'}),newer=work({reason:'Kein Link',checkedAt:'2026-10-11'});
 const result=resolveEvidence(current,[newer,sameDay]);
 assert.strictEqual(result.selected,current);assert.equal(result.conflict,true);
});

test('fallback is deterministic, prefers safely newer evidence and exposes unknown ordering',()=>{
 const oldPending=work({reason:'pending',checkedAt:'2026-10-05',origin:{kind:'pending',path:'catalog.json',pointer:'/0'}});
 const newerReport=work({reason:'report',checkedAt:'2026-10-11',origin:{kind:'report',path:'report.md',pointer:'/table/1'}});
 assert.strictEqual(resolveEvidence(null,[oldPending,newerReport]).selected,newerReport);
 const unknownWork=work({reason:'work',checkedAt:null,dateBasis:'unknown'});
 for(const rows of [[newerReport,unknownWork],[unknownWork,newerReport]]){
  const result=resolveEvidence(null,rows);assert.strictEqual(result.selected,unknownWork);
  assert.equal(result.conflict,true);assert.equal(result.decision,'fallback');
 }
 const unknownPending={...oldPending,checkedAt:null,dateBasis:'unknown'};
 assert.strictEqual(resolveEvidence(null,[unknownWork,unknownPending,newerReport]).selected,unknownPending);
 assert.deepEqual(resolveEvidence(null,[]),{selected:null,alternatives:[],conflict:false,decision:'none'});
});

test('fallback same content is not a conflict and cross-area evidence never silently replaces current',()=>{
 assert.equal(resolveEvidence(null,[work({checkedAt:null}),work({checkedAt:'2026-10-11'})]).conflict,false);
 const current=evidence(),foreign=work({id:'de-2',checkedAt:'2026-10-12'});
 assert.strictEqual(resolveEvidence(current,[foreign]).selected,current);
 assert.equal(resolveEvidence(current,[foreign]).conflict,true);
});
