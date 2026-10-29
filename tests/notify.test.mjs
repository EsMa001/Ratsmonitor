// Benachrichtigungen per E-Mail (requirements/benachrichtigungen-konzept.md): Ereignisse des Imports, Treffer wie die Suche,
// Fälligkeit, Versand als eine Mail je Konto, Verfall, Wochenbericht, Kalender, Abbestellen, Pflegefristen.
import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,SITE} from './helpers/accounts.mjs';
import {requestLink,enterCode} from '../server/accounts/login.mjs';
import {searchesWrite,articlesWrite,settingsWrite,collectUserData} from '../server/accounts/account.mjs';
import {notifyEvent,NOTIFY_INSERT_SQL,NOTIFY_RECENT_MS} from '../server/integrations/notify-events.mjs';
import {collectNotifications,deliverNotifications,dueAt,alertParams,changeNote,unsubscribeRoute,NOTIFY_RETENTION} from '../server/accounts/notify.mjs';
import {processOutbox,sendMail} from '../server/accounts/mail.mjs';
import {render} from '../server/accounts/mail-templates.mjs';
import {buildMessage} from '../server/accounts/smtp.mjs';
import {maintain} from '../scripts/accounts/maintenance.mjs';

const catalog=[{id:'billerbeck',kind:'city',name:'Billerbeck',ags:'05558008'},{id:'coesfeld',kind:'district',name:'Kreis Coesfeld',ags:'05558'},{id:'other',kind:'city',name:'Anderer Ort',ags:'05558012'}];
const iso=ms=>new Date(ms).toISOString();
const DAY=86400000;

async function signedIn(h,email,{tier='pro'}={}){
 const id=h.addUser(email,{tier});
 await h.call(requestLink,{body:{email}});
 await h.call(enterCode,{body:{code:h.lastMail(email).code}});
 return id;
}
/** Bericht in der Inhaltsdatei (die Trigger legen die Suchkarte an) */
function topic(h,id,{title='Erweiterung der Grundschule',region='billerbeck',date='2026-11-05',status='consulting',events=[{date,committee:'Rat',status}]}={}){
 const t={id,title,officialTitle:title,committee:'Rat',eventDate:date,status,events};
 h.content.sql.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,payload=excluded.payload')
  .run(id,region,'city',date,date,status,JSON.stringify(t));
 return t;
}
/** Ereignis wie im Import (notifyEvent), Zeitpunkt jetzt */
function event(h,previous,t,{region='billerbeck'}={}){
 const row=notifyEvent(previous,t,{at:iso(h.now()),hadStock:true,region});
 assert.ok(row,'Ereignis erwartet');
 h.content.sql.prepare(NOTIFY_INSERT_SQL).run(...row);
}
const search=(h,id,{q='schule',query=`q=${q}&area=05558008&scope=only&to=2026-10-14&sort=desc`,notify={mail:true,freq:'instant'},state={}}={})=>
 h.call(searchesWrite,{body:{id,name:`Suche ${q}`,signature:'sig-'+id,state:{q,text:q,...state},query,notify}});
const run=async h=>{
 const collect=await collectNotifications(h.accounts.db,h.content.db,catalog,{now:h.now()});
 const deliver=await deliverNotifications(h.accounts.db,h.cfg,{now:h.now()});
 await processOutbox(h.accounts.db,h.cfg,{site:SITE,now:h.now()});
 return {collect,deliver};
};
const items=h=>h.accounts.sql.prepare('SELECT ref,key,mail_id,dropped,due_at FROM notify_items ORDER BY ref,key').all();

test('Ereignisse: neu, neuer Stand, neue Sitzung; erster Import, Altbestand, alte Nachträge und Zusammengeführte nie',()=>{
 const at='2026-10-14T10:00:00.000Z',opt={at,hadStock:true,region:'r'};
 const t={id:'a',eventDate:'2026-10-20',status:'consulting',events:[{date:'2026-10-20T18:00:00',committee:'Rat'}]};
 assert.equal(notifyEvent(null,t,{...opt,hadStock:false}),null,'erster Import eines Gebiets');
 assert.equal(notifyEvent(null,{...t,eventDate:'2019-03-01'},opt),null,'Altbestand');
 const row=notifyEvent(null,t,opt);
 assert.deepEqual(row.slice(0,7),[at,'a','r','new','2026-10-20','consulting',null]);
 assert.deepEqual(JSON.parse(row[7]).sessions,[{d:'2026-10-20',c:'Rat'}]);
 assert.equal(notifyEvent(t,{...t},opt),null,'unverändert');
 const status=notifyEvent(t,{...t,status:'approved'},opt);
 assert.equal(status[3],'change');assert.equal(status[5],'approved');assert.equal(status[6],'consulting');
 const moved=notifyEvent(t,{...t,events:[...t.events,{date:'2026-11-03',committee:'Bauausschuss'}]},opt);
 assert.deepEqual(JSON.parse(moved[7]).sessions,[{d:'2026-11-03',c:'Bauausschuss'}]);
 assert.equal(notifyEvent(t,{...t,events:[{date:'2024-01-01',committee:'Rat'},...t.events]},opt),null,'nachgetragene alte Sitzung');
 assert.equal(notifyEvent(null,{...t,identity:{mergedInto:'b'}},opt),null);
 assert.ok(NOTIFY_RECENT_MS>=14*DAY);
});

test('Fälligkeit: sofort, 07:00 deutscher Zeit, Wochentag, Winterzeit',()=>{
 const at=Date.parse('2026-10-14T10:00:00Z');// Mittwoch, 12:00 Uhr Sommerzeit
 assert.equal(dueAt('instant',at),at);
 assert.equal(iso(dueAt('daily',at)),'2026-10-15T05:00:00.000Z');
 assert.equal(iso(dueAt('daily',Date.parse('2026-10-14T04:00:00Z'))),'2026-10-14T05:00:00.000Z','vor 7 Uhr: heute');
 assert.equal(iso(dueAt('weekly',at,1)),'2026-10-19T05:00:00.000Z','nächster Montag');
 assert.equal(iso(dueAt('weekly',at,3)),'2026-10-21T05:00:00.000Z','heute schon vorbei: in einer Woche');
 assert.equal(iso(dueAt('daily',Date.parse('2026-10-25T12:00:00Z'))),'2026-10-26T06:00:00.000Z','nach der Umstellung 07:00 Winterzeit');
});

test('Abfrage der Meldung: ohne Seite und „bis heute“, Schnellauswahl entfällt, fester Zeitraum bleibt',()=>{
 const q='q=schule&area=05558008&from=2026-09-01&to=2026-10-14&sort=desc&page=2&size=15&part=stream&revision=7';
 assert.equal(alertParams(q,{}).toString(),'q=schule&area=05558008&from=2026-09-01');
 assert.equal(alertParams(q,{von:'@d30'}).toString(),'q=schule&area=05558008');
 assert.equal(alertParams(q,{von:'2026-09-01',bis:'2026-10-14'}).toString(),'q=schule&area=05558008&from=2026-09-01&to=2026-10-14');
});

test('Suche mit Glocke (Pro): Treffer genau wie die Suche, einmal; täglich und wöchentlich in getrennten Mails, „sofort“ gibt es nicht mehr',async()=>{
 const h=setup();const uid=await signedIn(h,'pro@example.org');
 assert.equal((await search(h,'s1')).status,201);
 assert.equal((await search(h,'s2',{q:'haushalt',notify:{mail:true,freq:'weekly'}})).status,201);
 h.tick(60000);
 event(h,null,topic(h,'t1'));
 event(h,null,topic(h,'t2',{title:'Haushalt 2027'}));
 event(h,null,topic(h,'t3',{title:'Schulweg',region:'other'}),{region:'other'});
 const first=await run(h);
 assert.equal(first.collect.items,2,'Schulweg liegt außerhalb des Gebiets');
 assert.equal(first.deliver.mails,0,'„sofort“ gilt als täglich');
 assert.equal((await run(h)).collect.items,0,'nichts doppelt');
 h.tick(Date.parse('2026-10-15T05:01:00Z')-h.now());
 assert.equal((await run(h)).deliver.mails,1,'am nächsten Morgen um 7 die tägliche');
 const mail=h.lastMail('pro@example.org');
 assert.equal(mail.subject,'Plenara: 1 Neuigkeit zu Ihren Suchen');
 assert.match(mail.text,/Neue Treffer der Suche „Suche schule“/);
 assert.match(mail.text,/Erweiterung der Grundschule\n {2}Billerbeck · Rat · 05\.11\.2026 · In Beratung/,'künftige Sitzung trotz „bis heute“ in der gespeicherten Abfrage');
 assert.match(mail.text,new RegExp(`${SITE}/beschluss/t1`));
 assert.match(mail.text,/abbestellen#t=[A-Za-z0-9_-]{43}/);
 assert.match(mail.text,/Ohne Gewähr/);
 assert.ok(!mail.text.includes('Haushalt'));
 assert.equal((await run(h)).deliver.mails,0);
 // am Montag um 7 Uhr die wöchentliche
 h.tick(Date.parse('2026-10-19T05:01:00Z')-h.now());
 assert.equal((await run(h)).deliver.mails,1);
 assert.match(h.lastMail('pro@example.org').text,/Haushalt 2027/);
 assert.equal(h.mails('pro@example.org').filter(m=>m.subject.startsWith('Plenara:')).length,2);
 assert.ok(items(h).every(i=>i.mail_id),'alle Treffer einer Mail zugeordnet');
 const ids=h.accounts.sql.prepare("SELECT id FROM mail_outbox WHERE template='notify' AND user_id=? ORDER BY id").all(uid).map(r=>r.id);
 assert.deepEqual([...new Set(items(h).map(i=>i.mail_id))].sort(),ids,'mail_id ist die Mail im Postausgang');
});

test('Vor dem Einschalten Gemeldetes zählt nicht; Glocke aus und Stufe ohne Benachrichtigungen verfallen',async()=>{
 const h=setup();await signedIn(h,'pro@example.org');
 event(h,null,topic(h,'old'));
 h.tick(60000);
 await search(h,'s1',{notify:{mail:true,freq:'daily'}});
 assert.equal((await run(h)).collect.items,0,'Ereignis vor dem Einschalten');
 h.tick(60000);
 event(h,null,topic(h,'t1'));
 await run(h);
 assert.equal(items(h).length,1);
 await h.call(searchesWrite,{method:'PATCH',body:{id:'s1',notify:{mail:false,freq:'daily'}}});
 h.tick(DAY);
 const r=await run(h);
 assert.equal(r.deliver.mails,0);assert.equal(r.deliver.dropped,1);
 assert.equal(items(h)[0].dropped,1);
 // Ein Konto ohne Freischaltung hat seit 23.10.2026 die Stufe Konto mit einer Benachrichtigung; eine Stufe ohne gibt es nicht mehr
});

test('Gefolgter Vorgang (Pro): neuer Stand am nächsten Morgen, mit Satz zur Änderung',async()=>{
 const h=setup();await signedIn(h,'pro@example.org');
 const t=topic(h,'t9',{title:'Neubau Feuerwehrhaus',date:'2026-10-10'});
 assert.equal((await h.call(articlesWrite,{body:{id:'t9',follow:true}})).status,201);
 h.tick(60000);
 const next={...t,status:'approved'};topic(h,'t9',{title:'Neubau Feuerwehrhaus',date:'2026-10-10',status:'approved'});
 event(h,t,next);
 assert.equal((await run(h)).deliver.mails,0);
 h.tick(Date.parse('2026-10-15T05:01:00Z')-h.now());
 const r=await run(h);
 assert.equal(r.deliver.mails,1);
 const mail=h.lastMail('pro@example.org');
 assert.equal(mail.subject,'Plenara: 1 Neuigkeit zu Ihren Vorgängen');
 assert.match(mail.text,/Neuer Stand: Beschlossen \(vorher In Beratung\)/);
 assert.equal(changeNote({prev_status:'consulting',status:'consulting',at:'2026-10-14T10:00:00Z',detail:JSON.stringify({sessions:[{d:'2026-11-03',c:'Bauausschuss'}]})}),'Angesetzt am 03.11.2026 im Gremium Bauausschuss');
});

test('Konto (kostenlos): eine Glocke, wöchentlich am Montag; die zweite Glocke ist gesperrt',async()=>{
 const h=setup();await signedIn(h,'konto@example.org',{tier:'basic'});
 const t=topic(h,'t9',{title:'Neubau Feuerwehrhaus',date:'2026-10-10'});
 assert.equal((await h.call(articlesWrite,{body:{id:'t9',follow:true}})).status,201);
 const second=await search(h,'s1');
 assert.equal(second.status,409);assert.equal(second.body.limit,'notifications');
 assert.equal((await search(h,'s1',{notify:{mail:false}})).status,201,'ohne Glocke speichern geht');
 h.tick(60000);
 event(h,null,topic(h,'t1'));
 const next={...t,status:'approved'};topic(h,'t9',{title:'Neubau Feuerwehrhaus',date:'2026-10-10',status:'approved'});
 event(h,t,next);
 const r=await run(h);
 assert.equal(r.collect.items,1,'nur der gefolgte Vorgang, die Suche hat keine Glocke');
 assert.deepEqual(items(h).map(i=>i.due_at),['2026-10-19T05:00:00.000Z'],'wöchentlich: nächster Montag');
 h.tick(Date.parse('2026-10-15T05:01:00Z')-h.now());
 assert.equal((await run(h)).deliver.mails,0,'nicht täglich');
 h.tick(Date.parse('2026-10-19T05:01:00Z')-h.now());
 assert.equal((await run(h)).deliver.mails,1);
});

test('Plus: Wochenbericht über alle Suchen und gefolgten Vorgänge in einer Mail am gewählten Tag, täglich gesperrt',async()=>{
 const h=setup();await signedIn(h,'plus@example.org',{tier:'plus'});
 const t=topic(h,'t9',{title:'Neubau Feuerwehrhaus',date:'2026-10-10'});
 assert.equal((await h.call(articlesWrite,{body:{id:'t9',follow:true}})).status,201);
 await search(h,'s1',{notify:{mail:false}});await search(h,'s2',{q:'haushalt',notify:{mail:true,freq:'daily'}});
 assert.equal((await h.call(settingsWrite,{method:'PUT',body:{weekly:true,weeklyDay:7}})).status,409,'täglich gehört zu Pro');
 assert.equal((await h.call(settingsWrite,{method:'PUT',body:{weekly:true,weeklyDay:3}})).status,200);
 h.tick(60000);
 event(h,null,topic(h,'t1'));event(h,null,topic(h,'t2',{title:'Haushalt 2027'}));
 const next={...t,status:'approved'};topic(h,'t9',{title:'Neubau Feuerwehrhaus',date:'2026-10-10',status:'approved'});
 event(h,t,next);
 await run(h);
 assert.deepEqual([...new Set(items(h).map(i=>i.due_at))],['2026-10-21T05:00:00.000Z'],'alles am Mittwoch');
 assert.equal(items(h).length,3);
 h.tick(Date.parse('2026-10-21T05:01:00Z')-h.now());
 assert.equal((await run(h)).deliver.mails,1,'eine Mail je Woche');
 const text=h.lastMail('plus@example.org').text;
 assert.match(text,/Grundschule/);assert.match(text,/Haushalt 2027/);assert.match(text,/Feuerwehrhaus/);
});

test('Nach einem Wechsel nach unten: nur die ältesten Glocken im Umfang der Stufe, der Rest verfällt',async()=>{
 const h=setup();const uid=await signedIn(h,'pro@example.org');
 await search(h,'s1');h.tick(1000);await search(h,'s2',{q:'haushalt'});
 h.accounts.sql.prepare("UPDATE plan_grants SET tier='basic' WHERE user_id=?").run(uid);
 h.tick(60000);
 event(h,null,topic(h,'t1'));event(h,null,topic(h,'t2',{title:'Haushalt 2027'}));
 await run(h);
 assert.deepEqual(items(h).map(i=>i.ref),['s:s1'],'Konto: eine Glocke, die älteste');
 h.tick(Date.parse('2026-10-19T05:01:00Z')-h.now());
 await run(h);
 assert.ok(!h.lastMail('pro@example.org').text.includes('Haushalt'));
 assert.equal(h.accounts.sql.prepare('SELECT count(*) n FROM saved_searches WHERE notify_mail=1').get().n,2,'gespeichert bleibt alles');
});

test('Wochenbericht: Suchen ohne Glocke täglich um 7; mit Glocke nicht doppelt',async()=>{
 const h=setup();await signedIn(h,'pro@example.org');
 await search(h,'quiet',{notify:{mail:false,freq:'daily'}});
 await search(h,'bell',{q:'haushalt',notify:{mail:true,freq:'weekly'}});
 assert.equal((await h.call(settingsWrite,{method:'PUT',body:{weekly:true,weeklyDay:7}})).status,200);
 h.tick(60000);
 event(h,null,topic(h,'t1'));event(h,null,topic(h,'t2',{title:'Haushalt 2027'}));
 await run(h);
 const byRef=Object.fromEntries(items(h).map(i=>[i.ref,i]));
 assert.equal(byRef['s:quiet'].due_at,'2026-10-15T05:00:00.000Z','Wochenbericht täglich');
 assert.equal(byRef['s:bell'].due_at,'2026-10-19T05:00:00.000Z','eigene Glocke wöchentlich: Montag, weil der Bericht täglich ist');
 h.tick(Date.parse('2026-10-15T05:01:00Z')-h.now());
 assert.equal((await run(h)).deliver.mails,1);
 assert.match(h.lastMail('pro@example.org').text,/Grundschule/);
});

test('Kalender: neue Sitzungen in den Gebieten der Stufe, im Rhythmus der Stufe',async()=>{
 const p=setup();const konto=await signedIn(p,'konto@example.org',{tier:'basic'});
 assert.equal((await p.call(settingsWrite,{method:'PUT',body:{calendarMail:true,calendarFreq:'daily',calendar:[{ags:'05558012',name:'Anderer Ort',km:0}],calendarAgs:['05558012']}})).status,200);
 // Zwei Gebiete aus einer höheren Stufe: das Konto bekommt nur das erste
 p.accounts.sql.prepare('UPDATE user_settings SET calendar=?,calendar_ags=? WHERE user_id=?')
  .run(JSON.stringify([{ags:'05558012',name:'Anderer Ort',km:0},{ags:'05558008',name:'Billerbeck',km:0}]),JSON.stringify(['05558012','05558008']),konto);
 p.tick(60000);
 event(p,null,topic(p,'t1',{date:'2026-11-05'}));event(p,null,topic(p,'t3',{title:'Woanders',region:'other',date:'2026-11-06'}),{region:'other'});
 await run(p);
 assert.deepEqual(items(p).map(i=>[i.key,i.due_at]),[['other|2026-11-06|Rat','2026-10-19T05:00:00.000Z']],'nur das erste Gebiet, wöchentlich');
 const h=setup();await signedIn(h,'ent@example.org',{tier:'enterprise'});
 assert.equal((await h.call(settingsWrite,{method:'PUT',body:{calendarMail:true,calendarFreq:'instant',calendarAgs:['05558008']}})).status,200);
 h.tick(60000);
 event(h,null,topic(h,'t1',{date:'2026-11-05'}));event(h,null,topic(h,'t2',{title:'Haushalt 2027',date:'2026-11-05'}));
 event(h,null,topic(h,'t3',{title:'Woanders',region:'other'}),{region:'other'});
 h.tick(Date.parse('2026-10-15T05:01:00Z')-h.now());
 const r=await run(h);
 assert.equal(r.collect.items,1,'eine Sitzung, zwei Vorgänge');
 const mail=h.lastMail('ent@example.org');
 assert.equal(mail.subject,'Plenara: 1 Neuigkeit in Ihren Kalendergebieten');
 assert.match(mail.text,/Rat am 05\.11\.2026/);assert.match(mail.text,/2 Vorgänge auf der Tagesordnung/);
 assert.ok(!mail.text.includes('Woanders'));
});

test('Mail: Werte maskiert, Kopfzeilen für Ein-Klick-Abbestellen, Betreff ohne Namen der Suche',()=>{
 const m=render('notify',{token:'T'.repeat(43),groups:[{kind:'search',title:'<b>meine</b>',link:SITE+'/konto/suchen',token:'G'.repeat(43),more:2,
  items:[{title:'A & <script>',place:'Ort',gremium:'Rat',date:'2026-11-05',status:'In Beratung',note:'',link:SITE+'/beschluss/x'}]}]},{site:SITE});
 assert.equal(m.subject,'Plenara: 3 Neuigkeiten zu Ihren Suchen');
 assert.ok(!m.subject.includes('meine'));
 assert.ok(m.html.includes('A &amp; &lt;script&gt;')&&!m.html.includes('<script>'));
 assert.ok(m.html.includes('&lt;b&gt;meine&lt;/b&gt;'));
 assert.equal(m.headers['List-Unsubscribe'],`<${SITE}/api/notify/unsubscribe?t=${'T'.repeat(43)}>`);
 assert.equal(m.headers['List-Unsubscribe-Post'],'List-Unsubscribe=One-Click');
 assert.match(m.text,/… und 2 weitere/);
 const raw=buildMessage({from:'Plenara <a@plenara.test>',to:'b@example.org',subject:m.subject,text:m.text,html:m.html,headers:{...m.headers,'Bad\nHeader':'x','X-Evil':'a\r\nBcc: c@d'},id:'1@plenara.test'});
 assert.match(raw,/\r\nList-Unsubscribe-Post: List-Unsubscribe=One-Click\r\n/);
 assert.ok(!raw.includes('Bcc:'),'keine Kopfzeilen mit Zeilenumbruch');
});

test('Abbestellen: ansehen schreibt nichts, Ein-Klick ohne Sitzung und Herkunft, einzeln und alles, falsche Links',async()=>{
 const h=setup();await signedIn(h,'pro@example.org');
 await search(h,'s1');await search(h,'s2',{q:'haushalt'});
 await h.call(settingsWrite,{method:'PUT',body:{weekly:true}});
 h.tick(60000);event(h,null,topic(h,'t1'));event(h,null,topic(h,'t2',{title:'Haushalt 2027'}));
 h.tick(Date.parse('2026-10-15T05:01:00Z')-h.now());
 await run(h);
 const text=h.lastMail('pro@example.org').text;
 const one=text.match(/Diese Suche nicht mehr melden: \S+#t=([A-Za-z0-9_-]{43})/)[1];
 const all=text.match(/Alle Benachrichtigungen abbestellen: \S+#t=([A-Za-z0-9_-]{43})/)[1];
 // Wie ein Mailprogramm (RFC 8058): fremde Herkunft, ohne Cookie, Formular statt JSON
 const call=(t,body)=>h.call(unsubscribeRoute,{path:'/api/notify/unsubscribe'+(t?`?t=${t}`:''),body,origin:'https://mail.example.net',cookies:new Map(),
  headers:body?{}:{'content-type':'application/x-www-form-urlencoded'}});
 const peek=await call(null,{t:one,peek:true});
 assert.equal(peek.status,200);assert.equal(peek.body.kind,'search');assert.match(peek.body.title,/^Suche /);
 const bells=()=>h.accounts.sql.prepare('SELECT id,notify_mail FROM saved_searches ORDER BY id').all().map(r=>`${r.id}:${r.notify_mail}`).join(',');
 assert.equal(bells(),'s1:1,s2:1','ansehen ändert nichts');
 const first=items(h).find(i=>i.ref==='s:s1')?'s1':'s2';
 assert.equal((await call(one)).status,200);
 assert.equal(bells(),first==='s1'?'s1:0,s2:1':'s1:1,s2:0');
 assert.equal((await call(one)).status,200,'zweimal ist harmlos');
 assert.equal((await call(all)).status,200);
 assert.equal(bells(),'s1:0,s2:0');
 assert.ok(items(h).filter(i=>!i.mail_id).every(i=>i.dropped),'offene Treffer verfallen');
 assert.equal(h.accounts.sql.prepare('SELECT weekly FROM user_settings').get().weekly,0);
 assert.equal((await call('x'.repeat(43))).status,404);
 assert.equal((await call('kurz')).status,400);
 assert.equal((await h.call(unsubscribeRoute,{method:'GET',path:'/api/notify/unsubscribe?t='+all})).status,405);
});

test('Postausgang: Kontingent notify, Treffer und Mail in einer Transaktion; Pflegefristen; Datenauskunft',async()=>{
 const h=setup();const uid=await signedIn(h,'pro@example.org');
 const before=h.accounts.sql.prepare('SELECT count(*) n FROM mail_outbox').get().n;
 h.accounts.sql.prepare("INSERT INTO notify_items(user_id,ref,key,event_seq,created_at,due_at,card) VALUES(?,'s:x','k',1,?,?,'{}')").run(uid,iso(h.now()),iso(h.now()));
 const extra=[h.accounts.db.prepare('UPDATE notify_items SET mail_id=last_insert_rowid() WHERE user_id=?').bind(uid),h.accounts.db.prepare('INSERT INTO nichtda VALUES(1)')];
 await assert.rejects(sendMail(h.accounts.db,h.cfg,{to:'pro@example.org',template:'notify',data:{token:'t',groups:[]},userId:uid,quota:'notify',extra,now:h.now()}));
 assert.equal(h.accounts.sql.prepare('SELECT count(*) n FROM mail_outbox').get().n,before,'gescheitert: keine Mail');
 assert.equal(h.accounts.sql.prepare('SELECT mail_id FROM notify_items').get().mail_id,null,'und keine Markierung');
 const ok=await sendMail(h.accounts.db,h.cfg,{to:'pro@example.org',template:'notify',data:{token:'t',groups:[]},userId:uid,quota:'notify',extra:extra.slice(0,1),now:h.now()});
 assert.equal(h.accounts.sql.prepare('SELECT mail_id FROM notify_items').get().mail_id,ok.id);
 assert.equal((await collectUserData(h.accounts.db,uid,'pro@example.org')).benachrichtigungen.length,1);
 h.accounts.sql.prepare("INSERT INTO notify_tokens(id,user_id,ref,created_at) VALUES('h',?,'*',?)").run(uid,iso(h.now()));
 h.tick(NOTIFY_RETENTION.items+DAY);
 const report=await maintain(h.accounts.db,h.cfg,{now:h.now(),log:()=>{}});
 assert.equal(report.notifyItems,1);assert.equal(report.notifyTokens,0);
 h.tick(NOTIFY_RETENTION.tokens);
 assert.equal((await maintain(h.accounts.db,h.cfg,{now:h.now(),log:()=>{}})).notifyTokens,1);
});
