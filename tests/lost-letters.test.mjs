import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreLostLetters,LOST} from '../shared/lost-letters.mjs';
import model from '../shared/lost-letters.json' with {type:'json'};

// "#" stands for a character the source lost (U+FFFD), as the KIC interface of Großostheim sends its titles.
const restore=s=>restoreLostLetters(s.replaceAll('#',LOST));

test('lost umlauts, ß and § come back from their neighbours (titles of Großostheim)',()=>{
 assert.equal(restore('Vorstellung und Beschluss zum Antrag zum Haushalt 2027 - Aufnahme von Kosten f#r Hitzeschutzplanung (2026/08)'),'Vorstellung und Beschluss zum Antrag zum Haushalt 2027 - Aufnahme von Kosten für Hitzeschutzplanung (2026/08)');
 assert.equal(restore('7. Sitzung des Werkausschusses der Gemeindewerke Gro#ostheim - Mittagsinsel'),'7. Sitzung des Werkausschusses der Gemeindewerke Großostheim - Mittagsinsel');
 assert.equal(restore('B#rgerversammlung'),'Bürgerversammlung');
 assert.equal(restore('Genehmigung der Niederschrift #ber den #ffentlichen Teil der Sitzung vom 12. November 2025'),'Genehmigung der Niederschrift über den öffentlichen Teil der Sitzung vom 12. November 2025');
 assert.equal(restore('1. #nderung der Beitrags- und Geb#hrensatzung zur Wasserabgabesatzung'),'1. Änderung der Beitrags- und Gebührensatzung zur Wasserabgabesatzung');
 assert.equal(restore('Beteiligung der Beh#rden gem. # 4 Abs. 2 BauGB'),'Beteiligung der Behörden gem. § 4 Abs. 2 BauGB');
 // Several lost characters in a row.
 assert.equal(restore('Protokoll gem## # 27 der Gesch#ftsordnung'),'Protokoll gemäß § 27 der Geschäftsordnung');
 assert.equal(restore('#berplanm##ige Ausgaben f#r Kl#rwerk und Stra#enbau'),'Überplanmäßige Ausgaben für Klärwerk und Straßenbau');
 assert.equal(restore('Beteiligung nach ## 3 und 4 BauGB, Ver#nderungssperre (##14, 17 BauGB)'),'Beteiligung nach §§ 3 und 4 BauGB, Veränderungssperre (§§14, 17 BauGB)');
});

test('quote marks, capitals and words: what stands next to the lost character decides',()=>{
 assert.equal(restore('Regionalplan, Kapitel #Siedlungsstruktur# und #Mobilit#t#'),'Regionalplan, Kapitel „Siedlungsstruktur“ und „Mobilität“');
 // Capitals next to capitals, a noun inside the title, a preposition.
 assert.equal(restore('#PNV-Konzept'),'ÖPNV-Konzept');
 assert.equal(restore('Kommunale Verkehrs#berwachung (KV#)'),'Kommunale Verkehrsüberwachung (KVÜ)');
 assert.equal(restore('Bericht zur #ffentlichkeitsbeteiligung #ber den Entwurf'),'Bericht zur Öffentlichkeitsbeteiligung über den Entwurf');
 // Between two letters only a letter: no quote mark inside a word.
 assert.equal(restore('Anschaffung einer Tischkapps#ge'),'Anschaffung einer Tischkappsäge');
});

test('text without a lost character stays as it is',()=>{
 for(const t of ['Ärger über Öl','Lärm <55 dB und >45 dB','Haushalt 2027 - Beratung','',undefined,null])assert.equal(restoreLostLetters(t),t);
 assert.equal(model.side,3);assert.ok(model.titles>100000,'learned from the titles of the search cards');
 for(const c of ['ä','ö','ü','ß','§','„','“'])assert.ok(model.windows[c],c);
});
