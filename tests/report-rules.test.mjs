// Ein Schritt für alle Regeln je Bericht (server/integrations/report-rules.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import {readReport,readKey,mainDocument,READ_VERSION} from '../server/integrations/report-rules.mjs';
import {buildRuleSummary} from '../server/integrations/rule-summary.mjs';
import {mergePages} from '../server/integrations/documents.mjs';

const pdf=(title,url)=>({title,url,kind:'application/pdf'});
const vorlage=['Stadt Musterstadt Beschlussvorlage Drucksache 12/2026 Betreff: Neubau eines Radwegs an der Kreisstraße 12',
 'Beschlussvorschlag: Der Rat beschließt den Neubau des Radwegs zwischen Nord und Süd. Die Kosten betragen 450.000 Euro. Das Land fördert den Radweg mit 300.000 Euro aus dem Programm Radverkehr. '.repeat(3)+
 'Sachverhalt: Der Radweg schließt eine Lücke im Netz. Schülerinnen und Schüler nutzen die Strecke täglich. Die Verwaltung hat drei Varianten geprüft und empfiehlt die Trasse am Waldrand. '.repeat(4)];
const at='2026-10-14T00:00:00.000Z';

test('Reihenfolge: Hauptdokument, Art, Thema aus Titel und Betreff, Zusammenfassung wie im Import, Fakten',()=>{
 const r=readReport({title:'Neubau Radweg Kreisstraße 12',documents:[pdf('Anlage 1 Lageplan','b'),pdf('Beschlussvorlage 12/2026','a')]},{pages:vorlage,at,textSha:'x1'});
 assert.equal(r.mainUrl,'a');assert.equal(r.itemKind,'subject');
 assert.equal(r.theme.id,'mobilitaet');assert.ok(r.theme.subs.includes('mobilitaet.rad'));
 assert.deepEqual(r.ruleSummary,buildRuleSummary(mergePages(vorlage),'Neubau Radweg Kreisstraße 12',at,{url:'a',title:'Beschlussvorlage 12/2026'})||null);
 assert.equal(r.version,READ_VERSION);
 assert.equal(r.key,readKey({title:'Neubau Radweg Kreisstraße 12',mainUrl:'a',session:false,textSha:'x1'}));
});

test('Formalie: kein Thema, keine Sachfakten, Zusammenfassung trotzdem aus der Vorlage',()=>{
 const r=readReport({title:'Mitteilungen der Verwaltung',documents:[pdf('Vorlage','a')]},{pages:vorlage,at});
 assert.equal(r.itemKind,'collection');assert.equal(r.theme.id,'offen');
 assert.ok(r.facts.every(f=>f.kind==='faction'||f.kind==='faction_advice'));
});

test('Sitzungsunterlage und fehlender Text: Gründe statt Zusammenfassung, Thema aus dem Titel',()=>{
 const s=readReport({title:'Sanierung der Hauptstraße',documents:[pdf('Öffentliche Niederschrift','n')]},{pages:vorlage,at});
 assert.equal(s.session,true);assert.equal(s.ruleSummary,null);assert.equal(s.summaryIssue,'session-document');
 assert.equal(s.theme.id,'mobilitaet');
 const n=readReport({title:'Sanierung der Hauptstraße',documents:[pdf('Vorlage','a')]},{at});
 assert.equal(n.summaryIssue,'no-text');assert.equal(n.theme.id,'mobilitaet');
 assert.equal(readReport({title:'Sanierung der Hauptstraße',documents:[]},{at}).summaryIssue,'no-document');
 assert.equal(readReport({title:'X',documents:[pdf('Vorlage','a')]},{pages:Array(151).fill('Seite'),at}).summaryIssue,'too-long');
});

test('Schlüssel ändert sich mit Titel, Hauptdokument und Textstand; Hauptdokument wie mainDocument',()=>{
 const k=readKey({title:'A',mainUrl:'u',session:false,textSha:'1'});
 assert.notEqual(k,readKey({title:'B',mainUrl:'u',session:false,textSha:'1'}));
 assert.notEqual(k,readKey({title:'A',mainUrl:'v',session:false,textSha:'1'}));
 assert.notEqual(k,readKey({title:'A',mainUrl:'u',session:false,textSha:'2'}));
 const docs=[pdf('Vorlage','v'),pdf('TOP 8_Informationsvorlage','c')];
 assert.equal(mainDocument(docs,{uses:u=>u==='v'?20:1}).doc.url,'c');
});
