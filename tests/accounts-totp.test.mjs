// Zweiter Faktor der Administration über die öffentliche Adresse und „Ansehen als Stufe“ (konten-konzept.md 6.4).
import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/accounts.mjs';
import {requestLink,enterCode,me} from '../server/accounts/login.mjs';
import {totpVerify,totpSetup,viewTier} from '../server/accounts/admin-factor.mjs';
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
 assert.equal(state.tier,'basic');assert.equal(state.realTier,'enterprise');assert.equal(state.viewTier,'basic');assert.equal(state.limits.savedSearches,1);
 const s={q:'',text:'',area:'',areaSrc:'',radius:null,thema:'',monat:'',status:''};
 assert.equal((await h.call(searchesWrite,{body:{id:'a',name:'A',signature:'a',state:s}})).status,201);
 assert.equal((await h.call(searchesWrite,{body:{id:'b',name:'B',signature:'b',state:s}})).status,409,'Grenze von Basic gilt auch serverseitig');
 await h.call(viewTier,{body:{tier:'guest'}});
 assert.equal((await h.call(me,{method:'GET'})).body.limits.maxResults,10);
 await h.call(viewTier,{body:{tier:null}});
 assert.equal((await h.call(me,{method:'GET'})).body.tier,'enterprise');
 assert.equal((await h.call(viewTier,{body:{tier:'superadmin'}})).status,400);
 await login(h,'user@example.org');
 assert.equal((await h.call(viewTier,{body:{tier:'enterprise'}})).status,403);
});
