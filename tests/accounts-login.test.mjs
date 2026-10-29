// Anmeldung per Link und Code (requirements/konten-konzept.md, Abschnitte 5.1 bis 5.3 und 11).
import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,SITE} from './helpers/accounts.mjs';
import {requestLink,peek,verify,enterCode,me,logout,sessionsList,sessionsRevoke,normalizeEmail,SENT_TEXT} from '../server/accounts/login.mjs';
import {safeNext} from '../shared/safe-next.mjs';
import {AGB_VERSION} from '../shared/legal-versions.mjs';

const link=(h,email,opts={})=>h.call(requestLink,{body:{email,next:opts.next},...opts});

test('safeNext: nur eigene, bekannte Pfade, geprüft nach der Normalisierung',()=>{
 for(const bad of ['/.//evil.com','/%2e//x','/a/..//x','/\\x','/\t/x','javascript:alert(1)','//x','https://x','/anmelden','/kontoX','x'])assert.equal(safeNext(bad),'/',bad);
 for(const good of ['/','/suche?q=a','/konto/suchen','/admin','/admin?seite=pdf','/beschluss/abc','/thema/x'])assert.equal(safeNext(good),good,good);
});

test('Adressen werden vereinheitlicht, ungültige abgelehnt',()=>{
 assert.equal(normalizeEmail('  Max@Example.ORG '),'max@example.org');
 for(const bad of ['','a','a@b','a b@c.de','<a@b.de>','a@b.de,c@d.de','x'.repeat(65)+'@b.de'])assert.equal(normalizeEmail(bad),null,bad);
});

test('gleiche Antwort für bekannte, unbekannte, gesperrte und eingeladene Adressen; Mail nur, wo es passt',async()=>{
 const h=setup();
 h.addUser('known@example.org');h.addUser('blocked@example.org',{status:'blocked'});h.invite('invited@example.org');
 const answers=[];
 for(const email of ['known@example.org','unknown@example.org','blocked@example.org','invited@example.org']){
  h.jar.clear();
  const r=await link(h,email);
  answers.push([r.status,JSON.stringify(r.body)]);
  assert.ok(r.setCookies.some(c=>c.startsWith('__Host-rm_flow=')&&/HttpOnly/.test(c)&&/Secure/.test(c)&&/SameSite=Strict/.test(c)));
 }
 assert.ok(answers.every(a=>a[0]===202&&a[1]===answers[0][1]));
 assert.equal(JSON.parse(answers[0][1]).message,SENT_TEXT);
 assert.ok(h.lastMail('known@example.org'));
 assert.ok(h.lastMail('invited@example.org'));
 assert.equal(h.lastMail('unknown@example.org'),null);
 assert.equal(h.lastMail('blocked@example.org'),null);
 assert.equal(h.accounts.sql.prepare("SELECT count(*) n FROM login_tokens WHERE email IN ('unknown@example.org','blocked@example.org')").get().n,0);
 /* Nur Hashes gespeichert, Inhalt des Postausgangs nach dem Versand gelöscht */
 const mail=h.lastMail('known@example.org');
 assert.equal(h.accounts.sql.prepare('SELECT count(*) n FROM login_tokens WHERE id=? OR code_hash=?').get(mail.token,mail.code).n,0);
 assert.equal(h.accounts.sql.prepare("SELECT count(*) n FROM mail_outbox WHERE \"to\" IS NOT NULL OR data IS NOT NULL").get().n,0);
 assert.ok(mail.text.includes(`${SITE}/anmelden/bestaetigen#t=`));
});

test('Link: peek verbraucht nichts, verify löst genau einmal ein, Sitzung mit __Host-Cookie',async()=>{
 const h=setup();h.addUser('a@example.org',{tier:'pro'});
 await link(h,'a@example.org',{next:'/konto/suchen'});
 const {token}=h.lastMail('a@example.org');
 const p1=await h.call(peek,{body:{token}}),p2=await h.call(peek,{body:{token}});
 assert.equal(p1.body.valid,true);assert.equal(p2.body.valid,true);assert.equal(p1.body.email,'a@example.org');assert.equal(p1.body.sameBrowser,true);
 const [v1,v2]=await Promise.all([h.call(verify,{body:{token}}),h.call(verify,{body:{token}})]);
 assert.deepEqual([v1.status,v2.status].sort(),[200,400]);
 const ok=v1.status===200?v1:v2;
 assert.equal(ok.body.next,'/konto/suchen');
 assert.ok(ok.setCookies.some(c=>c.startsWith('__Host-rm_session=')&&/HttpOnly/.test(c)&&/Secure/.test(c)&&/SameSite=Lax/.test(c)&&/Path=\//.test(c)));
 const state=await h.call(me,{method:'GET'});
 assert.equal(state.body.user.email,'a@example.org');assert.equal(state.body.tier,'pro');assert.equal(state.body.adminHere,false);
 assert.equal((await h.call(peek,{body:{token}})).body.valid,false);
});

test('Link läuft nach 15 Minuten ab; eine neue Anforderung entwertet die alte',async()=>{
 const h=setup();h.addUser('a@example.org');
 await link(h,'a@example.org');const first=h.lastMail('a@example.org');
 h.tick(60000);
 await link(h,'a@example.org');const second=h.lastMail('a@example.org');
 assert.notEqual(first.token,second.token);
 assert.equal((await h.call(verify,{body:{token:first.token}})).status,400);
 h.tick(15*60000);
 assert.equal((await h.call(verify,{body:{token:second.token}})).status,400);
});

test('Code: nur mit dem Flow-Cookie, höchstens 5 Versuche je Ablauf, Rest wird genannt',async()=>{
 const h=setup();h.addUser('a@example.org');
 await link(h,'a@example.org');const {code}=h.lastMail('a@example.org');
 /* Anderer Browser ohne Flow-Cookie */
 assert.equal((await h.call(enterCode,{body:{code},cookies:new Map()})).status,400);
 const wrong=String((Number(code)+1)%100000000).padStart(8,'0');
 const r1=await h.call(enterCode,{body:{code:wrong}});
 assert.equal(r1.status,400);assert.match(r1.body.error,/noch 4 Versuche/);
 const ok=await h.call(enterCode,{body:{code:code.slice(0,4)+' '+code.slice(4)}});
 assert.equal(ok.status,200);
 assert.equal((await h.call(me,{method:'GET'})).body.user.email,'a@example.org');
 /* Ein neuer Ablauf: nach 5 Fehlversuchen hilft auch der richtige Code nicht mehr */
 h.jar.clear();await link(h,'a@example.org');const second=h.lastMail('a@example.org');
 for(let i=0;i<5;i++)await h.call(enterCode,{body:{code:wrong}});
 assert.equal((await h.call(enterCode,{body:{code:second.code}})).status,400);
});

test('Code: nach 10 Fehlversuchen je Adresse und Tag nur noch der Link, mit Hinweismail; Antwort für alle gleich',async()=>{
 const h=setup();h.addUser('a@example.org');
 const wrongFor=code=>String((Number(code)+1)%100000000).padStart(8,'0');
 let last;
 for(let round=0;round<3;round++){
  h.jar.clear();await link(h,'a@example.org');last=h.lastMail('a@example.org');
  for(let i=0;i<4;i++)await h.call(enterCode,{body:{code:wrongFor(last.code)}});
  h.tick(16*60000);
 }
 h.jar.clear();await link(h,'a@example.org');last=h.lastMail('a@example.org');
 const r=await h.call(enterCode,{body:{code:last.code}});
 assert.equal(r.status,400);assert.match(r.body.error,/nur der Link/);
 assert.ok(h.mails('a@example.org').some(m=>/Code vorübergehend gesperrt/.test(m.subject)));
 assert.equal((await h.call(verify,{body:{token:last.token}})).status,200);
});

test('Registrieren nur mit Einladung (Einladungsmodus), mit Zustimmung; Einladung vergibt die Teststufe',async()=>{
 const h=setup();h.invite('new@example.org',{tier:'pro',until:'2027-01-31T00:00:00.000Z'});
 await link(h,'new@example.org');const {token}=h.lastMail('new@example.org');
 const p=await h.call(peek,{body:{token}});
 assert.equal(p.body.purpose,'signup');assert.equal(p.body.agbVersion,AGB_VERSION);
 const noConsent=await h.call(verify,{body:{token}});
 assert.equal(noConsent.status,400);assert.equal(noConsent.body.needConsent,true);
 assert.equal((await h.call(peek,{body:{token}})).body.valid,true,'ohne Zustimmung nicht verbraucht');
 const ok=await h.call(verify,{body:{token,agb:AGB_VERSION,adult:true,name:'  Neu  Person '}});
 assert.equal(ok.status,200);assert.equal(ok.body.created,true);
 const user=h.accounts.sql.prepare("SELECT * FROM users WHERE email='new@example.org'").get();
 assert.equal(user.name,'Neu Person');
 assert.equal(h.accounts.sql.prepare('SELECT count(*) n FROM consents WHERE user_id=?').get(user.id).n,2);
 assert.equal(h.accounts.sql.prepare("SELECT count(*) n FROM invites").get().n,0);
 const state=await h.call(me,{method:'GET'});
 assert.equal(state.body.tier,'pro');assert.equal(state.body.tierSource,'beta');assert.equal(state.body.tierUntil,'2027-01-31T00:00:00.000Z');
 assert.ok(h.mails('new@example.org').some(m=>/Willkommen/.test(m.subject)));
});

test('Konto ohne freigeschaltete Stufe hat die Rechte von „Konto“ (kostenlos)',async()=>{
 const h=setup({access:'open',openSignup:true});
 await link(h,'free@example.org');const {token}=h.lastMail('free@example.org');
 await h.call(verify,{body:{token,agb:AGB_VERSION,adult:true}});
 const state=await h.call(me,{method:'GET'});
 assert.equal(state.body.tier,'basic');assert.equal(state.body.limits.savedSearches,1);assert.equal(state.body.limits.maxResults,20);assert.deepEqual(state.body.limits.freqs,['weekly']);assert.equal(state.body.user.email,'free@example.org');
});

test('Code mit fehlender Zustimmung wird nicht angerechnet und nicht verbraucht',async()=>{
 const h=setup();h.invite('new@example.org');
 await link(h,'new@example.org');const {code}=h.lastMail('new@example.org');
 const r=await h.call(enterCode,{body:{code}});
 assert.equal(r.status,409);assert.equal(r.body.needConsent,true);
 assert.equal(h.accounts.sql.prepare('SELECT attempts FROM login_flows').get().attempts,0);
 assert.equal((await h.call(enterCode,{body:{code,agb:AGB_VERSION,adult:true}})).status,200);
});

test('Grenzen: 3 Links in 15 Minuten je Adresse und Absender, darüber still keine Mail',async()=>{
 const h=setup();h.addUser('a@example.org');
 for(let i=0;i<5;i++){const r=await link(h,'a@example.org');assert.equal(r.status,202);}
 assert.equal(h.mails('a@example.org').length,3);
});

test('Ein fremder Absender kann die Links einer Person nicht aufbrauchen (Prüfbefund 1)',async()=>{
 const h=setup();h.addUser('victim@example.org');
 for(let i=0;i<12;i++)await link(h,'victim@example.org',{ip:'203.0.113.66'});
 assert.equal(h.accounts.sql.prepare('SELECT count(*) n FROM login_requests').get().n,5,'über der Absendergrenze wird nichts geschrieben');
 h.jar.clear();
 await link(h,'victim@example.org',{ip:'198.51.100.9'});
 const {code}=h.lastMail('victim@example.org');
 assert.equal((await h.call(enterCode,{body:{code},ip:'198.51.100.9'})).status,200);
});

test('Nach 5 Fehlversuchen gilt der Code eines neuen Links im selben Browser (Prüfbefund 2)',async()=>{
 const h=setup();h.addUser('a@example.org');
 await link(h,'a@example.org');const first=h.lastMail('a@example.org');
 const wrong=String((Number(first.code)+1)%100000000).padStart(8,'0');
 for(let i=0;i<5;i++)await h.call(enterCode,{body:{code:wrong}});
 await link(h,'a@example.org');
 assert.equal((await h.call(enterCode,{body:{code:h.lastMail('a@example.org').code}})).status,200);
});

test('Herkunft: fremde Origin 403, kein JSON 415',async()=>{
 const h=setup();
 assert.equal((await link(h,'a@example.org',{origin:'https://evil.example'})).status,403);
 assert.equal((await h.call(requestLink,{body:{email:'a@example.org'},headers:{'content-type':'text/plain'}})).status,415);
 assert.equal((await h.call(requestLink,{body:{email:'a@example.org'},headers:{'sec-fetch-site':'cross-site'}})).status,403);
});

test('Cookies je Protokoll: über https nur __Host-, im Tunnel rm_session ohne Secure',async()=>{
 const h=setup();h.addUser('a@example.org');
 await link(h,'a@example.org',{proto:'http',host:'127.0.0.1:8080'});
 const {code}=h.lastMail('a@example.org');
 const r=await h.call(enterCode,{body:{code},proto:'http',host:'127.0.0.1:8080'});
 assert.ok(r.setCookies.some(c=>c.startsWith('rm_session=')&&!/Secure/.test(c)));
 /* Ein Cookie ohne __Host- zählt über https nicht */
 const value=h.jar.get('rm_session');
 assert.equal((await h.call(me,{method:'GET',cookies:new Map([['rm_session',value]])})).body.user,undefined);
 assert.equal((await h.call(me,{method:'GET',proto:'http',host:'127.0.0.1:8080',cookies:new Map([['rm_session',value]])})).body.user.email,'a@example.org');
});

test('Admin nur mit Rolle, über einen Admin-Host und mit Anmeldung jünger als 7 Tage',async()=>{
 const h=setup();h.addUser('admin@example.org',{admin:true});h.addUser('user@example.org');
 const login=async(email,proto,host)=>{h.jar.clear();await link(h,email,{proto,host});const {code}=h.lastMail(email);await h.call(enterCode,{body:{code},proto,host});};
 await login('admin@example.org','http','127.0.0.1:8080');
 assert.equal((await h.call(me,{method:'GET',proto:'http',host:'127.0.0.1:8080'})).body.adminHere,true);
 const adminCookie=h.jar.get('rm_session');
 h.tick(8*86400000);
 assert.equal((await h.call(me,{method:'GET',proto:'http',host:'127.0.0.1:8080',cookies:new Map([['rm_session',adminCookie]])})).body.user,undefined,'Admin-Sitzung höchstens 7 Tage');
 await login('admin@example.org','https','plenara.test');
 assert.equal((await h.call(me,{method:'GET'})).body.adminHere,false,'öffentliche Adresse');
 await login('user@example.org','http','127.0.0.1:8080');
 assert.equal((await h.call(me,{method:'GET',proto:'http',host:'127.0.0.1:8080'})).body.adminHere,false,'ohne Rolle');
});

test('Abmelden, Geräte und „überall abmelden“ wirken sofort',async()=>{
 const h=setup();h.addUser('a@example.org');
 const login=async()=>{h.jar.clear();await link(h,'a@example.org');const {code}=h.lastMail('a@example.org');await h.call(enterCode,{body:{code}});return h.jar.get('__Host-rm_session');};
 const first=await login();h.tick(1000);const second=await login();
 const list=await h.call(sessionsList,{method:'GET'});
 assert.equal(list.body.sessions.length,2);assert.equal(list.body.sessions.filter(s=>s.current).length,1);
 await h.call(sessionsRevoke,{body:{revoke:'others'}});
 assert.equal((await h.call(me,{method:'GET',cookies:new Map([['__Host-rm_session',first]])})).body.user,undefined);
 assert.equal((await h.call(me,{method:'GET'})).body.user.email,'a@example.org');
 await h.call(logout,{});
 assert.equal((await h.call(me,{method:'GET',cookies:new Map([['__Host-rm_session',second]])})).body.user,undefined);
});

test('Sperre beendet den Zugang sofort',async()=>{
 const h=setup();const id=h.addUser('a@example.org');
 await link(h,'a@example.org');const {code}=h.lastMail('a@example.org');await h.call(enterCode,{body:{code}});
 h.accounts.sql.prepare("UPDATE users SET status='blocked' WHERE id=?").run(id);
 assert.equal((await h.call(me,{method:'GET'})).body.user,undefined);
});

test('Neue Links setzen die Tagesgrenze der Codeversuche nicht zurück',async()=>{
 const h=setup();h.addUser('a@example.org');
 const wrongFor=code=>String((Number(code)+1)%100000000).padStart(8,'0');
 for(let round=0;round<3;round++){
  await link(h,'a@example.org');
  const {code}=h.lastMail('a@example.org');
  for(let i=0;i<4;i++)await h.call(enterCode,{body:{code:wrongFor(code)}});
 }
 h.tick(16*60000);
 await link(h,'a@example.org');
 assert.equal((await h.call(enterCode,{body:{code:h.lastMail('a@example.org').code}})).status,400,'nach 12 Fehlversuchen nur noch der Link');
});

test('Registrierung prüft die Einladung beim Einlösen erneut (Prüfbefund 18)',async()=>{
 const h=setup();h.invite('new@example.org');
 await link(h,'new@example.org');const {token}=h.lastMail('new@example.org');
 h.accounts.sql.prepare('DELETE FROM invites').run();
 assert.equal((await h.call(verify,{body:{token,agb:AGB_VERSION,adult:true}})).status,400);
 assert.equal(h.accounts.sql.prepare('SELECT count(*) n FROM users').get().n,0);
});

test('Anfragekörper: zu groß wird abgewiesen, auch ohne Content-Length (Prüfbefund 10)',async()=>{
 const {readJson}=await import('../server/accounts/http.mjs');
 const big='{"x":"'+'a'.repeat(5000)+'"}';
 const chunked=new Request('https://plenara.test/x',{method:'POST',body:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(big));c.close();}}),duplex:'half'});
 await assert.rejects(readJson(chunked,2048),e=>e.status===413);
 await assert.rejects(readJson(new Request('https://plenara.test/x',{method:'POST',body:big}),2048),e=>e.status===413);
 assert.deepEqual(await readJson(new Request('https://plenara.test/x',{method:'POST',body:'{"a":1}'}),2048),{a:1});
});

test('Test-Postfach (Klartext) nur im Dev-Server oder ausdrücklich für Tests (Prüfbefund 16)',async()=>{
 const {accountsConfig}=await import('../server/accounts/config.mjs');
 assert.equal(accountsConfig({MAIL_TRANSPORT:'outbox'},{dev:false}).mail.transport,'log');
 assert.equal(accountsConfig({MAIL_TRANSPORT:'outbox',ACCOUNTS_TEST_OUTBOX:'1'},{dev:false}).mail.transport,'outbox');
 assert.equal(accountsConfig({},{dev:true}).mail.transport,'outbox');
});
