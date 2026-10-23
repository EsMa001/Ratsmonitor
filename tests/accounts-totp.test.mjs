// Zweiter Faktor der Administration über die öffentliche Adresse und „Ansehen als Stufe“ (konten-konzept.md 6.4).
import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/accounts.mjs';
import {requestLink,enterCode,me} from '../server/accounts/login.mjs';
import {totpVerify,totpSetup,viewTier,totpLogin} from '../server/accounts/admin-factor.mjs';
import {searchesWrite} from '../server/accounts/account.mjs';
import {hotp,base32Decode,stepOf,matchStep} from '../server/accounts/totp.mjs';

const TUNNEL={proto:'http',host:'127.0.0.1:8080'};
let seq=0;
async function login(h,email,where={}){
 h.jar.clear();
 // Jede Anmeldung von einem anderen Absender: die Grenze von 3 Links je 15 Minuten gilt je Adresse und Absender
 const ip='198.51.100.'+(++seq);
 await h.call(requestLink,{body:{email},ip,...where});
 await h.call(enterCode,{body:{code:h.lastMail(email).code},ip,...where});
}
const codeAt=(secret,now,offset=0)=>hotp(base32Decode(secret),stepOf(now)+offset);

test('RFC 6238: Testwerte, Abweichung um einen Schritt, jeder Schritt nur einmal',async()=>{
 const key=new TextEncoder().encode('12345678901234567890');
 assert.equal(await hotp(key,1),'287082');
 assert.equal(await hotp(key,0x23523EC),'081804');
 const now=59000;
 assert.equal(await matchStep(key,'287082',{now,lastStep:0}),1);
 assert.equal(await matchStep(key,'287082',{now,lastStep:1}),null,'schon benutzt');
 assert.equal(await matchStep(key,'287082',{now:now+20000,lastStep:0}),1,'ein Schritt Abweichung');
 assert.equal(await matchStep(key,'287082',{now:now+95000,lastStep:0}),null,'zu alt');
 assert.equal(await matchStep(key,'28708',{now,lastStep:0}),null);
});

test('Admin über die öffentliche Adresse erst mit eingerichtetem und eingegebenem zweiten Faktor',async()=>{
 const h=setup();h.addUser('max@example.org',{tier:'enterprise',admin:true});
 await login(h,'max@example.org');
 let state=(await h.call(me,{method:'GET'})).body;
 assert.equal(state.admin,'setup');assert.equal(state.adminHere,false);
 /* Einrichten nicht über die öffentliche Adresse */
 assert.equal((await h.call(totpSetup,{body:{}})).status,403);
 /* Über den Tunnel einrichten */
 await login(h,'max@example.org',TUNNEL);
 assert.equal((await h.call(me,{method:'GET',...TUNNEL})).body.adminHere,true,'Tunnel ohne Code');
 const started=await h.call(totpSetup,{body:{},...TUNNEL});
 assert.equal(started.status,200);assert.match(started.body.uri,/^otpauth:\/\/totp\/Plenara:/);
 const secret=started.body.secret.replace(/\s/g,'');
 assert.equal(h.accounts.sql.prepare('SELECT secret FROM user_totp').get().secret.includes(secret),false,'verschlüsselt gespeichert');
 assert.equal((await h.call(totpSetup,{body:{code:'000000'},...TUNNEL})).status,400);
 assert.equal((await h.call(totpSetup,{body:{code:await codeAt(secret,h.now())},...TUNNEL})).status,200);
 assert.equal((await h.call(totpSetup,{body:{},...TUNNEL})).status,409,'zweites Einrichten nur nach Zurücksetzen');
 /* Öffentliche Adresse: Code verlangt, dann 12 Stunden Admin */
 await login(h,'max@example.org');
 assert.equal((await h.call(me,{method:'GET'})).body.admin,'totp');
 h.tick(31000);
 const code=await codeAt(secret,h.now());
 assert.equal((await h.call(totpVerify,{body:{code}})).status,200);
 state=(await h.call(me,{method:'GET'})).body;
 assert.equal(state.admin,'ok');assert.equal(state.adminHere,true);
 /* Derselbe Code nicht noch einmal (andere Sitzung) */
 const first=new Map(h.jar);
 await login(h,'max@example.org');
 assert.equal((await h.call(totpVerify,{body:{code}})).status,400);
 /* Nach 12 Stunden erneut */
 h.jar.clear();for(const [k,v] of first)h.jar.set(k,v);
 h.tick(12*3600000+1000);
 assert.equal((await h.call(me,{method:'GET'})).body.admin,'totp');
});

test('Code-Eingabe: höchstens 5 Versuche in 15 Minuten; ohne Admin-Rolle gar nicht',async()=>{
 const h=setup();h.addUser('max@example.org',{tier:'enterprise',admin:true});h.addUser('user@example.org',{tier:'pro'});
 await login(h,'max@example.org',TUNNEL);
 const secret=(await h.call(totpSetup,{body:{},...TUNNEL})).body.secret.replace(/\s/g,'');
 await h.call(totpSetup,{body:{code:await codeAt(secret,h.now())},...TUNNEL});
 await login(h,'max@example.org');
 for(let i=0;i<5;i++)assert.equal((await h.call(totpVerify,{body:{code:'111111'}})).status,400);
 assert.equal((await h.call(totpVerify,{body:{code:'111111'}})).status,429);
 await login(h,'user@example.org',TUNNEL);
 assert.equal((await h.call(totpSetup,{body:{},...TUNNEL})).status,403);
 assert.equal((await h.call(me,{method:'GET',...TUNNEL})).body.admin,undefined,'Nutzer sehen nichts von der Administration');
});

test('Ansehen als Stufe: Admin sieht und bekommt die Rechte der gewählten Stufe, andere dürfen nicht umschalten',async()=>{
 const h=setup();h.addUser('max@example.org',{tier:'enterprise',admin:true});h.addUser('user@example.org',{tier:'basic'});
 await login(h,'max@example.org');
 assert.equal((await h.call(viewTier,{body:{tier:'basic'}})).status,200);
 const state=(await h.call(me,{method:'GET'})).body;
 assert.equal(state.tier,'basic');assert.equal(state.realTier,'enterprise');assert.equal(state.viewTier,'basic');assert.equal(state.limits.savedSearches,5);
 const s={q:'',text:'',area:'',areaSrc:'',radius:null,thema:'',monat:'',status:''};
 for(const id of ['a','b','c','d','e'])assert.equal((await h.call(searchesWrite,{body:{id,name:id,signature:id,state:s}})).status,201);
 assert.equal((await h.call(searchesWrite,{body:{id:'f',name:'F',signature:'f',state:s}})).status,409,'Grenze von Konto gilt auch serverseitig');
 await h.call(viewTier,{body:{tier:'guest'}});
 assert.equal((await h.call(me,{method:'GET'})).body.limits.maxResults,10);
 await h.call(viewTier,{body:{tier:null}});
 assert.equal((await h.call(me,{method:'GET'})).body.tier,'enterprise');
 assert.equal((await h.call(viewTier,{body:{tier:'superadmin'}})).status,400);
 await login(h,'user@example.org');
 assert.equal((await h.call(viewTier,{body:{tier:'enterprise'}})).status,403);
});

test('Ohne zweiten Faktor (öffentliche Adresse) kein Ansehen als höhere Stufe; Sperre nach 20 Fehlversuchen am Tag',async()=>{
 const h=setup();const id=h.addUser('max@example.org',{tier:'basic',admin:true});
 await login(h,'max@example.org',TUNNEL);
 const secret=(await h.call(totpSetup,{body:{},...TUNNEL})).body.secret.replace(/\s/g,'');
 await h.call(totpSetup,{body:{code:await codeAt(secret,h.now())},...TUNNEL});
 await login(h,'max@example.org');
 assert.equal((await h.call(viewTier,{body:{tier:'enterprise'}})).status,403);
 assert.equal((await h.call(viewTier,{body:{tier:'guest'}})).status,200,'niedrigere Stufe geht');
 h.accounts.sql.prepare('UPDATE sessions SET view_tier=? WHERE user_id=?').run('enterprise',id);
 assert.equal((await h.call(me,{method:'GET'})).body.tier,'basic','höhere Ansicht ohne Freigabe wirkt nicht');
 for(let i=0;i<20;i++)h.accounts.sql.prepare("INSERT INTO auth_events(at,user_id,kind) VALUES(?,?,'totp_failed')").run(new Date(h.now()).toISOString(),id);
 const r=await h.call(totpVerify,{body:{code:await codeAt(secret,h.now(),1)}});
 assert.equal(r.status,429);assert.match(r.body.error,/bis morgen/);
});

/** Admin mit eingerichtetem zweiten Faktor (über den Tunnel), danach ohne Sitzung; liefert den Schlüssel */
async function adminWithApp(h,email){
 await login(h,email,TUNNEL);
 const secret=(await h.call(totpSetup,{body:{},...TUNNEL})).body.secret.replace(/\s/g,'');
 await h.call(totpSetup,{body:{code:await codeAt(secret,h.now())},...TUNNEL});
 h.jar.clear();h.tick(31000);
 return secret;
}
/** Ein Code, der in keinem der drei gültigen Schritte passt */
async function wrongCode(secret,now){
 const valid=await Promise.all([-1,0,1].map(o=>codeAt(secret,now,o)));
 return ['000000','111111','222222','333333'].find(c=>!valid.includes(c));
}

test('Anmelden mit E-Mail-Adresse und App-Code (LOGIN_TOTP=1): ohne Mail, Administration gleich frei, gleiche Antwort für Unbekannte',async()=>{
 const h=setup({extraEnv:{LOGIN_TOTP:'1'}});h.addUser('max@example.org',{tier:'enterprise',admin:true});h.addUser('user@example.org',{tier:'pro'});
 const secret=await adminWithApp(h,'max@example.org');
 assert.deepEqual((await h.call(me,{method:'GET'})).body.login,{mail:true,totp:true});
 const before=h.mails('max@example.org').length;
 const ip='198.51.100.200';
 const answers=[
  await h.call(totpLogin,{body:{email:'nobody@example.org',code:'123456'},ip}),
  await h.call(totpLogin,{body:{email:'user@example.org',code:'123456'},ip}),
  await h.call(totpLogin,{body:{email:'max@example.org',code:await wrongCode(secret,h.now())},ip}),
 ];
 for(const r of answers){assert.equal(r.status,400);assert.equal(r.body.error,'E-Mail-Adresse oder Code stimmt nicht.');}
 assert.equal(h.jar.size,0,'kein Cookie bei Fehlern');
 const good=await codeAt(secret,h.now());
 const ok=await h.call(totpLogin,{body:{email:' Max@Example.org',code:good.slice(0,3)+' '+good.slice(3),next:'/konto/profil'},ip:'198.51.100.201'});
 assert.equal(ok.status,200);assert.equal(ok.body.next,'/konto/profil');
 const state=(await h.call(me,{method:'GET'})).body;
 assert.equal(state.user.email,'max@example.org');assert.equal(state.tier,'enterprise');
 assert.equal(state.admin,'ok','zweiter Faktor mit der Anmeldung geprüft');assert.equal(state.adminHere,true);
 assert.equal(h.mails('max@example.org').length,before,'keine Mail');
 /* Derselbe Code nicht noch einmal, auch nicht in der Sitzung */
 h.jar.clear();
 assert.equal((await h.call(totpLogin,{body:{email:'max@example.org',code:good},ip:'198.51.100.202'})).status,400);
 /* Nach 12 Stunden fragt die Administration in der Sitzung wieder nach dem Code */
 await h.call(totpLogin,{body:{email:'max@example.org',code:await codeAt(secret,h.now(),1)},ip:'198.51.100.203'});
 h.tick(12*3600000+1000);
 assert.equal((await h.call(me,{method:'GET'})).body.admin,'totp');
});

test('Anmelden mit App-Code: Grenzen je Adresse (auch unbekannte), je Absender und Tagessperre des Kontos',async()=>{
 const h=setup({extraEnv:{LOGIN_TOTP:'1'}});const id=h.addUser('max@example.org',{tier:'enterprise',admin:true});
 const secret=await adminWithApp(h,'max@example.org');
 for(let i=0;i<5;i++)assert.equal((await h.call(totpLogin,{body:{email:'ghost@example.org',code:'123456'},ip:'198.51.100.'+(10+i)})).status,400);
 assert.equal((await h.call(totpLogin,{body:{email:'ghost@example.org',code:'123456'},ip:'198.51.100.20'})).status,429,'je Adresse 5 in 15 Minuten');
 for(let i=0;i<10;i++)await h.call(totpLogin,{body:{email:`x${i}@example.org`,code:'123456'},ip:'198.51.100.30'});
 assert.equal((await h.call(totpLogin,{body:{email:'max@example.org',code:await codeAt(secret,h.now())},ip:'198.51.100.30'})).status,429,'je Absender 10 in 15 Minuten');
 for(let i=0;i<20;i++)h.accounts.sql.prepare("INSERT INTO auth_events(at,user_id,kind) VALUES(?,?,'totp_failed')").run(new Date(h.now()).toISOString(),id);
 const locked=await h.call(totpLogin,{body:{email:'max@example.org',code:await codeAt(secret,h.now())},ip:'198.51.100.40'});
 assert.equal(locked.status,429,'nach 20 Fehlversuchen am Tag gesperrt, auch mit richtigem Code');
 assert.equal(h.jar.size,0);
});

test('Ohne Mailversand keine Anmeldung per Mail; ohne LOGIN_TOTP keine Anmeldung mit App-Code',async()=>{
 const h=setup({extraEnv:{MAIL_TRANSPORT:'log'}});h.addUser('max@example.org',{tier:'enterprise',admin:true});
 assert.deepEqual((await h.call(me,{method:'GET'})).body.login,{mail:false,totp:false});
 assert.equal((await h.call(requestLink,{body:{email:'max@example.org'}})).status,503);
 assert.equal((await h.call(totpLogin,{body:{email:'max@example.org',code:'123456'}})).status,404);
});
