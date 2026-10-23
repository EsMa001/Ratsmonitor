// Sperre, Gastgrenze, Stufen, Kalender-Abo, Pflegejob und Trennung der Kontendatei (konten-konzept.md, 3.2, 6.5, 7, 12).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {setup,SITE} from './helpers/accounts.mjs';
import {requestLink,enterCode} from '../server/accounts/login.mjs';
import {accessDecision} from '../server/accounts/access.mjs';
import {accountsDb,accountsConfig} from '../server/accounts/config.mjs';
import {trimStream,trimResult,guestPageBlocked} from '../server/accounts/guest-search.mjs';
import {calendarFeed,feedAreas,settingsWrite} from '../server/accounts/account.mjs';
import {devLogin,devMails,devTier} from '../server/accounts/dev.mjs';
import {maintain} from '../scripts/accounts/maintenance.mjs';
import {LIMITS,FEATURES,ACCOUNT_DEFAULT_TIER} from '../shared/plans.mjs';
import {TRANSFER_TABLES} from '../shared/database-transfer.mjs';

const root=new URL('../',import.meta.url);
async function signedIn(h,email,{tier,admin=false}={}){
 const id=h.addUser(email,{tier,admin});
 await h.call(requestLink,{body:{email}});
 await h.call(enterCode,{body:{code:h.lastMail(email).code}});
 return id;
}
const req=(path,{cookie='',auth}={})=>new Request('https://plenara.test'+path,{headers:{cookie,...(auth?{authorization:auth}:{})}});

test('Sperre im Einladungsmodus: Seiten leiten um, API 401, Anmeldung, Rechtstexte, /api/me und statische Dateien frei',async()=>{
 const h=setup();
 const env={...h.env,IMPORT_TOKEN:'internal-token-0123456789'};
 const cfg=accountsConfig(env,{dev:false});
 const decide=(path,o)=>accessDecision(req(path,o),env,{cfg});
 assert.deepEqual(await decide('/'),{redirect:'/anmelden?weiter=%2F'});
 assert.deepEqual(await decide('/beschluss/abc.rsc'),{redirect:'/anmelden?weiter=%2Fbeschluss%2Fabc'});
 assert.deepEqual(await decide('/api/search?q=x'),{status:401});
 for(const free of ['/anmelden','/anmelden/bestaetigen','/api/auth/link','/api/me','/impressum','/datenschutz','/agb','/_next/static/x.js','/fonts/a.ttf','/data/de_map.json','/favicon.ico','/api/calendar/feed/abc.ics','/api/internal/outbox','/api/health'])
  assert.deepEqual(await decide(free),{allow:true},free);
 assert.deepEqual(await decide('/api/search',{auth:'Bearer internal-token-0123456789'}),{allow:true});
 assert.deepEqual(await decide('/api/search',{auth:'Bearer falsch-0123456789abc'}),{status:401});
 await signedIn(h,'a@example.org');
 assert.deepEqual(await decide('/',{cookie:'__Host-rm_session='+h.jar.get('__Host-rm_session')}),{allow:true});
 /* Ein Cookie ohne __Host- zählt über https nicht */
 assert.deepEqual(await decide('/',{cookie:'rm_session='+h.jar.get('__Host-rm_session')}),{redirect:'/anmelden?weiter=%2F'});
 /* Offen: alles durch */
 assert.deepEqual(await accessDecision(req('/api/search'),{...env,RM_ACCESS:'open'},{cfg:accountsConfig({...env,RM_ACCESS:'open'},{dev:false})}),{allow:true});
});

test('Keine stille Rückfallebene: in Builds ohne Kontendatei keine Konten, außer mit ACCOUNTS_IN_MAIN_DB=1',()=>{
 const DB={};
 assert.equal(accountsDb({DB},{dev:false}),undefined);
 assert.equal(accountsDb({DB,ACCOUNTS_IN_MAIN_DB:'1'},{dev:false}),DB);
 assert.equal(accountsDb({DB},{dev:true}),DB);
});

test('Gastgrenze: Strom über alle Etappen höchstens 10 Treffer, dann eigenes Ende; Seite 2 gesperrt',async()=>{
 let closed=false;
 async function* source(){
  try{
   yield {known:'yes'};
   yield {articles:Array.from({length:15},(_,i)=>({id:'a'+i}))};
   yield {articles:Array.from({length:15},(_,i)=>({id:'b'+i}))};
   yield {end:true,hasMore:true,revision:'7',pageSize:20};
  }finally{closed=true;}
 }
 const parts=[];for await(const p of trimStream(source()))parts.push(p);
 assert.equal(parts.flatMap(p=>p.articles||[]).length,10);
 assert.deepEqual(parts.at(-1),{end:true,hasMore:true,revision:null,pageSize:10,guestLimit:true});
 assert.equal(closed,true);
 assert.equal(trimResult({articles:Array(20).fill({}),total:99}).articles.length,10);
 assert.equal(guestPageBlocked(new URLSearchParams('page=2')),true);
 assert.equal(guestPageBlocked(new URLSearchParams('q=x')),false);
});

test('Stufen: eine Quelle, gleich dem Frontend und stufen.md; Konto ohne Freischaltung ist „Konto“ (basic)',()=>{
 const doc=fs.readFileSync(new URL('docs/produkt/stufen.md',root),'utf8');
 const row=label=>doc.split('\n').find(l=>l.startsWith('| '+label))?.split('|').slice(2,6).map(s=>s.trim());
 const val=v=>v===Number.POSITIVE_INFINITY?'unbegrenzt':typeof v==='boolean'?(v?'ja':'nein'):String(v);
 const tiers=['guest','basic','pro','enterprise'];
 assert.deepEqual(row('Treffer je Suche'),tiers.map(t=>val(LIMITS[t].maxResults)));
 assert.deepEqual(row('Gemerkte Artikel'),tiers.map(t=>val(LIMITS[t].bookmarks)));
 assert.deepEqual(row('Gespeicherte Suchen'),tiers.map(t=>val(LIMITS[t].savedSearches)));
 assert.deepEqual(row('Kalender'),tiers.map(t=>val(FEATURES[t].calendar)));
 assert.deepEqual(row('plenara.X'),tiers.map(t=>val(FEATURES[t].analytics)));
 assert.deepEqual(row('Filter'),tiers.map(t=>val(LIMITS[t].filters)));
 assert.deepEqual(row('Benachrichtigungen (aktiv)'),tiers.map(t=>val(LIMITS[t].notifications)));
 assert.deepEqual(row('E-Mails sofort'),tiers.map(t=>val(LIMITS[t].instant)));
 assert.ok(tiers.every(t=>!('mcp' in FEATURES[t])),'KI-Assistenten gehören zu keiner Stufe');
 const front=fs.readFileSync(new URL('components/ratsmonitor/lib/tier.ts',root),'utf8');
 for(const t of tiers)assert.ok(front.includes(`${t}: { maxResults: ${LIMITS[t].maxResults===Number.POSITIVE_INFINITY?'INF':LIMITS[t].maxResults}`),t);
 assert.equal(ACCOUNT_DEFAULT_TIER,'basic');
});

test('Kalender-Abo: nur mit Kalender-Stufe, Token widerrufbar, Gebiete aus den Einstellungen',async()=>{
 const h=setup();await signedIn(h,'konto@example.org',{tier:'basic'});
 assert.equal((await h.call(calendarFeed,{body:{}})).status,403);
 h.jar.clear();await signedIn(h,'plus@example.org',{tier:'pro'});
 await h.call(settingsWrite,{method:'PUT',body:{calendarAgs:['05558008','evil']}});
 const r=await h.call(calendarFeed,{body:{}});
 assert.equal(r.status,200);assert.ok(r.body.url.startsWith(SITE+'/api/calendar/feed/'));
 const token=r.body.url.split('/').pop();
 assert.deepEqual(await feedAreas(h.accounts.db,token,{now:h.now()}),['05558008']);
 const second=(await h.call(calendarFeed,{body:{}})).body.url.split('/').pop();
 assert.equal(await feedAreas(h.accounts.db,token,{now:h.now()}),null,'alter Link ungültig');
 assert.ok(await feedAreas(h.accounts.db,second,{now:h.now()}));
 await h.call(calendarFeed,{method:'DELETE',body:{}});
 assert.equal(await feedAreas(h.accounts.db,second,{now:h.now()}),null);
});

test('Dev-Routen antworten außerhalb des Dev-Servers mit 404',async()=>{
 const h=setup();
 for(const handler of [devLogin,devMails,devTier])assert.equal((await h.call(handler,{body:{email:'a@example.org'}})).status,404);
});

test('Pflegejob: Fristen, „Testzugang endet“ einmal, gesperrte Konten nach der Frist gelöscht',async()=>{
 const h=setup();const day=86400000;
 const id=h.addUser('beta@example.org');
 h.accounts.sql.prepare("INSERT INTO plan_grants(user_id,tier,source,starts_at,ends_at) VALUES(?,'pro','beta',?,?)").run(id,new Date(h.now()).toISOString(),new Date(h.now()+10*day).toISOString());
 const blocked=h.addUser('blocked@example.org',{status:'blocked'});
 h.accounts.sql.prepare('UPDATE users SET blocked_at=? WHERE id=?').run(new Date(h.now()-400*day).toISOString(),blocked);
 h.accounts.sql.prepare('INSERT INTO auth_events(at,kind) VALUES(?,?)').run(new Date(h.now()-100*day).toISOString(),'login');
 h.accounts.sql.prepare('INSERT INTO login_requests(email_hmac,at) VALUES(?,?)').run('x',new Date(h.now()-2*day).toISOString());
 const cfg={...h.cfg,db:h.accounts.db};
 const r=await maintain(h.accounts.db,cfg,{now:h.now(),log:()=>{}});
 assert.equal(r.tierNotices,1);assert.equal(r.blockedDeleted,1);assert.equal(r.authEvents,1);assert.equal(r.loginRequests,1);
 assert.ok(h.mails('beta@example.org').some(m=>/Testzugang endet/.test(m.subject)));
 assert.equal((await maintain(h.accounts.db,cfg,{now:h.now(),log:()=>{}})).tierNotices,0,'nur einmal');
 assert.equal(h.accounts.sql.prepare('SELECT count(*) n FROM users WHERE id=?').get(blocked).n,0);
});

test('Trennung: keine Kontotabelle in drizzle/ und im Datenexport; Kontodatei nicht in Export und MCP',()=>{
 const accountTables=['users','sessions','login_tokens','plan_grants','saved_searches','saved_articles','invites','mail_outbox'];
 for(const file of fs.readdirSync(new URL('drizzle/',root)).filter(f=>f.endsWith('.sql'))){
  const sql=fs.readFileSync(new URL('drizzle/'+file,root),'utf8');
  for(const t of accountTables)assert.ok(!new RegExp(`CREATE TABLE\\s+[\`"]?${t}[\`"]?\\s*\\(`,'i').test(sql),`${t} in drizzle/${file}`);
 }
 for(const t of accountTables)assert.ok(!Object.hasOwn(TRANSFER_TABLES,t),t);
 for(const file of ['server/integrations/database-transfer.mjs','server/node/mcp-runtime.mjs','scripts/mcp-customer.mjs','scripts/mcp-internal.mjs'])
  if(fs.existsSync(new URL(file,root)))assert.ok(!fs.readFileSync(new URL(file,root),'utf8').includes('ACCOUNTS_FILE'),file);
 assert.ok(!fs.readFileSync(new URL('deploy/node/ratsmonitor.env.example',root),'utf8').includes('ACCOUNTS_FILE='),'ACCOUNTS_FILE gehört in accounts.env');
});

test('Caddy-Prüfung: öffentliche Site mit Admin-Kennung oder ohne public_site wird abgelehnt; die Schrittfassungen bestehen',async()=>{
 const {checkCaddy}=await import('../scripts/check-caddy.mjs');
 const snippets=fs.readFileSync(new URL('deploy/node/caddy/snippets.caddy',root),'utf8');
 for(const step of ['step0','step2','step3'])assert.deepEqual(checkCaddy(snippets+'\n'+fs.readFileSync(new URL(`deploy/node/caddy/${step}.caddy`,root),'utf8')),[],step);
 /* So sah der Server vor den Konten aus: die sslip-Site setzte über das gemeinsame Snippet die Admin-Kennung */
 const before=fs.readFileSync(new URL('deploy/node/Caddyfile',root),'utf8')+'\n187-7-72-52.sslip.io {\n\tbasicauth {\n\t\tplenara x\n\t}\n\timport ratsmonitor_app\n}\n';
 const problems=checkCaddy(before);
 assert.equal(problems.length,2);assert.match(problems.join(' '),/Admin-Kennung/);
});

test('Übergang: ohne Kontendatei gilt der alte Admin-Weg weiter, mit Kontendatei nur auf ausdrücklichen Wunsch',()=>{
 assert.equal(accountsConfig({DB:{}},{dev:false}).legacyHeader,true);
 assert.equal(accountsConfig({DB:{},ACCOUNTS:{}},{dev:false}).legacyHeader,false);
 assert.equal(accountsConfig({DB:{},ACCOUNTS:{},ADMIN_LEGACY_HEADER:'1'},{dev:false}).legacyHeader,true);
 assert.equal(accountsConfig({DB:{},ADMIN_LEGACY_HEADER:'0'},{dev:false}).legacyHeader,false);
});

test('Admin-Protokoll: ändernde Admin-Aufrufe je Konto, Pfad und Stunde gezählt, nur IDs',async()=>{
 const {auditAdmin}=await import('../server/accounts/access.mjs');
 const h=setup();
 /* Ohne Rolle admin: nichts protokolliert (sonst füllte jede Sitzung die Tabelle) */
 await signedIn(h,'user@example.org',{tier:'pro'});
 const userCookie='__Host-rm_session='+h.jar.get('__Host-rm_session');
 await auditAdmin(new Request('https://plenara.test/api/admin/x',{method:'POST',headers:{cookie:userCookie}}),h.env,{cfg:h.cfg,now:h.now()});
 h.jar.clear();
 const id=await signedIn(h,'admin@example.org',{tier:'pro',admin:true});
 /* Über die öffentliche Adresse ohne zweiten Faktor: abgewiesen, nicht protokolliert */
 const publicCookie='__Host-rm_session='+h.jar.get('__Host-rm_session');
 await auditAdmin(new Request('https://plenara.test/api/admin/x',{method:'POST',headers:{cookie:publicCookie}}),h.env,{cfg:h.cfg,now:h.now()});
 /* Über den Tunnel freigegeben: protokolliert */
 h.jar.clear();
 await h.call(requestLink,{body:{email:'admin@example.org'},proto:'http',host:'127.0.0.1:8080',ip:'198.51.100.5'});
 await h.call(enterCode,{body:{code:h.lastMail('admin@example.org').code},proto:'http',host:'127.0.0.1:8080',ip:'198.51.100.5'});
 const cookie='rm_session='+h.jar.get('rm_session');
 const post=path=>new Request('http://127.0.0.1:8080'+path,{method:'POST',headers:{cookie}});
 for(let i=0;i<3;i++)await auditAdmin(post('/api/admin/refresh'),h.env,{cfg:h.cfg,now:h.now()});
 await auditAdmin(new Request('http://127.0.0.1:8080/api/admin/summary',{headers:{cookie}}),h.env,{cfg:h.cfg,now:h.now()});
 await auditAdmin(post('/api/search'),h.env,{cfg:h.cfg,now:h.now()});
 const rows=h.accounts.sql.prepare('SELECT user_id,path,method,count FROM admin_audit').all();
 assert.deepEqual(rows.map(r=>[r.user_id,r.path,r.method,r.count]),[[id,'/api/admin/refresh','POST',3]]);
 assert.ok(!JSON.stringify(rows).includes('@'));
});
