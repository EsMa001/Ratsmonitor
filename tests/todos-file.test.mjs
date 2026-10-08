import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {applyTodoUpdates,handleTodoRequest,readTodos,updateTodos} from '../server/integrations/todos-file.mjs';

const sample=()=>({version:1,kategorien:[{id:'a',name:'A',items:[
 {id:'x',text:'Eins',erledigt:false,faellig:null,erledigtAm:null},
 {id:'y',text:'Zwei',hinweis:'H',erledigt:true,faellig:'2026-10-01',erledigtAm:'2026-09-30'}]}]});
const items=data=>data.kategorien.flatMap(c=>c.items);

test('marking done sets the date, keeps text and order, and never removes the entry',()=>{
 const next=applyTodoUpdates(sample(),[{id:'x',erledigt:true,faellig:'2026-11-05'}],'2026-10-08');
 assert.deepEqual(items(next).map(i=>i.id),['x','y']);
 assert.equal(items(next)[0].erledigt,true);
 assert.equal(items(next)[0].erledigtAm,'2026-10-08');
 assert.equal(items(next)[0].faellig,'2026-11-05');
 assert.equal(items(next)[0].text,'Eins');
 assert.equal(items(next)[1].hinweis,'H');
});

test('an entry that stays done keeps its original completion date; undoing clears it',()=>{
 const stays=applyTodoUpdates(sample(),[{id:'y',erledigt:true,faellig:null}],'2026-10-08');
 assert.equal(items(stays)[1].erledigtAm,'2026-09-30');
 const undone=applyTodoUpdates(sample(),[{id:'y',erledigt:false,faellig:'2026-10-01'}],'2026-10-08');
 assert.equal(items(undone)[1].erledigt,false);
 assert.equal(items(undone)[1].erledigtAm,null);
});

test('empty date clears the due date',()=>{
 const next=applyTodoUpdates(sample(),[{id:'y',erledigt:true,faellig:''}],'2026-10-08');
 assert.equal(items(next)[1].faellig,null);
});

test('invalid requests are rejected',()=>{
 for(const bad of [null,'x',[{id:'x'}],[{id:'x',erledigt:'ja'}],[{id:'nope',erledigt:true}],[{id:'x',erledigt:true,faellig:'05.11.2026'}],[{id:'x',erledigt:true,faellig:'2026-02-31'}],[{id:'x',erledigt:true,faellig:20261105}]]){
  assert.throws(()=>applyTodoUpdates(sample(),bad,'2026-10-08'),e=>e.status===400,JSON.stringify(bad));
 }
});

test('updateTodos writes the file and readTodos returns it',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'todos-'));
 const file=join(dir,'todos.json');
 await writeFile(file,JSON.stringify(sample()),'utf8');
 await updateTodos([{id:'x',erledigt:true,faellig:'2026-11-05'}],file,'2026-10-08');
 const saved=JSON.parse(await readFile(file,'utf8'));
 assert.equal(items(saved)[0].erledigt,true);
 assert.deepEqual(await readTodos(file),saved);
 assert.deepEqual(await readdir(dir),['todos.json'],'no temp file is left behind');
});

test('the request handler only writes from its own page, with JSON and valid content',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'todos-'));
 const file=join(dir,'todos.json');
 const original=JSON.stringify(sample());
 await writeFile(file,original,'utf8');
 const post=(over={})=>handleTodoRequest({method:'POST',origin:'http://localhost:5173',host:'localhost:5173',contentType:'application/json',text:JSON.stringify({updates:[{id:'x',erledigt:true,faellig:null}]}),...over},file,'2026-10-08');
 assert.equal((await handleTodoRequest({method:'GET'},file)).status,200);
 assert.equal((await post({origin:undefined})).status,403);
 assert.equal((await post({origin:'http://evil.example'})).status,403);
 assert.equal((await post({contentType:'text/plain'})).status,415);
 assert.equal((await post({text:'{kaputt'})).status,400);
 assert.equal((await post({text:'[]'})).status,400);
 assert.equal((await post({text:JSON.stringify({updates:[{id:'nope',erledigt:true}]})})).status,400);
 assert.equal((await handleTodoRequest({method:'DELETE'},file)).status,405);
 assert.equal(await readFile(file,'utf8'),original,'rejected requests leave the file untouched');
 const ok=await post();
 assert.equal(ok.status,200);
 assert.equal(items(ok.body)[0].erledigt,true);
 assert.equal(items(JSON.parse(await readFile(file,'utf8')))[0].erledigtAm,'2026-10-08');
});

test('the shipped list is well formed',async()=>{
 const data=await readTodos();
 const ids=items(data).map(i=>i.id);
 assert.equal(new Set(ids).size,ids.length,'ids must be unique');
 for(const i of items(data)){
  assert.equal(typeof i.text,'string');assert.equal(typeof i.erledigt,'boolean');
  assert.ok(i.faellig===null||/^\d{4}-\d{2}-\d{2}$/.test(i.faellig));
 }
});
