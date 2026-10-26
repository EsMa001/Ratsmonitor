// Kontenübersicht der Administration (server/accounts/admin-accounts.mjs, konten-konzept.md 6.2): liest nur, Adressen nur
// gekürzt, volle Adresse je Konto oder über die genaue Suche, jeder Abruf im Admin-Protokoll; Abo-Daten aus Stripe.
import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/accounts.mjs';
import {accountsOverview,revealAccount,findAccount,maskEmail,paymentState} from '../server/accounts/admin-accounts.mjs';
import {syncSubscription} from '../server/accounts/billing.mjs';

const DAY=86400000;
const iso=ms=>new Date(ms).toISOString();

function subscriptionRow(h,{id,userId,status='active',cancelAt=null,startedAt=null,lastPaidAt=null}){
 h.accounts.sql.prepare(`INSERT INTO subscriptions(id,user_id,customer_id,status,period_end,cancel_at,updated_at,started_at,last_paid_at)
  VALUES(?,?,?,?,?,?,?,?,?)`).run(id,userId,'cus_'+id,status,iso(h.now()+20*DAY),cancelAt,iso(h.now()),startedAt,lastPaidAt);
 if(status==='active')h.accounts.sql.prepare("INSERT INTO plan_grants(user_id,tier,source,starts_at,ends_at,ref) VALUES(?,'pro','stripe',?,?,?)").run(userId,iso(h.now()-DAY),iso(h.now()+23*DAY),id);
}
/** Zugriff, der jedes Schreiben ablehnt (die Übersicht liest nur) */
const readOnly=db=>({prepare(q){if(/^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(q))throw Error('Schreiben in der Übersicht: '+q.slice(0,60));return db.prepare(q);},batch:s=>db.batch(s)});

test('Adressen gekürzt, Zahlungsstand je Abo',()=>{
 assert.equal(maskEmail('max.mustermann@gmail.com'),'ma•••@g•••.com');
 assert.equal(maskEmail('ab@stadt-duelmen.de'),'a•••@s•••.de');
 assert.equal(maskEmail('x@y'),'x•••@y•••');
 assert.equal(paymentState(null),null);
 assert.equal(paymentState({status:'active',cancel_at:null}),'paid');
 assert.equal(paymentState({status:'active',cancel_at:'2026-11-26T00:00:00Z'}),'canceling');
 assert.equal(paymentState({status:'past_due'}),'due');
 assert.equal(paymentState({status:'incomplete'}),'pending');
 assert.equal(paymentState({status:'canceled'}),'ended');
});

test('Übersicht: alle Konten mit Stufe und Zahlungsstand, keine vollen Adressen, liest nur',async()=>{
 const h=setup();
 const free=h.addUser('frei@example.org');
 const paid=h.addUser('zahlt@example.org');
 const leaving=h.addUser('kuendigt@example.org');
 const late=h.addUser('offen@example.org');
 const tester=h.addUser('test@example.org');
 const admin=h.addUser('chef@example.org',{tier:'enterprise',admin:true});
 h.addUser('gesperrt@example.org',{status:'blocked'});
 h.accounts.sql.prepare("INSERT INTO plan_grants(user_id,tier,source,starts_at,ends_at) VALUES(?,'pro','beta',?,?)").run(tester,iso(h.now()-DAY),iso(h.now()+30*DAY));
 subscriptionRow(h,{id:'sub_paid',userId:paid,startedAt:'2026-10-01T09:00:00.000Z',lastPaidAt:'2026-10-01T09:00:05.000Z'});
 subscriptionRow(h,{id:'sub_leave',userId:leaving,cancelAt:iso(h.now()+20*DAY)});
 subscriptionRow(h,{id:'sub_late',userId:late,status:'past_due'});
 h.accounts.sql.prepare("INSERT INTO saved_searches(id,user_id,name,signature,ui_state,position,created_at,updated_at,notify_mail) VALUES('s1',?,'A','sig','{}',0,?,?,1)").run(paid,iso(h.now()),iso(h.now()));
 h.accounts.sql.prepare("UPDATE users SET created_at=? WHERE id=?").run(iso(h.now()-60*DAY),free);

 const view=await accountsOverview(readOnly(h.cfg.db),{now:h.now()});
 assert.equal(view.summary.accounts,7);
 assert.equal(view.summary.rows,7);
 assert.deepEqual(view.summary.tiers,{pro:3,enterprise:1,basic:3},'zahlend, gekündigt und Test sind Plus; offen fällt ohne gültige Zeile auf kostenlos');
 assert.equal(view.summary.paid,1);assert.equal(view.summary.canceling,1);assert.equal(view.summary.due,1);
 assert.equal(view.summary.blocked,1);assert.equal(view.summary.admins,1);
 assert.equal(view.summary.new7,6);assert.equal(view.summary.new30,6);
 assert.ok(!JSON.stringify(view).includes('@example.org'),'keine volle Adresse in der Antwort');

 const row=id=>view.rows.find(r=>r.id===id);
 assert.equal(row(paid).email,'za•••@e•••.org');
 assert.equal(row(paid).tier,'pro');assert.equal(row(paid).tierSource,'stripe');assert.equal(row(paid).payment,'paid');
 assert.equal(row(paid).subscription.startedAt,'2026-10-01T09:00:00.000Z');assert.equal(row(paid).subscription.lastPaidAt,'2026-10-01T09:00:05.000Z');
 assert.equal(row(paid).searches,1);assert.equal(row(paid).alerts,1);
 assert.equal(row(leaving).payment,'canceling');
 assert.equal(row(late).payment,'due');assert.equal(row(late).tier,'basic');
 assert.equal(row(tester).tierSource,'beta');assert.equal(row(tester).payment,null);
 assert.deepEqual(row(admin).roles,['admin']);
 assert.equal(row(free).tier,'basic');
});

test('Volle Adresse auf Klick und über die genaue Suche, jeder Abruf im Admin-Protokoll',async()=>{
 const h=setup();
 const id=h.addUser('person@example.org');
 h.accounts.sql.prepare("UPDATE users SET name='Erika Muster' WHERE id=?").run(id);
 const audit=()=>h.accounts.sql.prepare('SELECT user_id,path,action,target FROM admin_audit ORDER BY id').all().map(r=>({...r}));

 assert.deepEqual(await revealAccount(h.cfg.db,{adminId:'u_admin',id,now:h.now()}),{id,email:'person@example.org',name:'Erika Muster'});
 assert.equal(await revealAccount(h.cfg.db,{adminId:'u_admin',id:'u_gibtsnicht',now:h.now()}),null);
 assert.deepEqual((await findAccount(h.cfg.db,{adminId:'u_admin',email:' Person@Example.org ',now:h.now()})).id,id);
 assert.equal(await findAccount(h.cfg.db,{adminId:'u_admin',email:'niemand@example.org',now:h.now()}),null);
 assert.equal(await findAccount(h.cfg.db,{adminId:'u_admin',email:'kein-adresse',now:h.now()}),undefined);
 assert.deepEqual(audit(),[
  {user_id:'u_admin',path:'/api/admin/accounts',action:'reveal',target:id},
  {user_id:'u_admin',path:'/api/admin/accounts',action:'search',target:id},
  {user_id:'u_admin',path:'/api/admin/accounts',action:'search-miss',target:null},
 ]);
 assert.ok(!audit().some(r=>JSON.stringify(r).includes('@')),'das Protokoll enthält keine Adressen');
});

test('Abgleich übernimmt Abo-Beginn, Kündigungszeitpunkt und letzte Zahlung von Stripe',async()=>{
 const h=setup({extraEnv:{STRIPE_SECRET_KEY:'sk_test_x',STRIPE_WEBHOOK_SECRET:'whsec_x',STRIPE_PRICE_PLUS:'price_x'}});
 const userId=h.addUser('abo@example.org');
 const s=sec=>Math.floor(sec/1000);
 const sub={id:'sub_1',customer:'cus_1',status:'active',livemode:false,metadata:{user_id:userId},start_date:s(h.now()-10*DAY),canceled_at:s(h.now()),cancel_at:s(h.now()+20*DAY),
  items:{data:[{current_period_end:s(h.now()+20*DAY),price:{id:'price_x'}}]},latest_invoice:{status:'paid',status_transitions:{paid_at:s(h.now()-10*DAY)}}};
 await syncSubscription({db:h.cfg.db,cfg:h.cfg,now:h.now()},sub);
 const row=()=>({...h.accounts.sql.prepare('SELECT started_at,canceled_at,last_paid_at,cancel_at FROM subscriptions').get()});
 assert.deepEqual(row(),{started_at:iso(s(h.now()-10*DAY)*1000),canceled_at:iso(s(h.now())*1000),last_paid_at:iso(s(h.now()-10*DAY)*1000),cancel_at:iso(s(h.now()+20*DAY)*1000)});
 // Ohne aufgelöste Rechnung (Antwort auf DELETE) bleibt die letzte Zahlung; Rücknahme der Kündigung leert canceled_at
 await syncSubscription({db:h.cfg.db,cfg:h.cfg,now:h.now()},{...sub,canceled_at:null,cancel_at:null,latest_invoice:'in_1'});
 assert.equal(row().last_paid_at,iso(s(h.now()-10*DAY)*1000));
 assert.equal(row().canceled_at,null);
});
