import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openD1} from '../server/node/d1-sqlite.mjs';
import {diffTodos,mergeTodos,readChanges,readStoredTodos,updateStoredTodos} from '../server/integrations/todos-store.mjs';

const file=()=>({version:1,kategorien:[{id:'a',name:'A',items:[
 {id:'x',text:'Eins',erledigt:false,faellig:null,erledigtAm:null},
 {id:'y',text:'Zwei',erledigt:true,faellig:'2026-10-01',erledigtAm:'2026-09-30'}]}]});
const items=data=>data.kategorien.flatMap(c=>c.items);
const db=async()=>{
 const d=openD1(join(await mkdtemp(join(tmpdir(),'todos-')),'db.sqlite'),{create:true});
 await d.prepare('CREATE TABLE system_state(key TEXT PRIMARY KEY,value TEXT NOT NULL)').run();
 return d;
};

test('the server stores only differences from the file and shows file plus differences',async()=>{
 const d=await db();
 assert.deepEqual(await readStoredTodos(d,file()),file());
 const next=await updateStoredTodos(d,file(),[{id:'x',erledigt:true,faellig:'2026-11-05'}],'2026-10-11');
 assert.equal(items(next)[0].erledigtAm,'2026-10-11');
 assert.deepEqual(Object.keys(await readChanges(d)),['x']);
 assert.deepEqual(await readStoredTodos(d,file()),next);
 // Zurück auf den Stand der Datei: nichts mehr gespeichert.
 await updateStoredTodos(d,file(),[{id:'x',erledigt:false,faellig:null}],'2026-10-11');
 assert.deepEqual(await readChanges(d),{});
});

test('a change made against an older file yields to the newer file and is cleaned up on the next save',async()=>{
 const d=await db();
 await updateStoredTodos(d,file(),[{id:'x',erledigt:true,faellig:null}],'2026-10-11');
 const deployed=file();items(deployed)[0].faellig='2026-12-01';
 assert.equal(items(await readStoredTodos(d,deployed))[0].erledigt,false);
 await updateStoredTodos(d,deployed,[{id:'y',erledigt:false,faellig:'2026-10-01'}],'2026-10-11');
 assert.deepEqual(Object.keys(await readChanges(d)),['y']);
});

test('pulling the changes into the file gives the server view; afterwards the stored changes are redundant',()=>{
 const next=mergeTodos(file(),{x:{erledigt:true,faellig:null,erledigtAm:'2026-10-11',base:{erledigt:false,faellig:null}}});
 assert.equal(items(next)[0].erledigt,true);
 assert.deepEqual(diffTodos(next,next),{});
 // Datei neu ausgeliefert: base passt nicht mehr, die Datei gilt und zeigt dasselbe.
 assert.deepEqual(mergeTodos(next,{x:{erledigt:true,faellig:null,erledigtAm:'2026-10-11',base:{erledigt:false,faellig:null}}}),next);
});

test('unknown entries and bad dates are rejected without writing',async()=>{
 const d=await db();
 await assert.rejects(updateStoredTodos(d,file(),[{id:'z',erledigt:true,faellig:null}]),/Unbekannter Eintrag/);
 await assert.rejects(updateStoredTodos(d,file(),[{id:'x',erledigt:true,faellig:'2026-02-30'}]),/Ungültiges Datum/);
 assert.deepEqual(await readChanges(d),{});
});
