import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openD1} from '../server/node/d1-sqlite.mjs';
import {applyTodoUpdates,diffTodos,mergeTodos,normalizeTodos,readChanges,readStoredTodos,updateStoredTodos} from '../server/integrations/todos-store.mjs';

const file=()=>({version:1,kategorien:[{id:'a',name:'A',items:[
 {id:'x',text:'Eins',erledigt:false,faellig:null,erledigtAm:null},
 {id:'y',text:'Zwei',erledigt:true,faellig:'2026-10-01',erledigtAm:'2026-09-30'}]},
 {id:'b',name:'B',items:[]}]});
const items=data=>data.kategorien.flatMap(category=>category.items);
const withoutRevision=input=>{const data={...input};delete data.revision;return data;};
const db=async(t)=>{
 const d=openD1(join(await mkdtemp(join(tmpdir(),'todos-')),'db.sqlite'),{create:true});
 t.after(()=>d.close());
 await d.prepare('CREATE TABLE system_state(key TEXT PRIMARY KEY,value TEXT NOT NULL)').run();
 return d;
};
const save=(d,base,revision,updates,creates=[])=>updateStoredTodos(d,base,updates,'2026-10-11',{revision,creates});

test('legacy due dates remain planned ends and checklists default to empty',()=>{
 const normalized=items(normalizeTodos(file()));
 assert.equal(normalized[1].faellig,'2026-10-01');
 assert.equal(normalized[1].startDatum,null);
 assert.deepEqual(normalized[1].unteraufgaben,[]);
 assert.deepEqual(Object.keys(diffTodos(file(),normalizeTodos(file())).changes),[]);
});

test('subtasks and planned intervals persist, can be checked, edited, removed and cleared',async(t)=>{
 const d=await db(t),base=file(),initial=await readStoredTodos(d,base);
 const checklist=[{id:'s1',text:'  Entwurf  ',erledigt:false},{id:'s2',text:'Pruefen',erledigt:true}];
 let next=await save(d,base,initial.revision,[{id:'x',startDatum:'2026-10-15',faellig:'2026-10-20',unteraufgaben:checklist}]);
 assert.equal(items(next)[0].unteraufgaben[0].text,'Entwurf');
 assert.equal(checklist[0].text,'  Entwurf  ','input is not mutated');
 assert.deepEqual(await readStoredTodos(d,base),next);
 next=await save(d,base,next.revision,[{id:'x',unteraufgaben:[{id:'s1',text:'Freigabe',erledigt:true}]}]);
 assert.equal(items(next)[0].status,'backlog','finishing subtasks does not close the parent');
 assert.equal(items(next)[0].faellig,'2026-10-20');
 assert.deepEqual(items(next)[0].unteraufgaben,[{id:'s1',text:'Freigabe',erledigt:true}]);
 next=await save(d,base,next.revision,[{id:'x',unteraufgaben:[],startDatum:null,faellig:null}]);
 assert.deepEqual(items(next)[0].unteraufgaben,[]);
 assert.equal(items(next)[0].startDatum,null);
 assert.equal(items(next)[0].faellig,null);
 assert.deepEqual((await readChanges(d)).changes,{});
});

test('new tasks retain their subtasks and interval through a pull and subsequent deployment',async(t)=>{
 const d=await db(t),base=file(),initial=await readStoredTodos(d,base);
 const next=await save(d,base,initial.revision,[],[{id:'new',kategorieId:'a',text:'Neu',startDatum:'2026-10-15',faellig:'2026-10-20',unteraufgaben:[{id:'sub',text:'Erster Schritt',erledigt:false}]}]);
 const pulled=withoutRevision(next);
 await save(d,base,next.revision,[{id:'new',startDatum:'2026-10-16',unteraufgaben:[{id:'sub',text:'Erster Schritt',erledigt:true}]}]);
 const deployed=await readStoredTodos(d,pulled),task=items(deployed).find(item=>item.id==='new');
 assert.equal(task.startDatum,'2026-10-16');
 assert.equal(task.faellig,'2026-10-20');
 assert.equal(task.unteraufgaben[0].erledigt,true);
 assert.equal(items(deployed).filter(item=>item.id==='new').length,1);
});

test('planned dates are validated against existing partner dates and rejected atomically',async(t)=>{
 const d=await db(t),base=file();
 Object.assign(items(base)[0],{startDatum:'2026-10-15',faellig:'2026-10-20'});
 const initial=await readStoredTodos(d,base);
 for(const patch of [{startDatum:'2026-10-21'},{faellig:'2026-10-14'},{startDatum:'2026-02-30'},{startDatum:42}]){
  await assert.rejects(save(d,base,initial.revision,[{id:'y',text:'Must not persist'},{id:'x',...patch}]),error=>error.status===400);
  assert.deepEqual(await readStoredTodos(d,base),initial);
 }
 const equal=await save(d,base,initial.revision,[{id:'x',faellig:'2026-10-15'}]);
 assert.equal(items(equal)[0].faellig,'2026-10-15','same-day intervals are valid');
 const moved=await save(d,base,equal.revision,[{id:'x',startDatum:'2026-11-01',faellig:'2026-11-02'}]);
 assert.equal(items(moved)[0].startDatum,'2026-11-01','both ends can change together');
});

test('invalid subtasks reject the complete request before writing',async(t)=>{
 const d=await db(t),base=file(),initial=await readStoredTodos(d,base);
 const sub={id:'s',text:'Schritt',erledigt:false};
 for(const unteraufgaben of [null,{},[{}],[{...sub,text:' '}],[{...sub,erledigt:'ja'}],[{...sub,extra:true}],[sub,sub],[{...sub,id:''}],[{...sub,text:'x'.repeat(501)}],Array.from({length:101},(_,i)=>({...sub,id:String(i)}))]){
  await assert.rejects(save(d,base,initial.revision,[{id:'x',unteraufgaben}]),error=>error.status===400);
  assert.deepEqual(await readStoredTodos(d,base),initial);
 }
});

test('unchanged checklist values produce no overrides and planned intervals survive source changes together',()=>{
 const base=file();
 Object.assign(items(base)[0],{startDatum:'2026-10-15',faellig:'2026-10-20',unteraufgaben:[{id:'s',text:'Schritt',erledigt:false}]});
 const next=applyTodoUpdates(base,[{id:'x',bearbeiter:'nico'}]);
 assert.deepEqual(diffTodos(base,next).changes.x.fields,{bearbeiter:'nico'});
 const planned=applyTodoUpdates(base,[{id:'x',startDatum:'2026-10-16'}]);
 const stored=diffTodos(base,planned);
 assert.equal(stored.changes.x.fields.faellig,'2026-10-20');
 const deployed=structuredClone(base);items(deployed)[0].faellig='2026-10-10';
 const merged=items(mergeTodos(deployed,stored))[0];
 assert.equal(merged.startDatum,'2026-10-16');
 assert.equal(merged.faellig,'2026-10-20');
});

test('simultaneous checklist edits retain revision conflict protection',async(t)=>{
 const d=await db(t),base=file(),initial=await readStoredTodos(d,base);
 const next=await save(d,base,initial.revision,[{id:'x',unteraufgaben:[{id:'s',text:'Pruefen',erledigt:true}]}]);
 await assert.rejects(save(d,base,initial.revision,[{id:'x',unteraufgaben:[{id:'other',text:'Parallel',erledigt:false}]}]),error=>error.status===409);
 assert.deepEqual(await readStoredTodos(d,base),next);
});

test('legacy tasks normalize to backlog or done with no guessed assignee',()=>{
 const normalized=normalizeTodos(file());
 assert.equal(items(normalized)[0].status,'backlog');
 assert.equal(items(normalized)[1].status,'done');
 assert.equal(items(normalized)[0].bearbeiter,null);
 assert.equal(items(normalized)[1].erledigtAm,'2026-09-30');
 assert.equal(items(normalized)[0].prio,2);
 assert.equal(items(normalized)[1].prio,2);
 assert.equal(items(normalized)[0].abschluss,null);
 assert.equal(items(normalized)[1].abschluss,'done');
});

test('all legacy missing, null and invalid priorities normalize to medium',()=>{
 const source=file();
 source.kategorien[0].items=[undefined,null,0,4,'1',1,2,3].map((prio,index)=>({id:String(index),text:'Aufgabe',erledigt:false,faellig:null,erledigtAm:null,...prio===undefined?{}:{prio}}));
 assert.deepEqual(items(normalizeTodos(source)).map(item=>item.prio),[2,2,2,2,2,1,2,3]);
 assert.equal(Object.hasOwn(items(source)[0],'prio'),false,'normalization leaves the input untouched');
});

test('the server persists only changed fields and returns an opaque revision',async(t)=>{
 const d=await db(t),initial=await readStoredTodos(d,file());
 assert.deepEqual(withoutRevision(initial),normalizeTodos(file()));
 assert.match(initial.revision,/^[a-f0-9]{64}$/);
 const next=await save(d,file(),initial.revision,[{id:'x',status:'doing',bearbeiter:'nico',wartetAuf:'Rückmeldung',reihenfolge:12.5}]);
 assert.notEqual(next.revision,initial.revision);
 assert.deepEqual(await readStoredTodos(d,file()),next);
 const stored=await readChanges(d);
 assert.equal(stored.format,2);
 assert.deepEqual(Object.keys(stored.changes),['x']);
 assert.deepEqual(stored.changes.x.fields,{status:'doing',bearbeiter:'nico',wartetAuf:'Rückmeldung',reihenfolge:12.5});
 await save(d,file(),next.revision,[{id:'x',status:'backlog',bearbeiter:null,wartetAuf:null,reihenfolge:0}]);
 assert.deepEqual(Object.keys((await readChanges(d)).changes),[]);
});

test('completion and legacy completion edits reconcile status and completion dates',()=>{
 let next=applyTodoUpdates(file(),[{id:'x',status:'done'}],'2026-10-11');
 assert.equal(items(next)[0].erledigt,true);
 assert.equal(items(next)[0].erledigtAm,'2026-10-11');
 assert.equal(items(next)[0].abschluss,'done');
 next=applyTodoUpdates(next,[{id:'x',status:'review'}],'2026-10-12');
 assert.equal(items(next)[0].erledigt,false);
 assert.equal(items(next)[0].erledigtAm,null);
 assert.equal(items(next)[0].abschluss,null);
 next=applyTodoUpdates(next,[{id:'x',erledigt:true}],'2026-10-12');
 assert.equal(items(next)[0].status,'done');
 next=applyTodoUpdates(next,[{id:'x',status:'done',erledigt:true,erledigtAm:'2026-10-05'}],'2026-10-12');
 assert.equal(items(next)[0].erledigtAm,'2026-10-05','undo can restore the previous completion date');
});

test('partial edits preserve unrelated fields and clearing optional fields survives storage',async(t)=>{
 const base=file();Object.assign(items(base)[0],{hinweis:'Alte Notiz',prio:2,art:'code',faellig:'2026-10-22'});
 const d=await db(t),initial=await readStoredTodos(d,base);
 const next=await save(d,base,initial.revision,[{id:'x',bearbeiter:'max',hinweis:null,prio:3,art:null}]);
 const task=items(next)[0];
 assert.equal(task.faellig,'2026-10-22');
 assert.equal(task.bearbeiter,'max');
 assert.equal(task.prio,3);
 for(const key of ['hinweis','art'])assert.equal(Object.hasOwn(task,key),false);
 assert.deepEqual(await readStoredTodos(d,base),next);
});

for(const abschluss of ['done','wont_do','duplicate'])test(`closing with ${abschluss} persists its reason, date and priority`,async(t)=>{
 const d=await db(t),initial=await readStoredTodos(d,file());
 const next=await save(d,file(),initial.revision,[{id:'x',abschluss,prio:1}]);
 assert.equal(items(next)[0].status,'done');
 assert.equal(items(next)[0].erledigt,true);
 assert.equal(items(next)[0].abschluss,abschluss);
 assert.equal(items(next)[0].erledigtAm,'2026-10-11');
 assert.equal(items(next)[0].prio,1);
 assert.deepEqual(await readStoredTodos(d,file()),next);
 assert.equal((await readChanges(d)).changes.x.fields.abschluss,abschluss);
});

test('changing only the resolution preserves the original date and permits explicit undo dates',()=>{
 let next=applyTodoUpdates(file(),[{id:'y',abschluss:'wont_do'}],'2026-10-12');
 assert.equal(items(next)[1].erledigtAm,'2026-09-30');
 next=applyTodoUpdates(next,[{id:'y',abschluss:'duplicate'}],'2026-10-13');
 assert.equal(items(next)[1].erledigtAm,'2026-09-30');
 next=applyTodoUpdates(next,[{id:'y',status:'done'}],'2026-10-14');
 assert.equal(items(next)[1].abschluss,'duplicate','a status-only edit retains an existing resolution');
 next=applyTodoUpdates(next,[{id:'y',abschluss:'done',erledigtAm:'2026-10-05'}],'2026-10-15');
 assert.equal(items(next)[1].erledigtAm,'2026-10-05');
});

for(const status of ['backlog','ready','doing','review'])test(`reopening a closed task to ${status} clears reason and date`,()=>{
 const closed=applyTodoUpdates(file(),[{id:'x',abschluss:'duplicate'}],'2026-10-11');
 const reopened=applyTodoUpdates(closed,[{id:'x',status}],'2026-10-12');
 assert.equal(items(reopened)[0].status,status);
 assert.equal(items(reopened)[0].erledigt,false);
 assert.equal(items(reopened)[0].abschluss,null);
 assert.equal(items(reopened)[0].erledigtAm,null);
 const reclosed=applyTodoUpdates(reopened,[{id:'x',status:'done'}],'2026-10-13');
 assert.equal(items(reclosed)[0].abschluss,'done');
 assert.equal(items(reclosed)[0].erledigtAm,'2026-10-13');
});

test('explicitly clearing a closure reopens to backlog',()=>{
 const reopened=applyTodoUpdates(file(),[{id:'y',abschluss:null}],'2026-10-12');
 assert.equal(items(reopened)[1].status,'backlog');
 assert.equal(items(reopened)[1].abschluss,null);
 assert.equal(items(reopened)[1].erledigtAm,null);
});

test('created tasks default to medium and require valid explicit priorities',async(t)=>{
 const d=await db(t),initial=await readStoredTodos(d,file());
 const next=await save(d,file(),initial.revision,[],[{id:'new-medium',kategorieId:'a',text:'Neu'}]);
 assert.equal(items(next).find(item=>item.id==='new-medium').prio,2);
 assert.deepEqual(await readStoredTodos(d,file()),next);
 for(const prio of [null,0,4,'1'])await assert.rejects(save(d,file(),next.revision,[],[{id:'invalid',kategorieId:'a',text:'Neu',prio}]),error=>error.status===400);
 assert.deepEqual(await readStoredTodos(d,file()),next);
});

test('pre-feature stored null priorities upgrade to medium instead of corrupting the stored list',async(t)=>{
 const d=await db(t),base=file();items(base)[0].prio=1;
 const stored={format:2,changes:{x:{fields:{prio:null}}},creates:[{kategorieId:'a',item:{id:'legacy-created',text:'Neu',prio:null,status:'ready',erledigt:false,faellig:null,erledigtAm:null}}]};
 await d.prepare('INSERT INTO system_state(key,value) VALUES(?,?)').bind('admin-todos-v1',JSON.stringify(stored)).run();
 const initial=await readStoredTodos(d,base);
 assert.equal(items(initial)[0].prio,2);
 assert.equal(items(initial).find(item=>item.id==='legacy-created').prio,2);
 const next=await save(d,base,initial.revision,[{id:'x',bearbeiter:'max'}]);
 assert.deepEqual(await readStoredTodos(d,base),next);
 assert.equal((await readChanges(d)).changes.x.fields.prio,2);
});

test('new tasks and category moves survive saves and exports without duplicating IDs',async(t)=>{
 const d=await db(t),initial=await readStoredTodos(d,file());
 const next=await save(d,file(),initial.revision,[{id:'x',kategorieId:'b',status:'ready'}],[{id:'new-1',kategorieId:'a',text:'Neue Aufgabe',prio:1,bearbeiter:'nico',status:'doing',faellig:'2026-12-01'}]);
 assert.deepEqual(next.kategorien[0].items.map(item=>item.id),['y','new-1']);
 assert.deepEqual(next.kategorien[1].items.map(item=>item.id),['x']);
 assert.deepEqual(await readStoredTodos(d,file()),next);
 const exported=mergeTodos(file(),await readChanges(d));
 assert.deepEqual(exported,withoutRevision(next));
 assert.deepEqual(Object.keys(diffTodos(exported,exported).changes),[]);
 assert.equal(diffTodos(exported,exported).creates.length,0);
 const deployed=structuredClone(exported);
 assert.equal(items(mergeTodos(deployed,await readChanges(d))).filter(item=>item.id==='new-1').length,1);
});

test('deploying a pulled new task preserves newer server edits and category moves without duplication',async(t)=>{
 const base=file(),d=await db(t),initial=await readStoredTodos(d,base);
 const created=await save(d,base,initial.revision,[],[{id:'new-pulled',kategorieId:'a',text:'Neue Aufgabe',hinweis:'Alte Notiz',status:'ready'}]);
 const snapshot=mergeTodos(base,await readChanges(d));
 await save(d,base,created.revision,[{id:'new-pulled',text:'Aktualisierte Aufgabe',hinweis:null,status:'doing',bearbeiter:'nico',prio:1,kategorieId:'b'}]);
 const deployed=await readStoredTodos(d,snapshot),task=items(deployed).find(item=>item.id==='new-pulled');
 assert.equal(items(deployed).filter(item=>item.id==='new-pulled').length,1);
 assert.equal(task.text,'Aktualisierte Aufgabe');
 assert.equal(Object.hasOwn(task,'hinweis'),false,'removed optional fields stay removed');
 assert.equal(task.status,'doing');
 assert.equal(task.bearbeiter,'nico');
 assert.equal(task.prio,1);
 assert.equal(deployed.kategorien.find(category=>category.id==='b').items[0].id,'new-pulled');
 await save(d,snapshot,deployed.revision,[{id:'x',bearbeiter:'max'}]);
 assert.equal((await readChanges(d)).creates.length,0,'the next save converts the pulled task to field overrides');
 assert.equal(items(await readStoredTodos(d,snapshot)).find(item=>item.id==='new-pulled').status,'doing');
});

test('deploying a pulled new task preserves a later closure and its date and priority',async(t)=>{
 const base=file(),d=await db(t),initial=await readStoredTodos(d,base);
 const created=await save(d,base,initial.revision,[],[{id:'closed-pulled',kategorieId:'a',text:'Neue Aufgabe',status:'ready'}]);
 const snapshot=mergeTodos(base,await readChanges(d));
 await save(d,base,created.revision,[{id:'closed-pulled',abschluss:'duplicate',bearbeiter:'max',prio:3}]);
 const deployed=await readStoredTodos(d,snapshot),task=items(deployed).find(item=>item.id==='closed-pulled');
 assert.equal(task.status,'done');
 assert.equal(task.abschluss,'duplicate');
 assert.equal(task.erledigt,true);
 assert.equal(task.erledigtAm,'2026-10-11');
 assert.equal(task.bearbeiter,'max');
 assert.equal(task.prio,3);
});

test('deployment changes do not clear board state, assignees or actual date overrides',async(t)=>{
 const d=await db(t),initial=await readStoredTodos(d,file());
 const next=await save(d,file(),initial.revision,[{id:'x',status:'doing',bearbeiter:'nico',faellig:'2026-11-20'}]);
 const deployed=file();Object.assign(items(deployed)[0],{text:'Neue Beschreibung',faellig:'2026-12-01'});
 const after=await readStoredTodos(d,deployed),task=items(after)[0];
 assert.equal(task.text,'Neue Beschreibung');
 assert.equal(task.status,'doing');
 assert.equal(task.bearbeiter,'nico');
 assert.equal(task.faellig,'2026-11-20');
 assert.notEqual(after.revision,next.revision,'a changed deployed base invalidates stale clients');
 const saved=await save(d,deployed,after.revision,[{id:'y',status:'review'}]);
 assert.equal(items(saved)[0].bearbeiter,'nico');
 assert.equal(items(await readStoredTodos(d,deployed))[0].faellig,'2026-11-20');
});

test('old production overrides migrate field by field even after a deployed due date changes',async(t)=>{
 const d=await db(t);
 const legacy={x:{erledigt:true,faellig:null,erledigtAm:'2026-10-11',base:{erledigt:false,faellig:null}}};
 await d.prepare('INSERT INTO system_state(key,value) VALUES(?,?)').bind('admin-todos-v1',JSON.stringify(legacy)).run();
 const deployed=file();items(deployed)[0].faellig='2026-12-01';
 const initial=await readStoredTodos(d,deployed);
 assert.equal(items(initial)[0].status,'done');
 assert.equal(items(initial)[0].abschluss,'done');
 assert.equal(items(initial)[0].erledigtAm,'2026-10-11');
 assert.equal(items(initial)[0].faellig,'2026-12-01','unchanged legacy due date is not an override');
 const next=await save(d,deployed,initial.revision,[{id:'y',bearbeiter:'max'}]);
 assert.equal(items(next)[0].status,'done');
 assert.equal((await readChanges(d)).format,2);
});

test('deployment preserves each non-done closure reason, date and priority together',async(t)=>{
 for(const abschluss of ['wont_do','duplicate']){
  const d=await db(t),base=file(),initial=await readStoredTodos(d,base);
  const saved=await save(d,base,initial.revision,[{id:'y',abschluss,prio:3}]);
  const deployed=file();Object.assign(items(deployed)[1],{status:'doing',erledigt:false,abschluss:null,erledigtAm:null,prio:1,text:'Neuer Quelltext'});
  const current=await readStoredTodos(d,deployed),task=items(current)[1];
  assert.equal(task.status,'done');
  assert.equal(task.erledigt,true);
  assert.equal(task.abschluss,abschluss);
  assert.equal(task.erledigtAm,'2026-09-30');
  assert.equal(task.prio,3);
  assert.equal(task.text,'Neuer Quelltext');
  assert.notEqual(current.revision,saved.revision);
  assert.equal(items(mergeTodos(deployed,await readChanges(d)))[1].abschluss,abschluss);
  const reopened=await save(d,deployed,current.revision,[{id:'y',status:'review'}]);
  const closedBase=file();Object.assign(items(closedBase)[1],{abschluss:'duplicate',status:'done'});
  const afterDeploy=await readStoredTodos(d,closedBase);
  assert.equal(items(afterDeploy)[1].status,'review');
  assert.equal(items(afterDeploy)[1].abschluss,null);
  assert.equal(items(afterDeploy)[1].erledigtAm,null);
  assert.equal(items(reopened)[1].abschluss,null);
 }
});

test('a stale closure cannot overwrite another editor priority or resolution change',async(t)=>{
 const d=await db(t),initial=await readStoredTodos(d,file());
 const saved=await save(d,file(),initial.revision,[{id:'x',abschluss:'duplicate',prio:3}]);
 await assert.rejects(save(d,file(),initial.revision,[{id:'x',abschluss:'done',prio:1}]),error=>error.status===409);
 assert.deepEqual(await readStoredTodos(d,file()),saved);
});

test('stale editor revisions reject writes without losing the other editor change',async(t)=>{
 const d=await db(t),initial=await readStoredTodos(d,file());
 const next=await save(d,file(),initial.revision,[{id:'x',bearbeiter:'max'}]);
 await assert.rejects(save(d,file(),initial.revision,[{id:'y',bearbeiter:'nico'}]),error=>error.status===409);
 assert.deepEqual(await readStoredTodos(d,file()),next);
});

test('legacy done tasks reopened and completed again keep their newer completion date',async(t)=>{
 const d=await db(t);
 const legacy={y:{erledigt:true,faellig:'2026-10-01',erledigtAm:'2026-10-12',base:{erledigt:true,faellig:'2026-10-01'}}};
 await d.prepare('INSERT INTO system_state(key,value) VALUES(?,?)').bind('admin-todos-v1',JSON.stringify(legacy)).run();
 const current=await readStoredTodos(d,file());
 assert.equal(items(current)[1].erledigtAm,'2026-10-12');
 const next=await save(d,file(),current.revision,[{id:'x',bearbeiter:'max'}]);
 assert.equal(items(next)[1].erledigtAm,'2026-10-12');
 assert.equal((await readChanges(d)).changes.y.fields.erledigtAm,'2026-10-12');
});

for(const existing of [false,true])test(`concurrent edits are atomic when the stored row ${existing?'exists':'is initially absent'}`,async(t)=>{
 const d=await db(t);
 if(existing)await updateStoredTodos(d,file(),[{id:'x',status:'ready'}],'2026-10-11');
 const initial=await readStoredTodos(d,file());
 const results=await Promise.allSettled([
  save(d,file(),initial.revision,[{id:'x',bearbeiter:'max'}]),
  save(d,file(),initial.revision,[{id:'y',bearbeiter:'nico'}]),
 ]);
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
 assert.equal(results.find(result=>result.status==='rejected').reason.status,409);
 const final=await readStoredTodos(d,file());
 assert.deepEqual(final,results.find(result=>result.status==='fulfilled').value);
});

test('invalid fields, identifiers, category moves and creates are rejected before writing',async(t)=>{
 const d=await db(t);
 for(const updates of [[{id:'missing',status:'ready'}],[{id:'x',bearbeiter:'someone'}],[{id:'x',status:'unknown'}],[{id:'x',faellig:'2026-02-30'}],[{id:'x',erledigtAm:'2026-02-30'}],[{id:'x',text:' '}],[{id:'x',prio:4}],[{id:'x',prio:null}],[{id:'x',abschluss:'unknown'}],[{id:'x',status:'ready',abschluss:'duplicate'}],[{id:'x',erledigt:false,abschluss:'wont_do'}],[{id:'x',status:'done',abschluss:null}],[{id:'x',erledigt:true,abschluss:null}],[{id:'x',reihenfolge:NaN}],[{id:'x',kategorieId:'missing'}],[{id:'x',status:'done',erledigt:false}],[{id:'x',unknown:true}],[{id:'x',status:'ready'},{id:'x',status:'doing'}]]){
  await assert.rejects(updateStoredTodos(d,file(),updates),error=>error.status===400);
 }
 for(const creates of [[{id:'x',kategorieId:'a',text:'Doppelt'}],[{id:'new',kategorieId:'missing',text:'Neu'}],[{id:'new',kategorieId:'a'}],[{id:'new',kategorieId:'a',text:'Neu'},{id:'new',kategorieId:'a',text:'Noch eins'}]]){
  await assert.rejects(updateStoredTodos(d,file(),[],undefined,{creates}),error=>error.status===400);
 }
 assert.deepEqual(await readChanges(d),{});
});

test('corrupt stored JSON or malformed state never silently clears persisted data',async(t)=>{
 const d=await db(t);
 for(const value of ['{broken','null','[]','{"format":2,"changes":{},"creates":null}','{"x":{}}','{"format":2,"changes":{"x":{"fields":{"bearbeiter":"someone"}}},"creates":[]}']){
  await d.prepare('INSERT OR REPLACE INTO system_state(key,value) VALUES(?,?)').bind('admin-todos-v1',value).run();
  await assert.rejects(readStoredTodos(d,file()),error=>error.status===500);
  await assert.rejects(updateStoredTodos(d,file(),[{id:'x',status:'ready'}]),error=>error.status===500);
  assert.equal((await d.prepare('SELECT value FROM system_state WHERE key=?').bind('admin-todos-v1').first()).value,value);
 }
});
