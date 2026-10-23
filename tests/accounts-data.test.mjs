// Kontodaten, Übernahme aus dem Browser, Datenauskunft und Löschen (konten-konzept.md, Abschnitte 5.4, 5.5, 7, 8).
import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/accounts.mjs';
import {requestLink,enterCode,me} from '../server/accounts/login.mjs';
import {searchesList,searchesWrite,articlesList,articlesWrite,settingsRead,importData,exportData,deleteAccount,cleanState} from '../server/accounts/account.mjs';

async function signedIn(h,email,{tier='pro',admin=false}={}){
 const id=h.addUser(email,{tier,admin});
 await h.call(requestLink,{body:{email}});
 await h.call(enterCode,{body:{code:h.lastMail(email).code}});
 return id;
}
function topic(h,id,title='Schulbau in Dülmen',payload={}){
 h.content.sql.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)')
  .run(id,'billerbeck','city','2026-09-20','2026-09-20','consulting',JSON.stringify({title,officialTitle:title,...payload}));
}
const state={q:'schule',text:'schule',area:'',areaSrc:'',radius:null,thema:'',monat:'',status:'',notify:{email:'leak@example.org'},secret:'x'};

test('Suchen: Grenze der Stufe, keine Doppelten, nur Positivliste im gespeicherten Zustand',async()=>{
 const h=setup();await signedIn(h,'a@example.org',{tier:'basic'});
 const add=(id,signature)=>h.call(searchesWrite,{body:{id,name:'Schule',signature,state,query:'q=schule'}});
 for(let i=1;i<=5;i++)assert.equal((await add('s'+i,'sig'+i)).status,201);
 const sixth=await add('s6','sig6');
 assert.equal(sixth.status,409);assert.equal(sixth.body.limit,'savedSearches');
 const list=await h.call(searchesList,{method:'GET'});
 assert.equal(list.body.searches.length,5);
 assert.equal(list.body.searches[0].state.secret,undefined);assert.equal(JSON.stringify(list.body.searches[0].state).includes('@'),false);
 assert.equal((await h.call(searchesWrite,{method:'PATCH',body:{id:'s1',name:'Neu'}})).status,200);
 assert.equal((await h.call(searchesWrite,{method:'DELETE',body:{id:'s1'}})).status,200);
 assert.equal((await h.call(searchesList,{method:'GET'})).body.searches.length,4);
});

test('Ohne Sitzung 401, ohne Herkunft 403',async()=>{
 const h=setup();
 assert.equal((await h.call(searchesList,{method:'GET'})).status,401);
 await signedIn(h,'a@example.org');
 assert.equal((await h.call(searchesWrite,{body:{id:'s1'},origin:'https://evil.example'})).status,403);
});

test('Artikel: Titel und Status vom Server, zusammengeführte Vorgänge aufgelöst',async()=>{
 const h=setup();await signedIn(h,'a@example.org');
 topic(h,'t1');topic(h,'t2','Alt',{identity:{mergedInto:'t1'}});
 const r=await h.call(articlesWrite,{body:{id:'t2',title:'vom Client'}});
 assert.equal(r.status,201);assert.equal(r.body.snapshot.id,'t1');assert.equal(r.body.snapshot.title,'Schulbau in Dülmen');
 assert.equal((await h.call(articlesWrite,{body:{id:'fehlt'}})).status,404);
 const list=await h.call(articlesList,{method:'GET'});
 assert.equal(list.body.articles[0].id,'t1');
});

test('Übernahme: idempotent, zweites Gerät ohne Doppelte, über der Grenze gespeichert aber nicht aktiv',async()=>{
 const h=setup();await signedIn(h,'a@example.org',{tier:'basic'});
 topic(h,'t1');topic(h,'t2','Haushalt');
 // Konto: 5 Suchen aktiv, die sechste wird gespeichert, aber nicht aktiv
 const six=Array.from({length:6},(_,i)=>({id:'s'+(i+1),name:'S'+(i+1),signature:'sig'+(i+1),state,...(i?{}:{query:'q=a'})}));
 const body={searches:[...six,{id:'bad id!',name:'C',signature:'x',state}],
  articles:[{id:'t1',follow:true},{id:'t2'},{id:'weg'}],settings:{weekly:true,weeklyDay:1,calendar:[{ags:'05558008',name:'Billerbeck',km:0}],calendarAgs:['05558008']}};
 const first=await h.call(importData,{body});
 assert.deepEqual(first.body.searches.added,['s1','s2','s3','s4','s5','s6']);assert.deepEqual(first.body.searches.invalid,['bad id!']);
 assert.deepEqual(first.body.articles.added.sort(),['t1','t2']);assert.deepEqual(first.body.articles.missing,['weg']);
 const again=await h.call(importData,{body:{...body,searches:[{...body.searches[0],id:'other'}]}});
 assert.deepEqual(again.body.searches.existing,['other'],'gleiche Signatur von einem zweiten Gerät');
 const rows=h.accounts.sql.prepare('SELECT id,active FROM saved_searches ORDER BY position').all();
 assert.deepEqual(rows.map(r=>[r.id,r.active]),[['s1',1],['s2',1],['s3',1],['s4',1],['s5',1],['s6',0]]);
 const settings=await h.call(settingsRead,{method:'GET'});
 assert.equal(settings.body.weekly,true);assert.deepEqual(settings.body.calendarAgs,['05558008']);
});

test('Datenauskunft: mit frischer Anmeldung sofort, ohne Hashes; danach Hinweismail',async()=>{
 const h=setup();const id=await signedIn(h,'a@example.org');
 const r=await h.call(exportData,{body:{}});
 assert.equal(r.status,200);assert.match(r.headers.get('content-disposition'),/attachment/);
 assert.equal(r.body.konto.id,id);
 const text=JSON.stringify(r.body);
 for(const row of h.accounts.sql.prepare('SELECT id FROM sessions').all())assert.equal(text.includes(row.id),false,'kein Sitzungshash');
 assert.ok(h.mails('a@example.org').some(m=>/heruntergeladen/.test(m.subject)));
 /* Nach mehr als 24 h nur mit Code */
 h.tick(25*3600000);
 const ask=await h.call(exportData,{body:{}});
 assert.equal(ask.body.codeSent,true);
 const code=h.lastMail('a@example.org').code;
 assert.equal((await h.call(exportData,{body:{code}})).status,200);
});

test('Löschen: nur mit Löschcode an die Kontoadresse, danach keine Spur in der Kontendatei',async()=>{
 const h=setup();const id=await signedIn(h,'a@example.org');
 topic(h,'t1');await h.call(articlesWrite,{body:{id:'t1'}});
 await h.call(searchesWrite,{body:{id:'s1',name:'A',signature:'sig',state}});
 const ask=await h.call(deleteAccount,{body:{}});
 assert.equal(ask.body.codeSent,true);
 const {code}=h.lastMail('a@example.org');
 /* Ein Löschcode meldet nicht an */
 assert.equal((await h.call(enterCode,{body:{code}})).status,400);
 const done=await h.call(deleteAccount,{body:{code}});
 assert.equal(done.status,200);assert.equal(done.body.deleted,true);
 assert.equal((await h.call(me,{method:'GET'})).body.user,undefined);
 for(const {name} of h.accounts.sql.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('dev_mail','sqlite_sequence')").all()){
  const rows=h.accounts.sql.prepare(`SELECT * FROM "${name}"`).all();
  const text=JSON.stringify(rows);
  assert.equal(text.includes(id),false,`Konto-ID in ${name}`);assert.equal(text.includes('a@example.org'),false,`Adresse in ${name}`);
 }
 assert.ok(h.mails('a@example.org').some(m=>/gelöscht/.test(m.subject)));
});

test('Ein Anmeldecode löscht nicht; Löschcode von A wirkt nicht bei B',async()=>{
 const h=setup();await signedIn(h,'a@example.org');
 await h.call(deleteAccount,{body:{}});const codeA=h.lastMail('a@example.org').code;
 const jarA=new Map(h.jar);
 h.jar.clear();await signedIn(h,'b@example.org');
 await h.call(deleteAccount,{body:{}});
 assert.equal((await h.call(deleteAccount,{body:{code:codeA}})).status,400);
 h.jar.clear();for(const [k,v] of jarA)h.jar.set(k,v);
 await h.call(requestLink,{body:{email:'a@example.org'}});
 const loginCode=h.lastMail('a@example.org').code;
 assert.equal((await h.call(deleteAccount,{body:{code:loginCode}})).status,400);
});

test('Admins löschen sich nicht selbst',async()=>{
 const h=setup();await signedIn(h,'admin@example.org',{admin:true});
 assert.equal((await h.call(deleteAccount,{body:{}})).status,403);
});

test('cleanState lehnt zu große oder kaputte Suchen ab',()=>{
 assert.throws(()=>cleanState(null));
 /* Zu lange Felder werden verworfen, nicht gespeichert */
 assert.equal(JSON.parse(cleanState({...state,text:'x'.repeat(600)})).text,'');
 assert.equal(JSON.parse(cleanState({...state,more:[{ags:'evil',scope:'only'},{ags:'05558008',scope:'with'}]})).more.length,1);
 assert.equal(JSON.parse(cleanState({...state,radius:{ags:'05558008',km:10,x:1,y:2}})).radius.km,10);
});

test('Übernahme: Benachrichtigungen nur im Rahmen der Stufe, Obergrenze je Konto (Prüfbefund 8)',async()=>{
 const h=setup();await signedIn(h,'a@example.org',{tier:'basic'});
 const searches=Array.from({length:8},(_,i)=>({id:'s'+i,name:'S'+i,signature:'sig'+i,state,notify:{mail:true}}));
 await h.call(importData,{body:{searches}});
 assert.equal(h.accounts.sql.prepare('SELECT sum(notify_mail) n FROM saved_searches').get().n,5);
 const many=Array.from({length:200},(_,i)=>({id:'m'+i,name:'M',signature:'msig'+i,state}));
 await h.call(importData,{body:{searches:many}});await h.call(importData,{body:{searches:many.map(s=>({...s,id:s.id+'b',signature:s.signature+'b'}))}});
 const r=await h.call(importData,{body:{searches:many.map(s=>({...s,id:s.id+'c',signature:s.signature+'c'}))}});
 assert.equal(r.status,409);assert.equal(r.body.limit,'stored');
});

test('Codes für Löschen und Auskunft: höchstens 5 je Stunde und Konto (Prüfbefund 9)',async()=>{
 const h=setup();await signedIn(h,'a@example.org');
 for(let i=0;i<5;i++)assert.equal((await h.call(deleteAccount,{body:{}})).status,200);
 assert.equal((await h.call(deleteAccount,{body:{}})).status,429);
});
