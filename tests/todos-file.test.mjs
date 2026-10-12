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

test('local task endpoint persists subtasks and planned dates and rejects inverted dates without writing',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'todos-')),file=join(dir,'todos.json');
 await writeFile(file,JSON.stringify(sample()));
 const post=async updates=>handleTodoRequest({method:'POST',origin:'http://localhost:5173',host:'localhost:5173',contentType:'application/json',text:JSON.stringify({revision:(await readTodos(file)).revision,updates})},file,'2026-10-12');
 const response=await post([{id:'x',startDatum:'2026-10-15',faellig:'2026-10-20',unteraufgaben:[{id:'sub',text:'Schritt',erledigt:true}]}]);
 assert.equal(response.status,200);
 assert.deepEqual(await readTodos(file),response.body);
 assert.equal(items(response.body)[0].unteraufgaben[0].erledigt,true);
 const before=await readFile(file,'utf8');
 assert.equal((await post([{id:'x',faellig:'2026-10-14'}])).status,400);
 assert.equal(await readFile(file,'utf8'),before);
});

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
 const read=await readTodos(file);
 assert.match(read.revision,/^[a-f0-9]{64}$/);
 assert.deepEqual({...read,revision:undefined},{...saved,revision:undefined});
 assert.deepEqual(await readdir(dir),['todos.json'],'no temp file is left behind');
});

test('the request handler only writes from its own page, with JSON and valid content',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'todos-'));
 const file=join(dir,'todos.json');
 const original=JSON.stringify(sample());
 await writeFile(file,original,'utf8');
 const revision=(await readTodos(file)).revision;
 const post=(over={})=>handleTodoRequest({method:'POST',origin:'http://localhost:5173',host:'localhost:5173',contentType:'application/json',text:JSON.stringify({revision,updates:[{id:'x',erledigt:true,faellig:null}]}),...over},file,'2026-10-08');
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
 assert.equal((await post()).status,409,'a stale page cannot overwrite a saved change');
});

test('the request handler rejects requests without a revision and creates assigned board tasks',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'todos-'));
 const file=join(dir,'todos.json');
 await writeFile(file,JSON.stringify(sample()),'utf8');
 const post=body=>handleTodoRequest({method:'POST',origin:'http://localhost:5173',host:'localhost:5173',contentType:'application/json',text:JSON.stringify(body)},file,'2026-10-08');
 assert.equal((await post({updates:[{id:'x',status:'doing'}]})).status,400);
 const {revision}=await readTodos(file);
 const response=await post({revision,updates:[],creates:[{id:'new',kategorieId:'a',text:'Neu',status:'ready',bearbeiter:'nico'}]});
 assert.equal(response.status,200);
 assert.equal(items(response.body).find(item=>item.id==='new').bearbeiter,'nico');
 assert.deepEqual(await readTodos(file),response.body);
});

test('local file saves serialize concurrent requests and leave a complete file',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'todos-'));
 const file=join(dir,'todos.json');
 await writeFile(file,JSON.stringify(sample()),'utf8');
 const {revision}=await readTodos(file);
 const results=await Promise.allSettled([
  updateTodos([{id:'x',bearbeiter:'max'}],file,'2026-10-08',{revision}),
  updateTodos([{id:'y',bearbeiter:'nico'}],file,'2026-10-08',{revision}),
 ]);
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
 assert.equal(results.find(result=>result.status==='rejected').reason.status,409);
 assert.deepEqual(await readTodos(file),results.find(result=>result.status==='fulfilled').value);
 assert.deepEqual(await readdir(dir),['todos.json']);
});

test('failed local requests release the write queue for subsequent valid changes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'todos-'));
 const file=join(dir,'todos.json');
 await writeFile(file,JSON.stringify(sample()),'utf8');
 const {revision}=await readTodos(file);
 await assert.rejects(updateTodos([{id:'x',bearbeiter:'someone'}],file,'2026-10-08',{revision}),error=>error.status===400);
 const next=await updateTodos([{id:'x',bearbeiter:'max'}],file,'2026-10-08',{revision});
 assert.equal(items(next)[0].bearbeiter,'max');
});

test('the shipped list is well formed',async()=>{
 const data=await readTodos();
 const ids=items(data).map(i=>i.id);
 assert.equal(new Set(ids).size,ids.length,'ids must be unique');
 for(const i of items(data)){
  assert.equal(typeof i.text,'string');assert.equal(typeof i.erledigt,'boolean');
  assert.ok([1,2,3].includes(i.prio),'every task has a priority');
  assert.equal(i.abschluss,i.erledigt?i.abschluss:null);
  if(i.erledigt)assert.ok(['done','wont_do','duplicate'].includes(i.abschluss));
  assert.ok(i.faellig===null||/^\d{4}-\d{2}-\d{2}$/.test(i.faellig));
 }
});

test('local API persists all closure reasons and priorities and reopens with a fresh revision',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'todos-')),file=join(dir,'todos.json');
 await writeFile(file,JSON.stringify(sample()),'utf8');
 const post=async updates=>handleTodoRequest({method:'POST',origin:'http://localhost:5173',host:'localhost:5173',contentType:'application/json',text:JSON.stringify({revision:(await readTodos(file)).revision,updates})},file,'2026-10-12');
 for(const abschluss of ['done','wont_do','duplicate']){
  const response=await post([{id:'x',abschluss,prio:1}]);
  assert.equal(response.status,200);
  assert.equal(items(response.body)[0].abschluss,abschluss);
  assert.equal(items(response.body)[0].prio,1);
  assert.equal(items(response.body)[0].erledigtAm,'2026-10-12');
  assert.deepEqual(await readTodos(file),response.body);
 }
 const reopened=await post([{id:'x',status:'doing',prio:3}]);
 assert.equal(reopened.status,200);
 assert.equal(items(reopened.body)[0].abschluss,null);
 assert.equal(items(reopened.body)[0].erledigtAm,null);
 assert.equal(items(reopened.body)[0].prio,3);
 const before=await readFile(file,'utf8');
 assert.equal((await post([{id:'x',prio:null}])).status,400);
 assert.equal((await post([{id:'x',status:'ready',abschluss:'duplicate'}])).status,400);
 assert.equal(await readFile(file,'utf8'),before);
});
