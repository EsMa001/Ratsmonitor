import test from 'node:test';
import assert from 'node:assert/strict';
import {decisionNotice,noticeMatter} from '../server/integrations/website-notices.mjs';
import {sessionScore,SESSION_THRESHOLD} from '../server/integrations/website-feeds.mjs';

// Nachgebildet nach den öffentlichen Bekanntmachungen der VG Oberes Glantal (24.10.2026).
test('a notice of a decision names the body and day of its meeting; its title is the matter of the notice',()=>{
 const lines=['Öffentliche Bekanntmachung','der Ortsgemeinde Matzenbach','Vollzug des Baugesetzbuches (BauGB)','Der Ortsgemeinderat Matzenbach hat in seiner Sitzung vom 21.07.2026 die 2. Satzung über die','Veränderungssperre für den Geltungsbereich … beschlossen, die hiermit gem. § 16 Abs. 2 BauGB','bekannt gemacht wird.'];
 const n=decisionNotice('Öffentliche Bekanntmachung der OG Matzenbach - Vollzug des BauGB - 2. Satzung über die Veränderungssperre - Reuschbacher- u. Bergstraße vom 22.07.2026.pdf',lines);
 assert.deepEqual([n.date,n.committee,n.title,n.publicity],['2026-07-21','Ortsgemeinderat Matzenbach','2. Satzung über die Veränderungssperre - Reuschbacher- u. Bergstraße','public']);
 assert.equal(noticeMatter('Öffentliche Bekanntmachung der OG Langebach - Beteiligung der Öffentlichkeit - Bebauungsplan In den Wöllmeswiesen vom 05.09.2026.pdf'),'Bebauungsplan In den Wöllmeswiesen');
 // Without a usable label the heading above the sentence is the title.
 const h=decisionNotice('',['Öffentliche Bekanntmachung','gem. § 3 Abs. 2 BauGB','Bebauungsplan „In den Wöllmeswiesen“','der Ortsgemeinde Langenbach','Der Ortsgemeinderat Langenbach hat in seiner Sitzung am 15.04.2025 den','Aufstellungsbeschluss gefasst.']);
 assert.equal(h.date,'2025-04-15');assert.match(h.title,/^Bebauungsplan „In den Wöllmeswiesen“/);
});

test('a dedication of a road, an ordinance or a notice without a meeting of a body is no report',()=>{
 assert.equal(decisionNotice('Widmungsverfügung der OG SK - Jan-Hutzel-Weg.pdf',['Allgemeinverfügung','Gemäß § 36 LStrG und dem Beschluss des Ortsgemeinderates Schönenberg-Kübelberg vom 10.06.2026 wird gewidmet']),null);
 assert.equal(decisionNotice('Bekanntmachung Grünlandkartierung',['Das Land führt eine Kartierung durch.']),null);
 assert.equal(decisionNotice('Öffentliche Bekanntmachung Vergabe Kindergarten',['Der Verbandsgemeinderat hat in nichtöffentlicher Sitzung am 11.06.2025 … vergeben.']).publicity,'nonpublic');
});

test('links of notices of decisions are read; dedications are not',()=>{
 assert.ok(sessionScore({url:'https://www.vgog.de/x/Matzenbach/B.pdf',label:'Öffentliche Bekanntmachung der OG Matzenbach - Vollzug des BauGB - 2. Satzung über die Veränderungssperre.pdf'})>=SESSION_THRESHOLD);
 assert.ok(sessionScore({url:'https://www.vgog.de/x/Langenbach/B.pdf',label:'Öffentliche Bekanntmachung der OG Langebach - Beteiligung der Öffentlichkeit - Bebauungsplan In den Wöllmeswiesen.pdf'})>=SESSION_THRESHOLD);
 assert.ok(sessionScore({url:'https://www.vgog.de/x/Langenbach/W.pdf',label:'Widmungsverfügung der OG Langenbach - Hauptstraße.pdf'})<SESSION_THRESHOLD);
});
