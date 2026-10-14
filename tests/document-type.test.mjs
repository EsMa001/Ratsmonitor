// Dokumentart aus Titel und Textanfang (shared/document-type.mjs), für den Score der PDF-Ablage
import test from 'node:test';
import assert from 'node:assert/strict';
import {documentType,documentTypeFromText,effectiveType,primaryPdf,reportTypes} from '../shared/document-type.mjs';

test('Titel: das erste Wort entscheidet, „Anlage“ nur als eigenes Wort',()=>{
 const expect={
  'Beschlussvorlage 2025/10/0056 (Vergabe Verbindungsleitung zur Aufbereitungsanlage)':'paper',
  'Beschlussvorlage 2025/061/BA (Stellungnahme der Gemeinde zum Bauvorhaben)':'paper',
  'Beschlussvorlage Genehmigung des Protokolls':'paper',
  'Vorlage 2026/0185-1 (2. Nachtragssatzung)':'paper',
  'Drucksache 2026/082 (Beschluss zur Straße)':'paper',
  'Anlage 18 zur Niederschrift SoA':'attachment',
  'Vorlage (Anlage 2)':'attachment',
  'Öffentliches Beschlussprotokoll':'minutes',
  'Mitteilung zur Kläranlage':'paper',
  'Sportanlage Nord':'other',
  'Photovoltaik-Anlage Schule':'attachment',
 };
 for(const [title,type] of Object.entries(expect))assert.equal(documentType(title),type,title);
});

test('Textanfang: frühestes Merkmal, Anlage nur ganz vorn, Einladung nur als Überschrift',()=>{
 const expect=[
  ['Sachbearbeiter: L. Seite 1 von 3 STADT FEHMARN Der Bürgermeister Vorlage 2026-188 Bauausschuss','paper'],
  ['Gemeinde Schermbeck Der Bürgermeister Beschlussvorlage Drucksache 00035/2026','paper'],
  ['Anlage 1 zur Vorlage Nr. 12/2026 Lageplan','attachment'],
  ['Auszug aus der Niederschrift über die 11. Sitzung des Ortsrates','decision'],
  ['Stadt X Niederschrift über die 9. Sitzung des Stadtrates','minutes'],
  ['Gemeinde Y Einladung zur Sitzung des Rates Tagesordnung 1. Vorlage-Nr. 12','invitation'],
  ['SPD-Kreistagsfraktion Niederhoner Straße 2 37269 Eschwege An Herrn Kreistagsvorsitzenden Antrag zur Tagesordnung der nächsten Sitzung',null],
  ['Tätigkeitsbericht der Musikschule für das Jahr 2025',null],
 ];
 for(const [text,type] of expect)assert.equal(documentTypeFromText(text),type,text);
});

test('effektive Art: Vorlage laut Text gilt, Titel ohne Art übernimmt den Text, sonst der Titel',()=>{
 assert.equal(effectiveType('other','paper'),'paper');
 assert.equal(effectiveType('attachment','paper'),'paper');
 assert.equal(effectiveType('invitation','paper'),'paper');
 assert.equal(effectiveType('decision','paper'),'decision');
 assert.equal(effectiveType('decision','minutes'),'decision');
 assert.equal(effectiveType('attachment','paper','Anlage 1 - Beschlussvorschlag des ZV'),'attachment');
 assert.equal(effectiveType('minutes','paper'),'minutes');
 assert.equal(effectiveType('other','invitation'),'invitation');
 assert.equal(effectiveType('paper','invitation'),'paper');
 assert.equal(effectiveType('attachment',null),'attachment');
});

test('Fassung 3: „Nachtrag“ nur als Wort, Sammeldokument eines Punkts ist eine Vorlage',()=>{
 assert.equal(documentType('Information G/VIII/26/0119 (Vorberatung Nachtragshaushalt 2026).pdf'),'other');
 assert.equal(documentType('Einladung 1. Nachtrag (Ausschuss für Planung)'),'invitation');
 assert.equal(documentType('Nachtrag zur Tagesordnung'),'invitation');
 assert.equal(documentType('Sammeldokument öffentlich'),'paper');
 assert.equal(documentType('Vorlage-Sammeldokument'),'paper');
 assert.equal(documentType('Sitzungsmappe (Sammeldokument)'),'invitation');
});

test('Hauptdokument: nie ein PDF an vielen Berichten, bei Text das beste mit Text',()=>{
 const pdf=(title,url)=>({title,url,kind:'application/pdf'});
 const docs=[pdf('2026/0063','a'),pdf('anlage 1','b'),pdf('TOP 8_Informationsvorlage_24062026','c')];
 assert.equal(primaryPdf(docs).url,'c');
 assert.equal(primaryPdf(docs,{uses:u=>u==='c'?19:1}).url,'a');
 const bundle=[pdf('Vorlage','v'),pdf('Sammeldokument öffentlich','s')];
 assert.equal(primaryPdf(bundle).url,'v');
 assert.equal(primaryPdf(bundle,{hasText:u=>u==='s'}).url,'s');
 assert.equal(primaryPdf(bundle,{hasText:()=>false}).url,'v');
 assert.equal(primaryPdf([pdf('Einladung','e')],{uses:()=>30}).url,'e');
});

test('Art im Bericht: mit Vorlage sind PDFs ohne erkennbare Art Anlagen',()=>{
 const pdf=(title,url)=>({title,url,kind:'application/pdf'});
 const t=reportTypes([pdf('Vorlage','a'),pdf('Ergebnisplan 2026','b'),pdf('Beschlusstext 77/2025','c'),pdf('Bekanntmachung','d')]);
 assert.deepEqual([...t.values()],['paper','attachment','decision','invitation']);
 assert.equal(reportTypes([pdf('Ergebnisplan 2026','a'),pdf('Beschluss - Top 9','b')]).get('a'),'other');
});
