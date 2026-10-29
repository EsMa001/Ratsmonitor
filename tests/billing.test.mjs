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
const STRIPE_ENV={STRIPE_SECRET_KEY:'sk_test_abc',STRIPE_WEBHOOK_SECRET:WHSEC,STRIPE_PRICE_PLUS:'price_plus',STRIPE_PRICE_PRO:'price_pro'};
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
  else if(kind==='subscriptions'&&method==='POST'&&subs.has(id)){
   const b=new URLSearchParams(init.body||''),s=subs.get(id);
   if(b.has('cancel_at_period_end'))Object.assign(s,{cancel_at_period_end:b.get('cancel_at_period_end')==='true',cancel_at:null});
   if(b.has('cancel_at'))Object.assign(s,{cancel_at_period_end:false,cancel_at:Number(b.get('cancel_at'))});
   data=s;
  }
  else if(kind==='subscriptions')data=subs.get(id)??null;
  else if(kind==='invoices')data=invoices.get(id)??null;
  else if(kind==='charges')data=charges.get(id)??null;
  return new Response(JSON.stringify(data??{error:{message:'No such object'}}),{status:data?200:404,headers:{'content-type':'application/json'}});
 };
 return {calls,subs,invoices,charges,fetch,fail:on=>{failing=on;}};
}
/** cancel: 'portal' kündigt wie das Kundenportal (cancel_at = Periodenende), 'period' über cancel_at_period_end */
function subscription(h,id,{userId,customer='cus_1',status='active',days=30,invoice='paid',cancel=null,price='price_plus'}={}){
 const end=Math.floor((h.now()+days*DAY)/1000);
 return {id,object:'subscription',customer,status,livemode:false,cancel_at_period_end:cancel==='period',cancel_at:cancel==='portal'?end:null,ended_at:null,
  metadata:userId?{user_id:userId}:{},items:{data:[{id:'si_'+id,current_period_end:end,price:{id:price}}]},latest_invoice:{id:'in_'+id,status:invoice}};
}
let eventNo=0;
async function deliver(h,type,object,{secret=WHSEC,livemode=false,id='evt_'+(++eventNo),age=0}={}){
 const event={id,object:'event',type,livemode,data:{object}};
 const signature=await signPayload(JSON.stringify(event),secret,Math.floor(h.now()/1000)-age);
 return h.call(webhook,{path:'/api/billing/webhook',body:event,headers:{'stripe-signature':signature}});
}
async function prepare(t,{env=STRIPE_ENV,admin=false}={}){
 const h=setup({extraEnv:env});
 const stripe=fakeStripe(h);
 const original=globalThis.fetch;
 globalThis.fetch=stripe.fetch;
 t.after(()=>{globalThis.fetch=original;});
 const userId=h.addUser('kunde@example.org',{admin});
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
 assert.deepEqual(before.body.billing,{test:true,customer:false,mails:true,subscription:null});

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
 assert.equal(grant.user_id,userId);assert.equal(grant.tier,'plus');assert.equal(grant.ref,'sub_1');
 assert.equal(Date.parse(grant.ends_at),Math.floor((h.now()+30*DAY)/1000)*1000+GRACE_MS);
 const after=await h.call(me,{method:'GET'});
 assert.equal(after.body.tier,'plus');assert.equal(after.body.tierSource,'stripe');assert.equal(after.body.billing.subscription.tier,'plus');
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
 assert.equal(await tierAt(h,userId),'plus','Kulanz nach dem Periodenende');

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

test('Mail „Zahlung eingegangen“: erste Zahlung schaltet frei, Folgezahlung verlängert, je Meldung einmal',async t=>{
 const {h,stripe,userId}=await prepare(t);
 stripe.subs.set('sub_1',subscription(h,'sub_1',{userId}));
 const invoice=(id,reason)=>({id,status:'paid',billing_reason:reason,amount_paid:299,currency:'eur',livemode:false,
  hosted_invoice_url:'https://invoice.stripe.com/i/'+id,parent:{subscription_details:{subscription:'sub_1'}}});
 stripe.invoices.set('in_1',invoice('in_1','subscription_create'));
 await deliver(h,'invoice.paid',{id:'in_1'},{id:'evt_paid_1'});
 await deliver(h,'invoice.paid',{id:'in_1'},{id:'evt_paid_1'});
 let mails=h.mails('kunde@example.org').filter(m=>/Zahlung eingegangen/.test(m.subject));
 assert.equal(mails.length,1,'doppelte Meldung, eine Mail');
 assert.equal(mails[0].subject,'Zahlung eingegangen: Plus ist freigeschaltet');
 assert.match(mails[0].text,/2,99 €/);assert.match(mails[0].text,/Testmodus/);assert.match(mails[0].text,/invoice\.stripe\.com\/i\/in_1/);
 assert.match(mails[0].text,/Nächste Abrechnung am \d{2}\.\d{2}\.\d{4}/);

 stripe.invoices.set('in_2',invoice('in_2','subscription_cycle'));
 await deliver(h,'invoice.paid',{id:'in_2'});
 mails=h.mails('kunde@example.org').filter(m=>/Zahlung eingegangen/.test(m.subject));
 assert.equal(mails.at(-1).subject,'Zahlung eingegangen: Plus verlängert');
 assert.equal(mails.length,2);

 stripe.invoices.set('in_3',{...invoice('in_3','subscription_cycle'),amount_paid:0});
 await deliver(h,'invoice.paid',{id:'in_3'});
 assert.equal(h.mails('kunde@example.org').filter(m=>/Zahlung eingegangen/.test(m.subject)).length,2,'0 € verlängert ohne Mail');
});

test('Pflegejob: „Plus endet“ 3 Tage vorher bei Kündigung, offener Zahlung und Freischaltung von Hand, nicht bei laufendem Abo',async t=>{
 const {maintain}=await import('../scripts/accounts/maintenance.mjs');
 const {h,stripe}=await prepare(t);
 const iso=ms=>new Date(ms).toISOString();
 const user=(email,{status='active',days=2,cancel=null,source='stripe'}={})=>{
  const id=h.addUser(email);
  const end=h.now()+days*DAY;
  if(source==='stripe'){
   h.accounts.sql.prepare('INSERT INTO subscriptions(id,user_id,customer_id,status,period_end,cancel_at,updated_at) VALUES(?,?,?,?,?,?,?)')
    .run('sub_'+id,id,'cus_'+id,status,iso(end),cancel===null?null:iso(h.now()+cancel*DAY),iso(h.now()));
   h.accounts.sql.prepare("INSERT INTO plan_grants(user_id,tier,source,starts_at,ends_at,ref) VALUES(?,'plus','stripe',?,?,?)").run(id,iso(h.now()-DAY),iso(end),'sub_'+id);
  }else h.accounts.sql.prepare("INSERT INTO plan_grants(user_id,tier,source,starts_at,ends_at) VALUES(?,'plus','manual',?,?)").run(id,iso(h.now()-DAY),iso(end));
  return id;
 };
 user('gekuendigt@example.org',{days:5,cancel:2});
 user('offen@example.org',{status:'past_due',days:2});
 user('hand@example.org',{source:'manual',days:2});
 user('laeuft@example.org',{days:2});
 user('spaeter@example.org',{days:12,cancel:9});
 const keeps=user('dauer@example.org',{days:5,cancel:2});
 h.accounts.sql.prepare("INSERT INTO plan_grants(user_id,tier,source,starts_at) VALUES(?,'enterprise','manual',?)").run(keeps,iso(h.now()-DAY));
 const quiet=user('still@example.org',{days:5,cancel:2});
 h.accounts.sql.prepare('INSERT INTO user_settings(user_id,billing_mails,updated_at) VALUES(?,0,?)').run(quiet,iso(h.now()));

 const report=await maintain(h.accounts.db,h.cfg,{now:h.now(),log:()=>{}});
 assert.equal(report.plusEnding,4);
 assert.equal(h.mails('still@example.org').length,0,'Zahlungsmails abbestellt');
 assert.ok(h.accounts.sql.prepare('SELECT end_notice_at FROM plan_grants WHERE user_id=?').get(quiet).end_notice_at,'trotzdem vermerkt');
 const ending=email=>h.mails(email).filter(m=>/Ihr Plus endet/.test(m.subject));
 assert.match(ending('gekuendigt@example.org')[0].text,/Sie haben Plus gekündigt\. Plus endet am \d{2}\.\d{2}\.\d{4}/);
 assert.match(ending('offen@example.org')[0].text,/Zahlung für Plus ist nicht eingegangen/);
 assert.match(ending('hand@example.org')[0].text,/Ihr Zugang zu Plus endet am/);
 for(const email of ['laeuft@example.org','spaeter@example.org','dauer@example.org'])assert.equal(ending(email).length,0,email);
 assert.equal((await maintain(h.accounts.db,h.cfg,{now:h.now(),log:()=>{}})).plusEnding,0,'nur einmal');

 /* Bezahlt die offene Zahlung doch noch, verlängert die Zeile und der Hinweis gilt wieder für das neue Ende */
 const late=h.accounts.sql.prepare("SELECT id FROM users WHERE email='offen@example.org'").get().id;
 stripe.subs.set('sub_'+late,{...subscription(h,'sub_'+late,{userId:late,customer:'cus_'+late,days:30}),id:'sub_'+late});
 await deliver(h,'customer.subscription.updated',{id:'sub_'+late});
 assert.equal(h.accounts.sql.prepare("SELECT end_notice_at FROM plan_grants WHERE ref=?").get('sub_'+late).end_notice_at,null);
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

test('STRIPE_ADMINS_ONLY: buchen und Portal nur für Admins, Meldungen weiter für alle',async t=>{
 const env={...STRIPE_ENV,STRIPE_ADMINS_ONLY:'1'};
 const user=await prepare(t,{env});
 assert.equal((await user.h.call(me,{method:'GET'})).body.billing,undefined,'ohne Admin-Rolle keine Knöpfe');
 const refused=await user.h.call(checkout,{path:'/api/billing/checkout'});
 assert.equal(refused.status,403);assert.match(refused.body.error,/noch nicht buchen/);
 assert.equal((await user.h.call(portal,{path:'/api/billing/portal'})).status,403);
 user.stripe.subs.set('sub_1',subscription(user.h,'sub_1',{userId:user.userId}));
 assert.equal((await deliver(user.h,'customer.subscription.created',{id:'sub_1'})).status,200,'Meldungen gelten unabhängig von der Rolle');
});

test('STRIPE_ADMINS_ONLY: Admins sehen die Bezahlung und können buchen',async t=>{
 const admin=await prepare(t,{env:{...STRIPE_ENV,STRIPE_ADMINS_ONLY:'1'},admin:true});
 assert.equal((await admin.h.call(me,{method:'GET'})).body.billing.test,true);
 assert.equal((await admin.h.call(checkout,{path:'/api/billing/checkout'})).status,200);
});

test('/api/me meldet Gästen, ob sie sich frei registrieren und Plus buchen können',async()=>{
 const guest=async(opts)=>(await setup(opts).call(me,{method:'GET',cookies:new Map()})).body;
 const open=await guest({access:'open',openSignup:true,extraEnv:STRIPE_ENV});
 assert.equal(open.signup,true);assert.equal(open.checkout,true);assert.deepEqual(open.bookable,['plus','pro']);
 assert.deepEqual((await guest({access:'open',extraEnv:{...STRIPE_ENV,STRIPE_PRICE_PRO:''}})).bookable,['plus'],'Pro nur mit eigenem Preis');
 const closed=await guest({access:'open',extraEnv:STRIPE_ENV});
 assert.equal(closed.signup,false,'ohne ACCOUNTS_OPEN_SIGNUP nur mit Einladung');
 assert.equal((await guest({access:'invite',openSignup:true,extraEnv:STRIPE_ENV})).signup,false,'im Einladungsmodus nie frei');
 assert.equal((await guest({access:'open',extraEnv:{...STRIPE_ENV,STRIPE_ADMINS_ONLY:'1'}})).checkout,false,'nur Admins: Gäste sehen die Anfrage');
 assert.equal((await guest({access:'open'})).checkout,false,'ohne Stripe keine Buchung');
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
 assert.equal(await tierOf(h),'plus');
});

test('Mails zur Bezahlung: abbestellbar per Link aus der Mail, Schalter im Konto, danach keine Mail mehr',async t=>{
 const {unsubscribeRoute}=await import('../server/accounts/notify.mjs');
 const {settingsWrite}=await import('../server/accounts/account.mjs');
 const {render}=await import('../server/accounts/mail-templates.mjs');
 const {h,stripe,userId}=await prepare(t);
 stripe.subs.set('sub_1',subscription(h,'sub_1',{userId}));
 const invoice=(id,reason)=>({id,status:'paid',billing_reason:reason,amount_paid:299,currency:'eur',livemode:false,parent:{subscription_details:{subscription:'sub_1'}}});
 const paid=()=>h.mails('kunde@example.org').filter(m=>/Zahlung eingegangen/.test(m.subject)).length;
 stripe.invoices.set('in_1',invoice('in_1','subscription_create'));
 await deliver(h,'invoice.paid',{id:'in_1'});
 const mail=h.lastMail('kunde@example.org');
 assert.match(mail.text,/Mails zu Zahlungen und zum Ende Ihres Abos abbestellen: \S+\/abbestellen#t=/);
 const headers=render('plus_ending',{until:new Date(h.now()).toISOString(),reason:'canceled',token:'T'.repeat(43)},{site:'https://plenara.test'}).headers;
 assert.equal(headers['List-Unsubscribe'],`<https://plenara.test/api/notify/unsubscribe?t=${'T'.repeat(43)}>`);
 assert.equal(headers['List-Unsubscribe-Post'],'List-Unsubscribe=One-Click');

 // Wie ein Mailprogramm: fremde Herkunft, ohne Cookie
 const unsub=body=>h.call(unsubscribeRoute,{path:'/api/notify/unsubscribe',body,origin:'https://mail.example.net',cookies:new Map()});
 const peek=await unsub({t:mail.token,peek:true});
 assert.equal(peek.body.kind,'billing');
 assert.equal((await h.call(me,{method:'GET'})).body.billing.mails,true,'ansehen ändert nichts');
 assert.equal((await unsub({t:mail.token})).status,200);
 assert.equal((await h.call(me,{method:'GET'})).body.billing.mails,false);
 stripe.invoices.set('in_2',invoice('in_2','subscription_cycle'));
 await deliver(h,'invoice.paid',{id:'in_2'});
 assert.equal(paid(),1,'abbestellt: keine Mail');
 assert.equal(grants(h).length,1,'die Zahlung zählt trotzdem');

 await h.call(settingsWrite,{method:'PUT',body:{weekly:true}});
 assert.equal((await h.call(me,{method:'GET'})).body.billing.mails,false,'andere Einstellungen lassen den Schalter');
 await h.call(settingsWrite,{method:'PUT',body:{billingMails:true}});
 assert.equal((await h.call(me,{method:'GET'})).body.billing.mails,true);
 stripe.invoices.set('in_3',invoice('in_3','subscription_cycle'));
 await deliver(h,'invoice.paid',{id:'in_3'});
 assert.equal(paid(),2);
});

test('Kündigungsbutton (§ 312k BGB): ohne Anmeldung, gleiche Antwort für jede Adresse, Abo bei Stripe beendet, Nachweis und Bestätigung',async t=>{
 const {cancelRoute}=await import('../server/accounts/cancel.mjs');
 const {h,stripe,userId}=await prepare(t,{env:{...STRIPE_ENV,OPERATOR_EMAIL:'betrieb@example.org'}});
 stripe.subs.set('sub_1',subscription(h,'sub_1',{userId}));
 await deliver(h,'customer.subscription.updated',{id:'sub_1'});
 const cancel=(body,opts={})=>h.call(cancelRoute,{path:'/api/billing/cancel',body,cookies:new Map(),...opts});
 const posts=()=>stripe.calls.filter(c=>c.method==='POST'&&c.path==='subscriptions/sub_1');
 const rows=()=>h.accounts.sql.prepare('SELECT * FROM cancellations ORDER BY id').all();

 const known=await cancel({email:'Kunde@Example.org',kind:'ordinary',when:'next'});
 const unknown=await cancel({email:'niemand@example.org',kind:'ordinary',when:'next'});
 assert.equal(known.status,200);assert.equal(unknown.status,200);
 assert.deepEqual(Object.keys(known.body).sort(),Object.keys(unknown.body).sort(),'kein Rückschluss auf ein Konto');
 assert.equal(known.body.contract,'Plenara-Abo (Plus oder Pro)');assert.equal(known.body.receivedAt,new Date(h.now()).toISOString());
 assert.equal(posts().at(-1).body.get('cancel_at_period_end'),'true');
 const [first,second]=rows();
 assert.equal(first.user_id,userId);assert.equal(first.result,'canceled');assert.equal(first.subscription_id,'sub_1');assert.equal(first.kind,'ordinary');
 assert.equal(second.user_id,null);assert.equal(second.result,'none');
 assert.ok(rows().every(r=>!JSON.stringify(r).includes('@')),'keine Adresse im Nachweis');
 const mail=h.lastMail('kunde@example.org');
 assert.equal(mail.subject,'Ihre Kündigung bei Plenara ist eingegangen');
 assert.match(mail.text,/Eingegangen am \d{2}\.\d{2}\.\d{4} um \d{2}:\d{2} Uhr/);
 assert.match(mail.text,/Ihr Abo endet am \d{2}\.\d{2}\.\d{4}/);
 assert.doesNotMatch(mail.text,/abbestellen/,'Bestätigung ist nicht abbestellbar');
 assert.match(h.lastMail('niemand@example.org').text,/kein laufendes Abo\. Haben Sie Plus oder Pro/);
 assert.ok((await h.call(me,{method:'GET'})).body.billing.subscription.cancelAt,'Abo als gekündigt übernommen');

 h.tick(60000);
 await cancel({email:'kunde@example.org',kind:'extraordinary',reason:'Dienst nicht erreichbar',when:'next'});
 assert.equal(rows().at(-1).result,'review');assert.equal(rows().at(-1).reason,'Dienst nicht erreichbar');
 assert.match(h.lastMail('kunde@example.org').text,/Grund: Dienst nicht erreichbar/);
 assert.match(h.lastMail('betrieb@example.org').text,/Außerordentliche Kündigung eingegangen.*Grund: Dienst nicht erreichbar/s);

 const later=new Date(h.now()+60*DAY).toISOString().slice(0,10);
 await cancel({email:'kunde@example.org',kind:'ordinary',when:'date',date:later});
 assert.equal(posts().at(-1).body.get('cancel_at'),String(Math.floor(Date.parse(later+'T23:59:59Z')/1000)));
 assert.equal(posts().at(-1).body.get('proration_behavior'),'none');
 assert.equal(rows().at(-1).wanted,later);
 assert.match(h.lastMail('kunde@example.org').text,new RegExp(`Gewünschter Zeitpunkt: zum ${later.split('-').reverse().join('\\.')}`));

 const count=h.mails('kunde@example.org').length;
 assert.equal((await cancel({email:'kunde@example.org'},{ip:'198.51.100.9'})).status,200);
 assert.equal(h.mails('kunde@example.org').length,count,'je Adresse höchstens 3 Bestätigungen am Tag');

 const bad=body=>cancel(body,{ip:'192.0.2.50'});
 assert.equal((await bad({email:'kein'})).body.field,'email');
 assert.equal((await bad({email:'a@example.org',kind:'extraordinary'})).body.field,'reason');
 assert.equal((await bad({email:'a@example.org',when:'date',date:'2020-01-01'})).body.field,'date');
 assert.equal((await cancel({email:'a@example.org'},{origin:'https://fremd.example'})).status,403);
 for(let i=0;i<5;i++)assert.equal((await cancel({email:`x${i}@example.org`},{ip:'192.0.2.1'})).status,200);
 assert.equal((await cancel({email:'y@example.org'},{ip:'192.0.2.1'})).status,429);
});

test('Zugangssperre lässt nur die Meldungen von Stripe und den Kündigungsbutton ohne Sitzung durch',async()=>{
 const h=setup({extraEnv:STRIPE_ENV});
 const ask=path=>accessDecision(new Request('https://plenara.test'+path,{method:'POST'}),h.env,{cfg:h.cfg});
 assert.deepEqual(await ask('/api/billing/webhook'),{allow:true});
 assert.deepEqual(await ask('/api/billing/cancel'),{allow:true});
 assert.deepEqual(await accessDecision(new Request('https://plenara.test/kuendigen'),h.env,{cfg:h.cfg}),{allow:true});
 assert.deepEqual(await ask('/api/billing/checkout'),{status:401});
 assert.deepEqual(await ask('/api/billing/portal'),{status:401});
});

test('Pro buchen: eigener Preis, Stufe folgt dem Preis, Wechsel über das Portal erst mit bezahlter Rechnung, kein zweites Abo',async t=>{
 const {h,stripe,userId}=await prepare(t);
 assert.equal((await h.call(checkout,{path:'/api/billing/checkout',body:{tier:'enterprise'}})).status,400);
 assert.equal((await h.call(checkout,{path:'/api/billing/checkout',body:{tier:'pro'}})).status,200);
 assert.equal(stripe.calls.filter(c=>c.path==='checkout/sessions').at(-1).body.get('line_items[0][price]'),'price_pro');
 stripe.subs.set('sub_9',subscription(h,'sub_9',{userId,price:'price_pro'}));
 await deliver(h,'checkout.session.completed',{id:'cs_test_1',mode:'subscription',client_reference_id:userId,customer:'cus_1',subscription:'sub_9'});
 assert.equal(await tierOf(h),'pro');
 const second=await h.call(checkout,{path:'/api/billing/checkout',body:{tier:'plus'}});
 assert.equal(second.status,409);assert.match(second.body.error,/^Pro ist bereits gebucht/);
 // Wechsel nach unten im Portal: Rechnung noch offen, Stufe bleibt; bezahlt: Plus
 Object.assign(stripe.subs.get('sub_9'),{items:{data:[{current_period_end:Math.floor((h.now()+30*DAY)/1000),price:{id:'price_plus'}}]},latest_invoice:{id:'in_x',status:'open'}});
 await deliver(h,'customer.subscription.updated',{id:'sub_9'});
 assert.equal(await tierOf(h),'pro','ohne bezahlte Rechnung kein Wechsel');
 stripe.subs.get('sub_9').latest_invoice.status='paid';
 await deliver(h,'customer.subscription.updated',{id:'sub_9'});
 assert.equal(await tierOf(h),'plus');
 assert.equal(grants(h).length,1,'eine Zeile je Abo');
 // Unbekannter Preis schaltet nie mehr frei als Plus
 stripe.subs.get('sub_9').items.data[0].price={id:'price_alt'};
 await deliver(h,'customer.subscription.updated',{id:'sub_9'});
 assert.equal(grants(h)[0].tier,'plus');
});

test('Wechsel mit laufendem Abo: die Buchungsseite öffnet die Bestätigung im Portal (flow_data), gleiche Stufe 409',async t=>{
 const {h,stripe,userId}=await prepare(t);
 stripe.subs.set('sub_7',subscription(h,'sub_7',{userId}));
 await deliver(h,'checkout.session.completed',{id:'cs_test_1',mode:'subscription',client_reference_id:userId,customer:'cus_1',subscription:'sub_7'});
 assert.equal((await h.call(portal,{path:'/api/billing/portal',body:{tier:'plus'}})).status,409,'Plus ist schon gebucht');
 assert.equal((await h.call(portal,{path:'/api/billing/portal',body:{tier:'enterprise'}})).status,400);
 assert.equal((await h.call(portal,{path:'/api/billing/portal',body:{tier:'pro'}})).status,200);
 const sent=stripe.calls.filter(c=>c.path==='billing_portal/sessions').at(-1).body;
 assert.equal(sent.get('flow_data[type]'),'subscription_update_confirm');
 assert.equal(sent.get('flow_data[subscription_update_confirm][subscription]'),'sub_7');
 assert.equal(sent.get('flow_data[subscription_update_confirm][items][0][id]'),'si_sub_7');
 assert.equal(sent.get('flow_data[subscription_update_confirm][items][0][price]'),'price_pro');
 assert.match(sent.get('flow_data[after_completion][redirect][return_url]'),/\/konto\/profil\?zahlung=pruefen$/);
 assert.equal((await h.call(portal,{path:'/api/billing/portal',body:{}})).status,200,'ohne Stufe das Portal wie bisher');
 assert.equal(stripe.calls.filter(c=>c.path==='billing_portal/sessions').at(-1).body.get('flow_data[type]'),null);
});
