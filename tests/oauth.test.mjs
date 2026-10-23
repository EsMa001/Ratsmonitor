// OAuth des Kunden-MCP (server/accounts/oauth.mjs): Registrierung, Zustimmung nur für freigeschaltete Konten, Code mit
// PKCE, Token an die Adresse des MCP gebunden, rotierende Erneuerung mit Erkennung der Wiederverwendung, Widerruf.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {setup,SITE} from './helpers/accounts.mjs';
import {context,requestLink,enterCode,sessionsRevoke} from '../server/accounts/login.mjs';
import {register,authorize,requestInfo,decide,token,revoke,oauthFailure,validRedirect,connectedApps} from '../server/accounts/oauth.mjs';
import {revokeAllStatements} from '../server/accounts/sessions.mjs';
import {accessDecision} from '../server/accounts/access.mjs';
import {verifyAccessToken} from '../server/mcp/tokens.mjs';
import {safeNext} from '../shared/safe-next.mjs';

const SECRET='mcp-test-secret-0123456789abcdef0123456789';
const REDIRECT='https://claude.ai/api/mcp/auth_callback';
const wrap=fn=>async ctx=>{try{return await fn(ctx);}catch(error){return {response:oauthFailure(error)};}};

function env(t,{accounts=[]}={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rm-oauth-')),file=path.join(dir,'customers.json');
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const write=list=>fs.writeFileSync(file,JSON.stringify({version:1,customers:[{identity:'kunde-a',name:'Kunde A',allowedRegionIds:['billerbeck','coesfeld'],accounts:list}]}));
 write(accounts);
 const h=setup({access:'invite',extraEnv:{MCP_TOKEN_SECRET:SECRET,MCP_CUSTOMERS_FILE:file}});
 return {h,write,file};
}
async function signIn(h,email,{tier='enterprise'}={}){
 const id=h.addUser(email,{tier});
 await h.call(requestLink,{body:{email}});
 await h.call(enterCode,{body:{code:h.lastMail(email).code}});
 return id;
}
/** Anfrage ohne JSON-Auswertung (Weiterleitungen, Textseiten) */
async function raw(h,handler,url,init={}){
 const request=new Request(url.startsWith('http')?url:SITE+url,{headers:{'x-forwarded-for':'203.0.113.7',...(init.headers||{})},...init});
 return (await wrap(handler)(context(request,h.env,{cfg:h.cfg,now:h.now()}))).response;
}
const pkce=()=>{const verifier=randomBytes(32).toString('base64url');return {verifier,challenge:createHash('sha256').update(verifier).digest('base64url')};};

async function client(h,body={client_name:'Claude',redirect_uris:[REDIRECT]}){
 const r=await h.call(wrap(register),{path:'/oauth/register',body});
 assert.equal(r.status,201,JSON.stringify(r.body));
 return r.body;
}
async function consent(h,clientId,challenge,{state='xyz'}={}){
 const r=await raw(h,authorize,`/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(REDIRECT)}&code_challenge=${challenge}&code_challenge_method=S256&state=${state}&resource=${encodeURIComponent(SITE+'/mcp')}`);
 assert.equal(r.status,302);
 const to=new URL(r.headers.get('location'));
 assert.equal(to.origin+to.pathname,SITE+'/verbinden');
 return to.searchParams.get('anfrage');
}

test('Registrierung: nur sichere Rücksprungadressen, öffentliche Clients ohne Geheimnis, vertrauliche mit',async t=>{
 const {h}=env(t);
 for(const ok of [REDIRECT,'http://localhost:33418/callback','http://127.0.0.1:6274/oauth/callback','com.example.app:/cb'])assert.ok(validRedirect(ok),ok);
 for(const bad of ['http://evil.example/cb','javascript:alert(1)','https://x.test/cb#frag','data:text/html,x','https://user:pw@x.test/','myapp:/cb'])assert.ok(!validRedirect(bad),bad);
 const c=await client(h);
 assert.match(c.client_id,/^oc_/);assert.equal(c.token_endpoint_auth_method,'none');assert.equal(c.client_secret,undefined);
 const bad=await h.call(wrap(register),{path:'/oauth/register',body:{redirect_uris:['http://evil.example/cb']}});
 assert.equal(bad.status,400);assert.equal(bad.body.error,'invalid_redirect_uri');
 const confidential=await client(h,{client_name:'Server-App',redirect_uris:[REDIRECT],token_endpoint_auth_method:'client_secret_post'});
 assert.match(confidential.client_secret,/^pcs_/);
 const stored=h.accounts.sql.prepare('SELECT secret_hash FROM oauth_clients WHERE id=?').get(confidential.client_id);
 assert.notEqual(stored.secret_hash,confidential.client_secret,'nur der Hash');
});

test('Zustimmung: Anfrage geprüft, nur angemeldete und vom Betreiber freigeschaltete Konten, Code mit PKCE gegen Token',async t=>{
 const e=env(t);const {h}=e;
 const c=await client(h),{verifier,challenge}=pkce();
 // Unbekannter Client oder fremde Rücksprungadresse: nie weiterleiten
 assert.equal((await raw(h,authorize,'/oauth/authorize?client_id=oc_unbekannt&response_type=code')).status,400);
 assert.equal((await raw(h,authorize,`/oauth/authorize?client_id=${c.client_id}&redirect_uri=${encodeURIComponent('https://evil.example/cb')}`)).status,400);
 // Ohne PKCE: zurück zur Anwendung mit Fehler
 const noPkce=await raw(h,authorize,`/oauth/authorize?client_id=${c.client_id}&redirect_uri=${encodeURIComponent(REDIRECT)}&response_type=code&state=s1`);
 assert.equal(new URL(noPkce.headers.get('location')).searchParams.get('error'),'invalid_request');
 const wrongTarget=await raw(h,authorize,`/oauth/authorize?client_id=${c.client_id}&response_type=code&code_challenge=${challenge}&code_challenge_method=S256&resource=${encodeURIComponent('https://andere.test/mcp')}`);
 assert.equal(new URL(wrongTarget.headers.get('location')).searchParams.get('error'),'invalid_target');

 const anfrage=await consent(h,c.client_id,challenge);
 const guest=await h.call(requestInfo,{path:'/api/oauth/request?anfrage='+encodeURIComponent(anfrage),method:'GET'});
 assert.equal(guest.status,200);assert.equal(guest.body.signedIn,false);assert.equal(guest.body.app.name,'Claude');
 const user=await signIn(h,'kundin@example.org');
 const notGranted=await h.call(requestInfo,{path:'/api/oauth/request?anfrage='+encodeURIComponent(anfrage),method:'GET'});
 assert.deepEqual(notGranted.body.customers,[]);
 assert.equal((await h.call(decide,{path:'/api/oauth/decide',body:{anfrage,allow:true}})).status,403);
 e.write([user]);await new Promise(r=>setTimeout(r,20));
 const info=await h.call(requestInfo,{path:'/api/oauth/request?anfrage='+encodeURIComponent(anfrage),method:'GET'});
 assert.equal(info.body.customers[0].identity,'kunde-a');assert.deepEqual(info.body.customers[0].regions,['Stadt Billerbeck','Kreis Coesfeld']);
 // Fremde Seite darf nicht zustimmen
 assert.equal((await h.call(decide,{path:'/api/oauth/decide',body:{anfrage,allow:true},origin:'https://evil.example'})).status,403);
 const ok=await h.call(decide,{path:'/api/oauth/decide',body:{anfrage,allow:true}});
 assert.equal(ok.status,200);
 const back=new URL(ok.body.redirect);
 assert.equal(back.origin+back.pathname,REDIRECT);assert.equal(back.searchParams.get('state'),'xyz');assert.equal(back.searchParams.get('iss'),SITE);
 const code=back.searchParams.get('code');

 const exchange=extra=>h.call(wrap(token),{path:'/oauth/token',body:{grant_type:'authorization_code',code,redirect_uri:REDIRECT,client_id:c.client_id,code_verifier:verifier,...extra}});
 assert.equal((await exchange({code_verifier:pkce().verifier})).body.error,'invalid_grant','falscher Verifier');
 // Nach dem Fehlversuch ist der Code verbraucht: auch der richtige Verifier hilft nicht mehr
 assert.equal((await exchange()).body.error,'invalid_grant');

 // Neuer Durchlauf für den Erfolg
 const second=pkce(),anfrage2=await consent(h,c.client_id,second.challenge);
 const code2=new URL((await h.call(decide,{path:'/api/oauth/decide',body:{anfrage:anfrage2,allow:true}})).body.redirect).searchParams.get('code');
 const tokens=await h.call(wrap(token),{path:'/oauth/token',body:{grant_type:'authorization_code',code:code2,redirect_uri:REDIRECT,client_id:c.client_id,code_verifier:second.verifier,resource:SITE+'/mcp'}});
 assert.equal(tokens.status,200,JSON.stringify(tokens.body));
 assert.equal(tokens.body.token_type,'Bearer');assert.equal(tokens.headers.get('cache-control'),'no-store');
 const payload=await verifyAccessToken(tokens.body.access_token,{secret:SECRET,audience:SITE+'/mcp',now:h.now()});
 assert.equal(payload.sub,user);assert.equal(payload.cus,'kunde-a');
 assert.match(tokens.body.refresh_token,/^prt_/);
 assert.ok(!h.accounts.sql.prepare('SELECT count(*) n FROM oauth_grants WHERE id=?').get(tokens.body.refresh_token).n,'nur der Hash gespeichert');
 // Zweites Einlösen desselben Codes: abgelehnt und alles aus diesem Code zurückgezogen
 const again=await h.call(wrap(token),{path:'/oauth/token',body:{grant_type:'authorization_code',code:code2,redirect_uri:REDIRECT,client_id:c.client_id,code_verifier:second.verifier}});
 assert.equal(again.body.error,'invalid_grant');
 const refreshed=await h.call(wrap(token),{path:'/oauth/token',body:{grant_type:'refresh_token',refresh_token:tokens.body.refresh_token,client_id:c.client_id}});
 assert.equal(refreshed.body.error,'invalid_grant');
});

test('Erneuerung rotiert; Wiederverwendung zieht die Kette zurück; Widerruf und Kontosperre beenden den Zugang',async t=>{
 const e=env(t);const {h}=e;
 const user=await signIn(h,'kunde@example.org');e.write([user]);
 const c=await client(h),{verifier,challenge}=pkce();
 const anfrage=await consent(h,c.client_id,challenge);
 const code=new URL((await h.call(decide,{path:'/api/oauth/decide',body:{anfrage,allow:true}})).body.redirect).searchParams.get('code');
 const first=(await h.call(wrap(token),{path:'/oauth/token',body:{grant_type:'authorization_code',code,redirect_uri:REDIRECT,client_id:c.client_id,code_verifier:verifier}})).body;
 const refresh=rt=>h.call(wrap(token),{path:'/oauth/token',body:{grant_type:'refresh_token',refresh_token:rt,client_id:c.client_id}});
 const second=(await refresh(first.refresh_token)).body;
 assert.match(second.access_token,/^pat_/);assert.notEqual(second.refresh_token,first.refresh_token);
 assert.equal((await refresh(first.refresh_token)).body.error,'invalid_grant','alter Token ein zweites Mal');
 assert.equal((await refresh(second.refresh_token)).body.error,'invalid_grant','ganze Kette zurückgezogen');

 // Neue Anmeldung, dann Widerruf
 const p2=pkce(),a2=await consent(h,c.client_id,p2.challenge);
 const code2=new URL((await h.call(decide,{path:'/api/oauth/decide',body:{anfrage:a2,allow:true}})).body.redirect).searchParams.get('code');
 const t2=(await h.call(wrap(token),{path:'/oauth/token',body:{grant_type:'authorization_code',code:code2,redirect_uri:REDIRECT,client_id:c.client_id,code_verifier:p2.verifier}})).body;
 assert.equal((await connectedApps(h.accounts.db,user,{now:h.now()})).length,1);
 // Formular wie von echten Clients
 const form=await raw(h,revoke,'/oauth/revoke',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:t2.refresh_token,client_id:c.client_id})});
 assert.equal(form.status,200);
 assert.equal((await refresh(t2.refresh_token)).body.error,'invalid_grant');

 // Konto gesperrt: Erneuerung scheitert; revokeAllStatements löscht Codes und Erneuerungstoken
 const p3=pkce(),a3=await consent(h,c.client_id,p3.challenge);
 const code3=new URL((await h.call(decide,{path:'/api/oauth/decide',body:{anfrage:a3,allow:true}})).body.redirect).searchParams.get('code');
 const t3=(await h.call(wrap(token),{path:'/oauth/token',body:{grant_type:'authorization_code',code:code3,redirect_uri:REDIRECT,client_id:c.client_id,code_verifier:p3.verifier}})).body;
 // „Andere Geräte abmelden“ trennt auch verbundene Assistenten
 assert.equal(h.accounts.sql.prepare('SELECT count(*) n FROM oauth_grants WHERE user_id=? AND revoked_at IS NULL AND used_at IS NULL').get(user).n,1);
 assert.equal((await h.call(sessionsRevoke,{path:'/api/me/sessions',body:{revoke:'others'}})).status,200);
 assert.equal((await refresh(t3.refresh_token)).body.error,'invalid_grant');
 h.accounts.sql.prepare("UPDATE users SET status='blocked' WHERE id=?").run(user);
 assert.equal((await refresh(t3.refresh_token)).body.error,'invalid_grant');
 await h.accounts.db.batch(revokeAllStatements(h.accounts.db,{userId:user,email:'kunde@example.org'}));
 assert.equal(h.accounts.sql.prepare('SELECT count(*) n FROM oauth_grants WHERE user_id=?').get(user).n,0);
});

test('Ablehnen führt mit access_denied zurück; Betreiber nimmt das Konto heraus: keine neuen Token',async t=>{
 const e=env(t);const {h}=e;
 const user=await signIn(h,'k@example.org');e.write([user]);
 const c=await client(h),{verifier,challenge}=pkce();
 const anfrage=await consent(h,c.client_id,challenge,{state:'st'});
 const no=await h.call(decide,{path:'/api/oauth/decide',body:{anfrage,allow:false}});
 assert.equal(new URL(no.body.redirect).searchParams.get('error'),'access_denied');
 const a2=await consent(h,c.client_id,challenge);
 const code=new URL((await h.call(decide,{path:'/api/oauth/decide',body:{anfrage:a2,allow:true}})).body.redirect).searchParams.get('code');
 e.write([]);await new Promise(r=>setTimeout(r,20));
 const r=await h.call(wrap(token),{path:'/oauth/token',body:{grant_type:'authorization_code',code,redirect_uri:REDIRECT,client_id:c.client_id,code_verifier:verifier}});
 assert.equal(r.body.error,'invalid_grant');
 // Abgelaufene Anfrage
 h.tick(31*60000);
 assert.equal((await h.call(requestInfo,{path:'/api/oauth/request?anfrage='+encodeURIComponent(a2),method:'GET'})).status,400);
});

test('Zugang hängt an keiner Stufe, nur an der Kundendatei: Erneuerung endet mit dem Eintrag',async t=>{
 const e=env(t);const {h}=e;
 const basic=await signIn(h,'basic@example.org',{tier:'basic'});e.write([basic]);
 const c=await client(h),{verifier,challenge}=pkce();
 const anfrage=await consent(h,c.client_id,challenge);
 const info=await h.call(requestInfo,{path:'/api/oauth/request?anfrage='+encodeURIComponent(anfrage),method:'GET'});
 assert.equal(info.body.customers.length,1);assert.equal('tierOk' in info.body,false);
 const code=new URL((await h.call(decide,{path:'/api/oauth/decide',body:{anfrage,allow:true}})).body.redirect).searchParams.get('code');
 const first=await h.call(wrap(token),{path:'/oauth/token',body:{grant_type:'authorization_code',code,redirect_uri:REDIRECT,client_id:c.client_id,code_verifier:verifier}});
 assert.equal(first.status,200);
 // Aus der Kundendatei genommen: keine Erneuerung mehr
 e.write([]);
 const later=await h.call(wrap(token),{path:'/oauth/token',body:{grant_type:'refresh_token',refresh_token:first.body.refresh_token,client_id:c.client_id}});
 assert.equal(later.body.error,'invalid_grant');
});

test('Zugangssperre und Rücksprung: OAuth-Endpunkte frei, Zustimmung nur angemeldet; /verbinden als Ziel nach der Anmeldung',async t=>{
 const {h}=env(t);
 const decision=p=>accessDecision(new Request(SITE+p),h.env,{cfg:h.cfg});
 for(const p of ['/oauth/token','/oauth/register','/oauth/authorize','/oauth/revoke'])assert.deepEqual(await decision(p),{allow:true},p);
 assert.ok((await decision('/verbinden?anfrage=x')).redirect);
 assert.equal((await decision('/api/oauth/decide')).status,401);
 assert.equal(safeNext('/verbinden?anfrage=abc'),'/verbinden?anfrage=abc');
 // Ohne Einrichtung (kein Geheimnis): 503, kein Absturz
 const bare=setup({access:'open'});
 const r=await bare.call(wrap(token),{path:'/oauth/token',body:{grant_type:'refresh_token'}});
 assert.equal(r.status,503);assert.equal(r.body.error,'temporarily_unavailable');
});
