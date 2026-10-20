import test from 'node:test';import assert from 'node:assert/strict';import{statusOf,readList,checkedUrl}from'../server/integrations/oparl.mjs';
const past={start:'2026-09-17'},future={start:'2099-01-01'};
test('Ein Beschlussvorschlag und ein vergangener Termin sind keine Entscheidung',()=>{assert.equal(statusOf({consultation:'x',name:'Das Vorhaben wird beschlossen'},{role:'Entscheidung'},past),'consulting')});
test('Vorberatung bleibt Empfehlung, auch bei einstimmigem Beschluss',()=>{assert.equal(statusOf({result:'einstimmig beschlossen'},{role:'Vorberatung'},past),'recommended')});
test('Ergebnis eines entscheidenden Gremiums wird als Beschluss erkannt',()=>{assert.equal(statusOf({result:'mehrheitlich beschlossen'},{role:'Entscheidung'},past),'approved')});
test('Zukünftige Sitzung erzeugt keinen Beschluss',()=>{assert.equal(statusOf({result:'beschlossen',consultation:'x'},{role:'Entscheidung'},future),'consulting')});
test('Ablehnung, Kenntnisnahme und Vertagung bleiben getrennt',()=>{assert.equal(statusOf({result:'abgelehnt'},{role:'Entscheidung'},past),'rejected');assert.equal(statusOf({result:'zur Kenntnis genommen'},{},past),'info');assert.equal(statusOf({result:'vertagt'},{},past),'postponed')});
test('API-Paginierung folgt next und erkennt Schleifen',async()=>{const u='https://oparl.stadt-muenster.de/bodies';let count=0;assert.deepEqual(await readList(u,async()=>++count===1?{data:[1],links:{next:u+'?page=2'}}:{data:[2],links:{}}),[1,2]);await assert.rejects(readList(u,async()=>({data:[],links:{next:u}})),/Wiederholte/)});
test('Fremde Datenquellen werden abgewiesen',()=>{assert.throws(()=>checkedUrl('https://example.org/x'));assert.throws(()=>checkedUrl('http://oparl.stadt-muenster.de/x'))});

test('sourceSummary nennt den Ort des Lesers; ein Titel mit „in Münster…“ bleibt unverändert',async()=>{
 const {sourceSummary}=await import('../server/integrations/oparl.mjs');
 const t={officialTitle:'Tourismus in Münsterland stärken',status:'consulting',committee:'Rat',reference:''};
 assert.equal(sourceSummary(t,{place:'Billerbeck'}).longSummary[0],'Das Thema „Tourismus in Münsterland stärken“ wird in Billerbeck behandelt. Eine Vorlage steht zur Beratung.');
 assert.match(sourceSummary(t).longSummary[0],/wird in Münster behandelt\./);
});
