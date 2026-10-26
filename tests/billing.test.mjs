// Bezahlung über Stripe (server/accounts/billing.mjs, konten-konzept.md 9.1): Checkout und Portal nur mit Sitzung,
// Freischaltung nur über signierte Meldungen oder den Abgleich, jede Meldung einmal, Stripe-API als Attrappe.
import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/accounts.mjs';
import {requestLink,enterCode,me} from '../server/accounts/login.mjs';
import {deleteAccount} from '../server/accounts/account.mjs';
import {accessDecision} from '../server/accounts/access.mjs';
import {accountsConfig} from '../server/accounts/config.mjs';
import {effectiveTier} from '../server/accounts/sessions.mjs';
import {billingReady,checkout,portal,webhook,reconcile,verifySignature,signPayload,formEncode,GRACE_MS} from '../server/accounts/billing.mjs';

const WHSEC='whsec_test_0123456789abcdef';
const STRIPE_ENV={STRIPE_SECRET_KEY:'sk_test_abc',STRIPE_WEBHOOK_SECRET:WHSEC,STRIPE_PRICE_PLUS:'price_plus'};
const DAY=86400000;

/** Stripe-Attrappe: Abos, Rechnungen und Belastungen im Speicher, jeder Aufruf protokolliert */
function fakeStripe(h){
 const calls=[],subs=new Map(),invoices=new Map(),charges=new Map();
 let failing=false;
 const fetch=async(url,init={})=>{
  const u=new URL(url),method=init.method||'GET',path=u.pathname.replace(/^\/v1\//,'');
  calls.push({method,path,query:u.searchParams,body:new URLSearchParams(init.body||''),headers:init.headers});
  const [kind,id]=path.split('/');
  let data=null;
  if(failing)return new Response(JSON.stringify({error:{message:'kaputt'}}),{status:500});
  if(method==='POST'&&path==='checkout/sessions')data={id:'cs_test_1',url:'https://checkout.stripe.com/c/pay/cs_test_1'};
  else if(method==='POST'&&path==='billing_portal/sessions')data={id:'bps_1',url:'https://billing.stripe.com/p/session/test_1'};
  else if(kind==='subscriptions'&&!id)data={object:'list',data:[...subs.values()],has_more:false};
  else if(kind==='subscriptions'&&method==='DELETE'&&subs.has(id))data=Object.assign(subs.get(id),{status:'canceled',ended_at:Math.floor(h.now()/1000)});
  else if(kind==='subscriptions')data=subs.get(id)??null;
  else if(kind==='invoices')data=invoices.get(id)??null;
  else if(kind==='charges')data=charges.get(id)??null;
  return new Response(JSON.stringify(data??{error:{message:'No such object'}}),{status:data?200:404,headers:{'content-type':'application/json'}});
 };
 return {calls,subs,invoices,charges,fetch,fail:on=>{failing=on;}};
}
/** cancel: 'portal' kündigt wie das Kundenportal (cancel_at = Periodenende), 'period' über cancel_at_period_end */
function subscription(h,id,{userId,customer='cus_1',status='active',days=30,invoice='paid',cancel=null}={}){
 const end=Math.floor((h.now()+days*DAY)/1000);
 return {id,object:'subscription',customer,status,livemode:false,cancel_at_period_end:cancel==='period',cancel_at:cancel==='portal'?end:null,ended_at:null,
  metadata:userId?{user_id:userId}:{},items:{data:[{current_period_end:end,price:{id:'price_plus'}}]},latest_invoice:{id:'in_'+id,status:invoice}};
}
let eventNo=0;
async function deliver(h,type,object,{secret=WHSEC,livemode=false,id='evt_'+(++eventNo),age=0}={}){
 const event={id,object:'event',type,livemode,data:{object}};
 const signature=await signPayload(JSON.stringify(event),secret,Math.floor(h.now()/1000)-age);
 return h.call(webhook,{path:'/api/billing/webhook',body:event,headers:{'stripe-signature':signature}});
}
async function prepare(t,{env=STRIPE_ENV}={}){
 const h=setup({extraEnv:env});
 const stripe=fakeStripe(h);
 const original=globalThis.fetch;
 globalThis.fetch=stripe.fetch;
 t.after(()=>{globalThis.fetch=original;});
 const userId=h.addUser('kunde@example.org');
 await h.call(requestLink,{body:{email:'kunde@example.org'}});
 await h.call(enterCode,{body:{code:h.lastMail('kunde@example.org').code}});
 return {h,stripe,userId};
}
const grants=h=>h.accounts.sql.prepare("SELECT * FROM plan_grants WHERE source='stripe' ORDER BY id").all();
const tierOf=async h=>(await h.call(me,{method:'GET'})).body.tier;
/** Stufe ohne Sitzung (nach Zeitsprüngen über die Leerlaufzeit der Sitzung hinaus) */
const tierAt=async(h,userId)=>(await effectiveTier(h.cfg.db,userId,{now:h.now()})).tier;

test('Signatur: nur mit passendem Geheimnis, unverändertem Text und frischem Zeitstempel',async()=>{
 const now=Date.parse('2026-10-14T10:00:00Z'),t=Math.floor(now/1000),raw='{"id":"evt_1"}';
 const header=await signPayload(raw,WHSEC,t);
 assert.equal(await verifySignature(raw,header,WHSEC,{now}),true);
 assert.equal(await verifySignature(raw,`t=${t},v1=${'0'.repeat(64)},${header.split(',')[1]}`,WHSEC,{now}),true,'mehrere v1 (Geheimnis gewechselt)');
 assert.equal(await verifySignature(raw+' ',header,WHSEC,{now}),false);
 assert.equal(await verifySignature(raw,header,'whsec_anderes',{now}),false);
 assert.equal(await verifySignature(raw,header,WHSEC,{now:now+301000}),false);
 assert.equal(await verifySignature(raw,'',WHSEC,{now}),false);
 assert.equal(await verifySignature(raw,`t=${t}`,WHSEC,{now}),false);
});

test('Einrichtung: alle drei Werte, Testschlüssel; Live-Schlüssel nur mit STRIPE_LIVE=1',()=>{
 const cfg=env=>accountsConfig(env,{dev:false});
 assert.equal(billingReady(cfg(STRIPE_ENV)),true);
 assert.equal(billingReady(cfg({...STRIPE_ENV,STRIPE_PRICE_PLUS:''})),false);
 assert.equal(billingReady(cfg({...STRIPE_ENV,STRIPE_SECRET_KEY:'sk_live_abc'})),false);
 assert.equal(billingReady(cfg({...STRIPE_ENV,STRIPE_SECRET_KEY:'sk_live_abc',STRIPE_LIVE:'1'})),true);
 assert.equal(billingReady(cfg({...STRIPE_ENV,STRIPE_LIVE:'1'})),false,'Testschlüssel im Live-Betrieb');
 assert.equal(formEncode({line_items:[{price:'p',quantity:1}],metadata:{user_id:'u'},expand:['a'],x:undefined}).toString(),
  'line_items%5B0%5D%5Bprice%5D=p&line_items%5B0%5D%5Bquantity%5D=1&metadata%5Buser_id%5D=u&expand%5B0%5D=a');
});

test('Checkout, Meldung, Freischaltung, doppelte Meldung, Portal',async t=>{
 const {h,stripe,userId}=await prepare(t);
 const before=await h.call(me,{method:'GET'});
 assert.equal(before.body.tier,'basic');
 assert.deepEqual(before.body.billing,{test:true,customer:false,subscription:null});

 const started=await h.call(checkout,{path:'/api/billing/checkout'});
 assert.equal(started.status,200);
 assert.equal(started.body.url,'https://checkout.stripe.com/c/pay/cs_test_1');
 const sent=stripe.calls.at(-1);
 assert.equal(sent.headers.Authorization,'Bearer sk_test_abc');
 assert.equal(sent.body.get('mode'),'subscription');
 assert.equal(sent.body.get('line_items[0][price]'),'price_plus');
 assert.equal(sent.body.get('client_reference_id'),userId);
 assert.equal(sent.body.get('subscription_data[metadata][user_id]'),userId);
 assert.equal(sent.body.get('customer_email'),'kunde@example.org');
 assert.equal(sent.body.get('success_url'),'https://plenara.test/konto/profil?zahlung=pruefen');
 assert.equal(await tierOf(h),'basic','die Rückkehr aus dem Checkout schaltet nichts frei');

 stripe.subs.set('sub_1',subscription(h,'sub_1',{userId}));
 const done=await deliver(h,'checkout.session.completed',{id:'cs_test_1',object:'checkout.session',mode:'subscription',client_reference_id:userId,customer:'cus_1',subscription:'sub_1',livemode:false},{id:'evt_done'});
 assert.equal(done.status,200);
 const [grant]=grants(h);
 assert.equal(grant.user_id,userId);assert.equal(grant.tier,'pro');assert.equal(grant.ref,'sub_1');
 assert.equal(Date.parse(grant.ends_at),Math.floor((h.now()+30*DAY)/1000)*1000+GRACE_MS);
 const after=await h.call(me,{method:'GET'});
 assert.equal(after.body.tier,'pro');assert.equal(after.body.tierSource,'stripe');
 assert.equal(after.body.billing.customer,true);assert.equal(after.body.billing.subscription.status,'active');

 const again=await deliver(h,'checkout.session.completed',{id:'cs_test_1',mode:'subscription',client_reference_id:userId,customer:'cus_1',subscription:'sub_1'},{id:'evt_done'});
 assert.equal(again.body.duplicate,true);
 assert.equal(grants(h).length,1);

 assert.equal((await h.call(checkout,{path:'/api/billing/checkout'})).status,409,'kein zweites Abo');
 const opened=await h.call(portal,{path:'/api/billing/portal'});
 assert.equal(opened.body.url,'https://billing.stripe.com/p/session/test_1');
 assert.equal(stripe.calls.at(-1).body.get('customer'),'cus_1');
 assert.equal(stripe.calls.at(-1).body.get('configuration'),null,'ohne eigene Einstellung die des Dashboards');
});

test('Portal mit eigener Einstellung aus STRIPE_PORTAL_CONFIG',async t=>{
 const {h,stripe,userId}=await prepare(t,{env:{...STRIPE_ENV,STRIPE_PORTAL_CONFIG:'bpc_plenara'}});
 stripe.subs.set('sub_1',subscription(h,'sub_1',{userId}));
 await deliver(h,'customer.subscription.created',{id:'sub_1'});
 assert.equal((await h.call(portal,{path:'/api/billing/portal'})).status,200);
 assert.equal(stripe.calls.at(-1).body.get('configuration'),'bpc_plenara');
});

test('.dev.vars: Werte ersetzen, entfernen und anhängen, andere Zeilen bleiben',async()=>{
 const fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path');
 const {readVars,writeVars,mask}=await import('../scripts/billing/local.mjs');
 const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'devvars-')),'.dev.vars');
 fs.writeFileSync(file,'# Kommentar\r\nADMIN_SETUP_HASH=abc\r\nSTRIPE_SECRET_KEY="sk_test_alt"\r\nSTRIPE_LIVE=1\r\n');
 writeVars({STRIPE_SECRET_KEY:'sk_test_neu',STRIPE_PRICE_PLUS:'price_1',STRIPE_LIVE:null},file);
 assert.equal(fs.readFileSync(file,'utf8'),'# Kommentar\r\nADMIN_SETUP_HASH=abc\r\nSTRIPE_SECRET_KEY=sk_test_neu\r\nSTRIPE_PRICE_PLUS=price_1\r\n');
 assert.deepEqual(readVars(file),{ADMIN_SETUP_HASH:'abc',STRIPE_SECRET_KEY:'sk_test_neu',STRIPE_PRICE_PLUS:'price_1'});
 assert.equal(mask('sk_test_ABCDEFGHIJKLMNOP'),'sk_test_ABCD…MNOP');
});

test('Folgerechnung verlängert, offene Rechnung nicht, Kündigung beendet zum Ablauf',async t=>{
 const {h,stripe,userId}=await prepare(t);
 stripe.subs.set('sub_1',subscription(h,'sub_1',{userId}));
 await deliver(h,'customer.subscription.created',{id:'sub_1'});
 const first=grants(h)[0].ends_at;

 h.tick(30*DAY);
 stripe.subs.set('sub_1',subscription(h,'sub_1',{userId,invoice:'open'}));
 await deliver(h,'customer.subscription.updated',{id:'sub_1'});
 assert.equal(grants(h)[0].ends_at,first,'neue Periode ohne bezahlte Rechnung verlängert nicht');
 assert.equal(await tierAt(h,userId),'pro','Kulanz nach dem Periodenende');

 stripe.subs.set('sub_1',subscription(h,'sub_1',{userId}));
 stripe.invoices.set('in_2',{id:'in_2',status:'paid',parent:{subscription_details:{subscription:'sub_1'}}});
 await deliver(h,'invoice.paid',{id:'in_2'});
 assert.ok(grants(h)[0].ends_at>first,'bezahlte Folgerechnung verlängert');

 const ended=Object.assign(subscription(h,'sub_1',{userId}),{status:'canceled',ended_at:Math.floor((h.now()+5*DAY)/1000)});
 stripe.subs.set('sub_1',ended);
 await deliver(h,'customer.subscription.deleted',{id:'sub_1'});
 assert.equal(Date.parse(grants(h)[0].ends_at),ended.ended_at*1000);
 h.tick(5*DAY+1000);
 assert.equal(await tierAt(h,userId),'basic');
 assert.equal(grants(h).length,1,'eine Zeile je Abo');
});

test('Anfechtung beendet Abo und Freischaltung sofort',async t=>{
 const {h,stripe,userId}=await prepare(t);
 stripe.subs.set('sub_1',subscription(h,'sub_1',{userId}));
 await deliver(h,'customer.subscription.created',{id:'sub_1'});
 stripe.charges.set('ch_1',{id:'ch_1',customer:'cus_1'});
 h.tick(1000);
 assert.equal((await deliver(h,'charge.dispute.created',{id:'dp_1',charge:'ch_1'})).status,200);
 assert.ok(stripe.calls.some(c=>c.method==='DELETE'&&c.path==='subscriptions/sub_1'));
 assert.equal(grants(h)[0].ends_at,new Date(h.now()).toISOString());
 assert.equal(await tierOf(h),'basic');
});

test('Meldungen: falsche Signatur, alter Zeitstempel, Live im Testmodus, fremde Art; Fehler wird erneut zugestellt',async t=>{
 const {h,stripe,userId}=await prepare(t);
 stripe.subs.set('sub_1',subscription(h,'sub_1',{userId}));
 assert.equal((await deliver(h,'customer.subscription.created',{id:'sub_1'},{secret:'whsec_falsch'})).status,400);
 assert.equal((await deliver(h,'customer.subscription.created',{id:'sub_1'},{age:600})).status,400);
 assert.equal((await deliver(h,'customer.subscription.created',{id:'sub_1'},{livemode:true})).body.ignored,true);
 const calls=stripe.calls.length;
 assert.equal((await deliver(h,'invoice.created',{id:'in_1'})).body.ignored,true);
 assert.equal(stripe.calls.length,calls,'nicht verarbeitete Arten rufen Stripe nicht ab');
 assert.equal(grants(h).length,0);

 stripe.fail(true);
 await assert.rejects(deliver(h,'customer.subscription.created',{id:'sub_1'},{id:'evt_retry'}));
 assert.match(h.accounts.sql.prepare("SELECT error FROM billing_events WHERE id='evt_retry'").get().error,/kaputt/);
 stripe.fail(false);
 assert.equal((await deliver(h,'customer.subscription.created',{id:'sub_1'},{id:'evt_retry'})).status,200);
 assert.equal(grants(h).length,1);
 assert.equal(h.accounts.sql.prepare("SELECT error FROM billing_events WHERE id='evt_retry'").get().error,null);
});

test('Ohne Einrichtung: Routen antworten 503, /api/me ohne billing',async t=>{
 const {h}=await prepare(t,{env:{}});
 assert.equal((await h.call(checkout,{path:'/api/billing/checkout'})).status,503);
 assert.equal((await deliver(h,'customer.subscription.created',{id:'sub_1'})).status,503);
 assert.equal((await h.call(me,{method:'GET'})).body.billing,undefined);
});

test('Checkout und Portal nur angemeldet und von der eigenen Seite',async t=>{
 const {h}=await prepare(t);
 assert.equal((await h.call(checkout,{path:'/api/billing/checkout',origin:'https://boese.example'})).status,403);
 assert.equal((await h.call(checkout,{path:'/api/billing/checkout',cookies:new Map()})).status,401);
 assert.equal((await h.call(portal,{path:'/api/billing/portal'})).status,404,'ohne Stripe-Kunden kein Portal');
});

test('Abgleich übernimmt Abos mit Plenara-Konto und überspringt fremde',async t=>{
 const {h,stripe,userId}=await prepare(t);
 stripe.subs.set('sub_1',subscription(h,'sub_1',{userId}));
 stripe.subs.set('sub_x',subscription(h,'sub_x',{customer:'cus_fremd'}));
 assert.deepEqual(await reconcile({db:h.cfg.db,cfg:h.cfg,now:h.now()}),{seen:2,linked:1});
 assert.equal(grants(h).length,1);
 assert.equal(h.accounts.sql.prepare('SELECT customer_id FROM billing_customers WHERE user_id=?').get(userId).customer_id,'cus_1');
 assert.equal(stripe.calls.at(-1).query.get('expand[0]'),'data.latest_invoice');
});

test('Konto löschen erst nach Kündigung des Abos',async t=>{
 const {h,stripe,userId}=await prepare(t);
 stripe.subs.set('sub_1',subscription(h,'sub_1',{userId}));
 await deliver(h,'customer.subscription.created',{id:'sub_1'});
 assert.equal((await h.call(deleteAccount,{path:'/api/me/delete'})).status,409);
 stripe.subs.set('sub_1',subscription(h,'sub_1',{userId,cancel:'portal'}));
 await deliver(h,'customer.subscription.updated',{id:'sub_1'});
 assert.equal((await h.call(deleteAccount,{path:'/api/me/delete'})).body.codeSent,true);
});

test('Kündigung über das Portal (cancel_at) und über cancel_at_period_end, Rücknahme',async t=>{
 const {h,stripe,userId}=await prepare(t);
 const end=new Date(Math.floor((h.now()+30*DAY)/1000)*1000).toISOString();
 const cancelAt=async()=>(await h.call(me,{method:'GET'})).body.billing.subscription.cancelAt;
 stripe.subs.set('sub_1',subscription(h,'sub_1',{userId,cancel:'portal'}));
 await deliver(h,'customer.subscription.updated',{id:'sub_1'});
 assert.equal(await cancelAt(),end);
 stripe.subs.set('sub_1',subscription(h,'sub_1',{userId,cancel:'period'}));
 await deliver(h,'customer.subscription.updated',{id:'sub_1'});
 assert.equal(await cancelAt(),end);
 stripe.subs.set('sub_1',subscription(h,'sub_1',{userId}));
 await deliver(h,'customer.subscription.updated',{id:'sub_1'});
 assert.equal(await cancelAt(),null,'Kündigung zurückgenommen');
 assert.equal(await tierOf(h),'pro');
});

test('Zugangssperre lässt nur die Meldungen von Stripe ohne Sitzung durch',async()=>{
 const h=setup({extraEnv:STRIPE_ENV});
 const ask=path=>accessDecision(new Request('https://plenara.test'+path,{method:'POST'}),h.env,{cfg:h.cfg});
 assert.deepEqual(await ask('/api/billing/webhook'),{allow:true});
 assert.deepEqual(await ask('/api/billing/checkout'),{status:401});
 assert.deepEqual(await ask('/api/billing/portal'),{status:401});
});
