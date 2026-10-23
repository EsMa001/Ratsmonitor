import test from 'node:test';
import assert from 'node:assert/strict';
import {siteAllowed} from '../server/integrations/website.mjs';
// VG Burkhardtsdorf, 2026: Auerbach and Burkhardtsdorf publish on two websites of their own.
const vg={id:'de-145215103',base:'https://www.auerbach-erzgebirge.de/',memberSites:['https://www.burkhardtsdorf.de/']};
test('the website of a member municipality is read only where the entry names it',()=>{
 assert.equal(siteAllowed('https://www.burkhardtsdorf.de/de/sitzungsunterlagen.html#x',vg),'https://www.burkhardtsdorf.de/de/sitzungsunterlagen.html');
 assert.equal(siteAllowed('https://www.auerbach-erzgebirge.de/a.pdf',vg),'https://www.auerbach-erzgebirge.de/a.pdf');
 assert.throws(()=>siteAllowed('https://www.burkhardtsdorf.de/',{...vg,memberSites:undefined}),/Nicht freigegebene/);
 assert.throws(()=>siteAllowed('https://www.gornsdorf.de/',vg),/Nicht freigegebene/);
 assert.throws(()=>siteAllowed('http://www.burkhardtsdorf.de/',vg),/Nicht freigegebene/);
});

test('a PDF text of single words, one a line, is rebuilt from the heights of its words; an ordinary text is not',async()=>{
 const {scattered}=await import('../server/integrations/website.mjs');
 // Freising, Niederschrift 23.07.2026 (pages turned by 270°): every word its own line.
 assert.equal(scattered(Array.from({length:60},(_,i)=>['Anwesend','sind','alle','Stadträte'][i%4]).join('\n')),true);
 assert.equal(scattered(['Einladung zur Sitzung des Gemeinderates','Tagesordnung','1. Bauantrag Neubau Scheune','2. Verschiedenes',...Array.from({length:50},(_,i)=>`${i+3}. Punkt mit Titel ${i}`)].join('\n')),false);
 assert.equal(scattered('Wort\nWort\nWort'),false,'a short text is never rebuilt');
});
