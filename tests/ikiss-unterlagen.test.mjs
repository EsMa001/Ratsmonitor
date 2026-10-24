import test from 'node:test';
import assert from 'node:assert/strict';
import {parseIkissMeetings,parseIkissItems,germanDay,collectIkissUnterlagen} from '../server/integrations/ikiss-unterlagen.mjs';

// Nachgebildet nach kreistag.landkreis-hildburghausen.de (24.10.2026).
const base='https://kreistag.landkreis-hildburghausen.de/';
const overview='<ul><li><a href="/index.php?La=1&amp;object=tx,3130.255.1&amp;kuo=2&amp;sub=0">Unterlagen der 16. Kreistagssitzung am 26. Februar 2026</a></li>'
 +'<li><a href="/index.php?La=1&amp;object=tx,3130.256.1&amp;kuo=2&amp;sub=0">Unterlagen der 17. Kreistagssitzung am 23. M&auml;rz 2026</a></li>'
 +'<li><a href="/Kontakt.php">Kontakt</a></li></ul>';
const file=(id,label)=>`<a href="/media/custom/3130_${id}_1.PDF?1789725335" target="_blank">${label}</a> <span>131 kB</span>`;
const meeting=[
 file(1,'0.2026.02.26 - 00 Einladung'),
 file(2,'0.2026.02.26 - 04.1 BV 132-26 Best&auml;tigung der Sitzungsniederschrift'),
 file(3,'0.2026.02.26 - 05.1 BV 133-26 2. &Auml;nderungssatzung Benutzungssatzung KVHS'),
 file(4,'0.2026.02.26 - 05.2 BV 133-26 Anlage 1 - 2. &Auml;nderungssatzung Benutzungssatzung'),
 file(5,'0.2026.02.26 - 06.1 BV 134-2026 - Anlage 1 - Schreiben vom 09.12.2025'),
 file(6,'0.2026.02.26 - 06.2 BV 134-2026 Aufhebung des KT.B. Nr. 117-25-2025'),
 file(7,'0.2026.02.26 - 07.1 BV 135-2026'),
 file(8,'0.2026.02.26 - 08 Vergabeinformation'),
 file(9,'0.2026.03.23 - 09 BV 140-26 Nachgereicht für eine andere Sitzung'),
 file(10,'0.2026.02.26 - 15 Anfrage AfD-Fraktion - Fragen zum Tierheim'),
].join('\n');

test('IKISS-Sitzungsunterlagen: Sitzungen der Übersicht mit Tag und Gremium',()=>{
 assert.equal(germanDay('23. März 2026'),'2026-03-23');assert.equal(germanDay('05.06.2025'),'2025-06-05');
 assert.deepEqual(parseIkissMeetings(overview,base).map(m=>[m.date,m.body,m.url]),[
  ['2026-02-26','Kreistag',base+'index.php?La=1&object=tx,3130.255.1&kuo=2&sub=0'],
  ['2026-03-23','Kreistag',base+'index.php?La=1&object=tx,3130.256.1&kuo=2&sub=0']]);
});

test('IKISS-Sitzungsunterlagen: ein Punkt je Vorlage aus den Linktexten, Anlagen bei ihrer Vorlage, Einladung und fremde Tage nicht',()=>{
 const items=parseIkissItems(meeting,base,'2026-02-26');
 assert.deepEqual(items.map(i=>[i.number,i.reference,i.title,i.documents.length]),[
  ['4','BV 132-26','Bestätigung der Sitzungsniederschrift',1],
  ['5','BV 133-26','2. Änderungssatzung Benutzungssatzung KVHS',2],
  ['6','BV 134-2026','Aufhebung des KT.B. Nr. 117-25-2025',2],
  ['8','','Vergabeinformation',1],
  ['15','','Anfrage AfD-Fraktion - Fragen zum Tierheim',1]]);
 assert.equal(items[1].documents[1].url,base+'media/custom/3130_4_1.PDF?1789725335');
});

test('IKISS-Sitzungsunterlagen: Abruf liest nur Übersicht und Sitzungsseiten, Formalien bleiben weg',async()=>{
 const asked=[];
 const pages={[base+'Aktuelles-Allgemeines/Sitzungsunterlagen']:overview,[base+'index.php?La=1&object=tx,3130.255.1&kuo=2&sub=0']:meeting,[base+'index.php?La=1&object=tx,3130.256.1&kuo=2&sub=0']:'<p>Noch keine Unterlagen</p>'};
 const get=async url=>{asked.push(url);if(!(url in pages))throw Error('HTTP 404');return pages[url];};
 const source={id:'de-16069',name:'Landkreis Hildburghausen',kind:'district',method:'scraper',adapter:'ikiss-unterlagen',base,pages:[base+'Aktuelles-Allgemeines/Sitzungsunterlagen']};
 const d=await collectIkissUnterlagen(source,{now:new Date('2026-04-01T12:00:00Z'),window:'3m',get});
 assert.deepEqual(d.topics.map(t=>t.title).sort(),['2. Änderungssatzung Benutzungssatzung KVHS','Aufhebung des KT.B. Nr. 117-25-2025','Vergabeinformation']);
 assert.ok(d.topics.every(t=>t.committee==='Kreistag'&&t.eventDate==='2026-02-26'&&t.id.startsWith('de-16069-ik-2026-02-26-kreistag-')));
 assert.ok(asked.every(u=>u in pages),'nur Übersicht und Sitzungsseiten, keine PDF-Dateien');
 // Eine andere Adresse der Website als Sitzungsseite wird nicht gelesen.
 await assert.rejects(collectIkissUnterlagen(source,{now:new Date('2026-04-01T12:00:00Z'),window:'3m',get:async url=>{if(url.endsWith('Sitzungsunterlagen'))return '<a href="/Kontakt.php">Unterlagen der 1. Kreistagssitzung am 1. März 2026</a>';return '';}}).then(r=>{if(r.coverage.issues.some(i=>/Nicht freigegebene Quelladresse/.test(i)))throw Error('abgelehnt');return r;}),/abgelehnt/);
});
