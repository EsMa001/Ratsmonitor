// Kontodaten, Übernahme aus dem Browser, Datenauskunft und Löschen (konten-konzept.md, Abschnitte 5.4, 5.5, 7, 8).
import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/accounts.mjs';
import {requestLink,enterCode,me} from '../server/accounts/login.mjs';
import {searchesList,searchesWrite,articlesList,articlesWrite,settingsRead,settingsWrite,importData,exportData,deleteAccount,cleanState} from '../server/accounts/account.mjs';
import {LIMITS} from '../shared/plans.mjs';

async function signedIn(h,email,{tier='plus',admin=false}={}){
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
 const n=LIMITS.basic.savedSearches;
 for(let i=1;i<=n;i++)assert.equal((await add('s'+i,'sig'+i)).status,201);
 const over=await add('s'+(n+1),'sig'+(n+1));
 assert.equal(over.status,409);assert.equal(over.body.limit,'savedSearches');
 const list=await h.call(searchesList,{method:'GET'});
 assert.equal(list.body.searches.length,n);
 assert.equal(list.body.searches[0].state.secret,undefined);assert.equal(JSON.stringify(list.body.searches[0].state).includes('@'),false);
 assert.equal((await h.call(searchesWrite,{method:'PATCH',body:{id:'s1',name:'Neu'}})).status,200);
 assert.equal((await h.call(searchesWrite,{method:'DELETE',body:{id:'s1'}})).status,200);
 assert.equal((await h.call(searchesList,{method:'GET'})).body.searches.length,n-1);
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
 const h=setup();await signedIn(h,'a@example.org',{tier:'plus'});
 topic(h,'t1');topic(h,'t2','Haushalt');
 // Plus: 10 Suchen aktiv; von sechs alle aktiv, beim Konto nur die erste (eigener Test unten)
 const six=Array.from({length:6},(_,i)=>({id:'s'+(i+1),name:'S'+(i+1),signature:'sig'+(i+1),state,...(i?{}:{query:'q=a'})}));
 const body={searches:[...six,{id:'bad id!',name:'C',signature:'x',state}],
  articles:[{id:'t1',follow:true},{id:'t2'},{id:'weg'}],settings:{weekly:true,weeklyDay:1,calendar:[{ags:'05558008',name:'Billerbeck',km:0}],calendarAgs:['05558008']}};
 const first=await h.call(importData,{body});
 assert.deepEqual(first.body.searches.added,['s1','s2','s3','s4','s5','s6']);assert.deepEqual(first.body.searches.invalid,['bad id!']);
 assert.deepEqual(first.body.articles.added.sort(),['t1','t2']);assert.deepEqual(first.body.articles.missing,['weg']);
 const again=await h.call(importData,{body:{...body,searches:[{...body.searches[0],id:'other'}]}});
 assert.deepEqual(again.body.searches.existing,['other'],'gleiche Signatur von einem zweiten Gerät');
 const rows=h.accounts.sql.prepare('SELECT id,active FROM saved_searches ORDER BY position').all();
 assert.deepEqual(rows.map(r=>[r.id,r.active]),[['s1',1],['s2',1],['s3',1],['s4',1],['s5',1],['s6',1]]);
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

test('Übernahme: Konto nur im Umfang der Stufe (1 Suche aktiv, 1 Glocke wöchentlich, kein Wochenbericht, 1 Kalendergebiet)',async()=>{
 const h=setup();await signedIn(h,'a@example.org',{tier:'basic'});
 const searches=Array.from({length:3},(_,i)=>({id:'s'+i,name:'S'+i,signature:'sig'+i,state,notify:{mail:true,freq:'instant'}}));
 const calendar=[{ags:'05558008',name:'Billerbeck',km:10},{ags:'05558012',name:'Coesfeld',km:0}];
 await h.call(importData,{body:{searches,settings:{weekly:true,weeklyDay:1,calendar,calendarAgs:['05558008','05558004','05558012']}}});
 const rows=h.accounts.sql.prepare('SELECT id,active,notify_mail,notify_freq FROM saved_searches ORDER BY position').all();
 assert.deepEqual(rows.map(r=>[r.id,r.active,r.notify_mail,r.notify_freq]),[['s0',1,1,'weekly'],['s1',0,0,null],['s2',0,0,null]]);
 const settings=await h.call(settingsRead,{method:'GET'});
 assert.equal(settings.body.weekly,false,'Wochenbericht erst ab Plus');
 assert.deepEqual(settings.body.calendar.map(a=>a.ags),['05558008']);assert.deepEqual(settings.body.calendarAgs,['05558008'],'zu viele Gebiete: nur die Orte selbst');
});
test('Übernahme: Benachrichtigungen nur im Rahmen der Stufe, Obergrenze je Konto (Prüfbefund 8)',async()=>{
 const h=setup();await signedIn(h,'a@example.org',{tier:'plus'});
 const searches=Array.from({length:30},(_,i)=>({id:'s'+i,name:'S'+i,signature:'sig'+i,state,notify:{mail:true}}));
 await h.call(importData,{body:{searches}});
 assert.equal(h.accounts.sql.prepare('SELECT sum(notify_mail) n FROM saved_searches').get().n,LIMITS.plus.savedSearches);
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

test('Glocken und Einstellungen: Rhythmus je Stufe, Wochenbericht ab Plus, täglich nur Pro, Kalendergebiete je Stufe',async()=>{
 const h=setup();const id=await signedIn(h,'a@example.org',{tier:'basic'});
 const freq=()=>h.accounts.sql.prepare('SELECT notify_freq FROM saved_searches WHERE id=?').get('s1').notify_freq;
 assert.equal((await h.call(searchesWrite,{body:{id:'s1',name:'S',signature:'sig1',state,notify:{mail:true,freq:'daily'}}})).status,201);
 assert.equal(freq(),'weekly','Konto: höchstens wöchentlich');
 const weekly=await h.call(settingsWrite,{method:'PUT',body:{weekly:true}});
 assert.equal(weekly.status,409);assert.equal(weekly.body.limit,'weeklyReport');
 const two=[{ags:'05558008',name:'Billerbeck',km:0},{ags:'05558012',name:'Coesfeld',km:0}];
 const tooMany=await h.call(settingsWrite,{method:'PUT',body:{calendar:two,calendarAgs:['05558008','05558012']}});
 assert.equal(tooMany.status,409);assert.equal(tooMany.body.limit,'calendarAreas');
 assert.equal((await h.call(settingsWrite,{method:'PUT',body:{calendar:two.slice(0,1),calendarAgs:['05558008']}})).status,200);
 // Plus: Wochenbericht ja, täglich nein, 5 Gebiete
 h.accounts.sql.prepare("UPDATE plan_grants SET tier='plus' WHERE user_id=?").run(id);
 assert.equal((await h.call(settingsWrite,{method:'PUT',body:{weekly:true,weeklyDay:3}})).status,200);
 const daily=await h.call(settingsWrite,{method:'PUT',body:{weeklyDay:7}});
 assert.equal(daily.status,409);assert.equal(daily.body.limit,'freq');
 assert.equal((await h.call(settingsWrite,{method:'PUT',body:{calendar:two,calendarAgs:['05558008','05558012']}})).status,200);
 // Zurück zum Konto: zwei Gebiete bleiben gespeichert, entfernen geht, hinzufügen nicht
 h.accounts.sql.prepare("UPDATE plan_grants SET tier='basic' WHERE user_id=?").run(id);
 assert.equal((await h.call(settingsWrite,{method:'PUT',body:{calendar:[...two,{ags:'05558016',name:'Dülmen',km:0}]}})).status,409);
 assert.equal((await h.call(settingsWrite,{method:'PUT',body:{calendar:two.slice(1)}})).status,200);
 // Pro: täglich
 h.accounts.sql.prepare("UPDATE plan_grants SET tier='pro' WHERE user_id=?").run(id);
 assert.equal((await h.call(searchesWrite,{method:'PATCH',body:{id:'s1',notify:{mail:true,freq:'instant'}}})).status,200);
 assert.equal(freq(),'daily','Pro: höchstens täglich, „sofort“ gibt es nicht mehr');
 assert.equal((await h.call(settingsWrite,{method:'PUT',body:{weeklyDay:7}})).status,200);
});
