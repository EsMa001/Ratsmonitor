// Bezahlung über Stripe (requirements/konten-konzept.md 9.1, requirements/zahlungsdienste-recherche-2026-10-26.md,
// Einrichtung docs/betrieb/stripe-test.md). Gehosteter Checkout und Kundenportal: Karten- und Kontodaten berühren den
// Server nie. Freigeschaltet wird nur über eine signaturgeprüfte Meldung (Webhook) oder den Abgleich; beide rufen das Abo
// bei Stripe neu ab und führen eine Zeile je Abo in plan_grants (source='stripe', ref = Abo-ID). Die Rückkehr aus dem
// Checkout schaltet nichts frei. Ohne Stripe-Bibliothek: REST über fetch, Signatur über WebCrypto.
import {AccountError,respond,requireSameOrigin,readText} from './http.mjs';
import {readSession,rolesOf} from './sessions.mjs';
import {siteBase} from './config.mjs';
import {limited} from './rate-limit.mjs';

const API='https://api.stripe.com/v1/';
/** Feste API-Fassung aller Abrufe. Von einer Meldung zählen nur ID und Art; das Abo wird in dieser Fassung neu abgerufen. */
export const STRIPE_VERSION='2025-09-30.clover';
const DAY=86400000;
/** Kulanz nach dem bezahlten Zeitraum: Stripe bucht am Periodenende ab und wiederholt Fehlschläge */
export const GRACE_MS=3*DAY;
/** Abo läuft und wird weiter abgebucht */
export const RUNNING=['active','trialing','past_due'];
const ENDED=['canceled','incomplete_expired','unpaid'];
/** Verarbeitete Meldungen; alle anderen werden nur quittiert */
export const EVENTS=['checkout.session.completed','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted',
 'invoice.paid','invoice.payment_failed','charge.dispute.created'];
const TIER='pro';
const iso=ms=>new Date(ms).toISOString();
const enc=new TextEncoder();
const idOf=value=>typeof value==='string'?value:value?.id??null;

/** Eingerichtet: Schlüssel, Meldungsgeheimnis und Preis; Testschlüssel, Live-Schlüssel nur mit STRIPE_LIVE=1 */
export function billingReady(cfg){
 const b=cfg?.billing;
 if(!b?.secretKey||!b.webhookSecret||!b.price)return false;
 return (b.live?/^(sk|rk)_live_/:/^(sk|rk)_test_/).test(b.secretKey);
}
/** Darf ein Konto mit diesen Rollen buchen? Mit STRIPE_ADMINS_ONLY=1 (Testmodus auf dem Server) nur Admins */
export const billingFor=(cfg,roles)=>billingReady(cfg)&&(!cfg.billing.adminsOnly||roles.includes('admin'));
function requireBilling(cfg){
 if(!billingReady(cfg))throw new AccountError(503,'Bezahlung ist auf diesem Server nicht eingerichtet.');
 return cfg.billing;
}

// ---------------------------------------------------------------- Stripe-API
/** Parameter im Format der Stripe-API: line_items[0][price]=… */
export function formEncode(params,out=new URLSearchParams(),prefix=''){
 for(const [key,value] of Object.entries(params||{})){
  if(value===undefined||value===null)continue;
  const name=prefix?`${prefix}[${key}]`:key;
  if(typeof value==='object')formEncode(Array.isArray(value)?Object.fromEntries(value.map((v,i)=>[i,v])):value,out,name);
  else out.append(name,String(value));
 }
 return out;
}
export async function stripeApi(cfg,method,path,params){
 const get=method==='GET';
 const response=await fetch(API+path+(get&&params?'?'+formEncode(params):''),{method,
  headers:{Authorization:'Bearer '+cfg.billing.secretKey,'Stripe-Version':STRIPE_VERSION,...(get?{}:{'Content-Type':'application/x-www-form-urlencoded'})},
  body:get?undefined:formEncode(params).toString()});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(`Stripe ${method} ${path}: ${response.status} ${String(data?.error?.message||data?.error?.type||'').slice(0,200)}`.trim());
 return data;
}
const fetchSubscription=(ctx,id)=>stripeApi(ctx.cfg,'GET','subscriptions/'+encodeURIComponent(id),{expand:['latest_invoice']});

// ---------------------------------------------------------------- Signatur der Meldungen
async function hmacHex(secret,text){
 const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(text)))].map(n=>n.toString(16).padStart(2,'0')).join('');
}
const sameText=(a,b)=>{if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;};
/** Kopfzeile Stripe-Signature „t=…,v1=…“: HMAC-SHA256 über „t.Rohtext“, Zeitstempel höchstens 5 Minuten alt */
export async function verifySignature(raw,header,secret,{now=Date.now(),toleranceS=300}={}){
 const pairs=String(header||'').split(',').map(p=>{const i=p.indexOf('=');return [p.slice(0,i).trim(),p.slice(i+1).trim()];});
 const t=Number(pairs.find(([k])=>k==='t')?.[1]);
 const signatures=pairs.filter(([k])=>k==='v1').map(([,v])=>v);
 if(!secret||!Number.isInteger(t)||!signatures.length||Math.abs(now/1000-t)>toleranceS)return false;
 const expected=await hmacHex(secret,`${t}.${raw}`);
 return signatures.some(s=>sameText(s,expected));
}
/** Signatur, wie Stripe sie bildet (Tests) */
export const signPayload=async(raw,secret,t)=>`t=${t},v1=${await hmacHex(secret,`${t}.${raw}`)}`;

// ---------------------------------------------------------------- Abo und Freischaltung
const customerOf=async(db,userId)=>(await db.prepare('SELECT customer_id FROM billing_customers WHERE user_id=?').bind(userId).first())?.customer_id??null;
const RUNNING_SQL=`status IN (${RUNNING.map(s=>`'${s}'`).join(',')})`;
/** Laufendes Abo eines Kontos (auch gekündigt zum Periodenende) oder null */
export const runningSubscription=(db,userId)=>
 db.prepare(`SELECT id,status,period_end,cancel_at FROM subscriptions WHERE user_id=? AND ${RUNNING_SQL} ORDER BY updated_at DESC LIMIT 1`).bind(userId).first();
/** Für /api/me: Stand des Abos, ob es einen Stripe-Kunden gibt (Portal) und ob Testmodus */
export async function billingState(db,userId,cfg){
 const sub=await db.prepare(`SELECT status,period_end,cancel_at FROM subscriptions WHERE user_id=? ORDER BY ${RUNNING_SQL} DESC,updated_at DESC LIMIT 1`).bind(userId).first();
 return {test:!cfg.billing.live,customer:!!(await customerOf(db,userId)),
  subscription:sub?{status:sub.status,periodEnd:sub.period_end,cancelAt:sub.cancel_at}:null};
}
async function linkCustomer(ctx,userId,customerId,livemode){
 if(!(await ctx.db.prepare('SELECT 1 FROM users WHERE id=?').bind(userId).first()))return null;
 await ctx.db.prepare(`INSERT INTO billing_customers(user_id,customer_id,livemode,created_at) VALUES(?,?,?,?)
   ON CONFLICT(user_id) DO UPDATE SET customer_id=excluded.customer_id,livemode=excluded.livemode`).bind(userId,customerId,livemode?1:0,iso(ctx.now)).run();
 return userId;
}
const periodEndOf=sub=>{
 const ends=[...(sub.items?.data||[]).map(i=>i.current_period_end),sub.current_period_end].filter(Number.isFinite);
 return ends.length?Math.max(...ends)*1000:null;
};
/** Letzte Rechnung bezahlt; ohne aufgelöste Rechnung (nicht mit expand abgerufen) zählt der Status allein */
const latestPaid=sub=>typeof sub.latest_invoice!=='object'||!sub.latest_invoice||sub.latest_invoice.status==='paid';

/**
 * Stand eines Abos übernehmen (Objekt frisch von Stripe). Bezahlt und aktiv: Freischaltung bis Periodenende plus Kulanz.
 * Beendet: Freischaltung endet mit dem Abo. Offen oder überfällig: nichts verlängern, die Zeile läuft von selbst aus.
 * Abos ohne Plenara-Konto (anderer Ursprung, Konto gelöscht) werden übersprungen.
 */
export async function syncSubscription(ctx,sub){
 const {db,now}=ctx;
 const customer=idOf(sub.customer);
 let userId=(await db.prepare('SELECT user_id FROM billing_customers WHERE customer_id=?').bind(customer).first())?.user_id;
 if(!userId&&sub.metadata?.user_id)userId=await linkCustomer(ctx,sub.metadata.user_id,customer,sub.livemode);
 if(!userId)return {skipped:true};
 const periodEnd=periodEndOf(sub),endedAt=sub.ended_at?sub.ended_at*1000:null;
 // Das Kundenportal kündigt über cancel_at (Zeitpunkt), ältere Wege über cancel_at_period_end
 const cancelAt=sub.cancel_at?sub.cancel_at*1000:sub.cancel_at_period_end?periodEnd:null;
 const seconds=value=>Number.isFinite(value)&&value>0?iso(value*1000):null;
 // Letzte Zahlung nur aus einer aufgelösten Rechnung (expand); sonst bleibt der bekannte Wert
 const paidAt=typeof sub.latest_invoice==='object'&&sub.latest_invoice?.status==='paid'?seconds(sub.latest_invoice.status_transitions?.paid_at):null;
 const statements=[db.prepare(`INSERT INTO subscriptions(id,user_id,customer_id,status,price_id,period_end,cancel_at,ended_at,livemode,updated_at,
   started_at,canceled_at,last_paid_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id,
   customer_id=excluded.customer_id,status=excluded.status,price_id=excluded.price_id,period_end=excluded.period_end,cancel_at=excluded.cancel_at,
   ended_at=excluded.ended_at,livemode=excluded.livemode,updated_at=excluded.updated_at,started_at=coalesce(excluded.started_at,subscriptions.started_at),
   canceled_at=excluded.canceled_at,last_paid_at=coalesce(excluded.last_paid_at,subscriptions.last_paid_at)`)
  .bind(sub.id,userId,customer,sub.status,idOf(sub.items?.data?.[0]?.price),periodEnd?iso(periodEnd):null,cancelAt?iso(cancelAt):null,
   endedAt?iso(endedAt):null,sub.livemode?1:0,iso(now),seconds(sub.start_date),seconds(sub.canceled_at),paidAt)];
 const grant=await db.prepare("SELECT id,ends_at FROM plan_grants WHERE source='stripe' AND ref=?").bind(sub.id).first();
 if(['active','trialing'].includes(sub.status)&&periodEnd&&latestPaid(sub)){
  const ends=iso(periodEnd+GRACE_MS);
  statements.push(grant
   ?db.prepare('UPDATE plan_grants SET user_id=?,ends_at=? WHERE id=?').bind(userId,ends,grant.id)
   :db.prepare("INSERT INTO plan_grants(user_id,tier,source,starts_at,ends_at,ref,note,created_by) VALUES(?,?,'stripe',?,?,?,'Stripe-Abo','stripe')")
    .bind(userId,TIER,iso(now),ends,sub.id));
 }else if(ENDED.includes(sub.status)&&grant){
  const end=endedAt??now;
  if(grant.ends_at===null||Date.parse(grant.ends_at)>end)statements.push(db.prepare('UPDATE plan_grants SET ends_at=? WHERE id=?').bind(iso(end),grant.id));
 }
 await db.batch(statements);
 return {userId,status:sub.status};
}
/** Anfechtung oder Rücklastschrift: laufende Abos des Kunden sofort beenden, die Freischaltung endet jetzt */
async function disputed(ctx,dispute){
 const charge=await stripeApi(ctx.cfg,'GET','charges/'+encodeURIComponent(idOf(dispute.charge)));
 const customer=idOf(charge.customer);
 if(!customer)return;
 const {results}=await ctx.db.prepare(`SELECT id FROM subscriptions WHERE customer_id=? AND ${RUNNING_SQL}`).bind(customer).all();
 for(const row of results||[])await syncSubscription(ctx,await stripeApi(ctx.cfg,'DELETE','subscriptions/'+encodeURIComponent(row.id)));
 const userId=(await ctx.db.prepare('SELECT user_id FROM billing_customers WHERE customer_id=?').bind(customer).first())?.user_id;
 if(userId)await ctx.db.prepare("UPDATE plan_grants SET ends_at=? WHERE source='stripe' AND user_id=? AND (ends_at IS NULL OR ends_at>?)").bind(iso(ctx.now),userId,iso(ctx.now)).run();
}
export async function handleEvent(ctx,event){
 const object=event.data?.object||{};
 switch(event.type){
  case 'checkout.session.completed':
   if(object.mode!=='subscription')return;
   if(object.customer&&object.client_reference_id)await linkCustomer(ctx,object.client_reference_id,idOf(object.customer),object.livemode);
   if(object.subscription)await syncSubscription(ctx,await fetchSubscription(ctx,idOf(object.subscription)));
   return;
  case 'invoice.paid':
  case 'invoice.payment_failed':{
   const invoice=await stripeApi(ctx.cfg,'GET','invoices/'+encodeURIComponent(object.id));
   const id=idOf(invoice.parent?.subscription_details?.subscription??invoice.subscription);
   if(id)await syncSubscription(ctx,await fetchSubscription(ctx,id));
   return;
  }
  case 'charge.dispute.created':
   return disputed(ctx,object);
  default:
   if(object.id)await syncSubscription(ctx,await fetchSubscription(ctx,object.id));
 }
}
/** Abgleich (täglich, scripts/billing/reconcile.mjs): alle Abos des Stripe-Kontos neu übernehmen, fängt verpasste Meldungen auf */
export async function reconcile(ctx){
 requireBilling(ctx.cfg);
 let after=null,seen=0,linked=0;
 do{
  const page=await stripeApi(ctx.cfg,'GET','subscriptions',{status:'all',limit:100,expand:['data.latest_invoice'],...(after?{starting_after:after}:{})});
  for(const sub of page.data||[]){seen++;if(!(await syncSubscription(ctx,sub)).skipped)linked++;}
  after=page.has_more&&page.data?.length?page.data.at(-1).id:null;
 }while(after);
 return {seen,linked};
}

// ---------------------------------------------------------------- Routen
async function requireSession(ctx){
 requireSameOrigin(ctx.request);
 const session=await readSession(ctx.db,ctx.cookies.get(ctx.names.session),{now:ctx.now});
 if(!session)throw new AccountError(401,'Bitte anmelden.');
 if(!billingFor(ctx.cfg,await rolesOf(ctx.db,session.user_id)))throw new AccountError(403,'Plus lässt sich auf diesem Server noch nicht buchen.');
 if(limited('billing',session.user_id,{max:10,windowMs:15*60000,now:ctx.now}))throw new AccountError(429,'Zu viele Versuche. Bitte kurz warten.');
 return session;
}
function site(ctx){
 const base=siteBase(ctx.cfg,ctx.request);
 if(!base)throw new AccountError(503,'Bezahlung ist auf diesem Server nicht vollständig eingerichtet.');
 return base;
}
/** POST /api/billing/checkout: Bezahlseite von Stripe für Plus, Antwort {url}. Freigeschaltet wird erst per Meldung. */
export async function checkout(ctx){
 const b=requireBilling(ctx.cfg);
 const session=await requireSession(ctx);
 if(await runningSubscription(ctx.db,session.user_id))throw new AccountError(409,'Plus ist bereits gebucht. Ändern oder kündigen können Sie es unter „Abo verwalten“.');
 const base=site(ctx),customer=await customerOf(ctx.db,session.user_id);
 const created=await stripeApi(ctx.cfg,'POST','checkout/sessions',{
  mode:'subscription',line_items:[{price:b.price,quantity:1}],locale:'de',
  client_reference_id:session.user_id,metadata:{user_id:session.user_id},subscription_data:{metadata:{user_id:session.user_id}},
  ...(customer?{customer}:{customer_email:session.email}),
  success_url:base+'/konto/profil?zahlung=pruefen',cancel_url:base+'/konto/profil?zahlung=abgebrochen',
 });
 if(typeof created.url!=='string')throw new Error('Stripe: Checkout ohne Adresse');
 return {response:respond({url:created.url})};
}
/** POST /api/billing/portal: Kundenportal von Stripe (kündigen, Zahlart, Rechnungen), Antwort {url} */
export async function portal(ctx){
 const b=requireBilling(ctx.cfg);
 const session=await requireSession(ctx);
 const customer=await customerOf(ctx.db,session.user_id);
 if(!customer)throw new AccountError(404,'Für dieses Konto gibt es noch kein Abo.');
 const created=await stripeApi(ctx.cfg,'POST','billing_portal/sessions',{customer,return_url:site(ctx)+'/konto/profil',locale:'de',configuration:b.portalConfig});
 if(typeof created.url!=='string')throw new Error('Stripe: Portal ohne Adresse');
 return {response:respond({url:created.url})};
}
/**
 * POST /api/billing/webhook: Meldung von Stripe, ohne Sitzung und ohne gleiche Herkunft; berechtigt ist nur die Signatur.
 * Jede Meldung wird einmal verarbeitet (billing_events). Scheitert die Verarbeitung, antwortet die Route mit einem Fehler
 * und Stripe stellt die Meldung bis zu drei Tage lang erneut zu.
 */
export async function webhook(ctx){
 if(ctx.request.method!=='POST')throw new AccountError(405,'Methode nicht erlaubt.');
 const b=requireBilling(ctx.cfg);
 const raw=await readText(ctx.request,512*1024);
 if(!(await verifySignature(raw,ctx.request.headers.get('stripe-signature'),b.webhookSecret,{now:ctx.now})))throw new AccountError(400,'Signatur ungültig.');
 let event;
 try{event=JSON.parse(raw);}catch{event=null;}
 if(typeof event?.id!=='string'||typeof event.type!=='string')throw new AccountError(400,'Ungültige Meldung.');
 if(!!event.livemode!==b.live||!EVENTS.includes(event.type))return {response:respond({received:true,ignored:true})};
 const {db,now}=ctx;
 const seen=await db.prepare('SELECT done_at FROM billing_events WHERE id=?').bind(event.id).first();
 if(seen?.done_at)return {response:respond({received:true,duplicate:true})};
 if(!seen)await db.prepare('INSERT INTO billing_events(id,type,received_at) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING').bind(event.id,event.type,iso(now)).run();
 try{await handleEvent(ctx,event);}
 catch(error){
  await db.prepare('UPDATE billing_events SET error=? WHERE id=?').bind(String(error?.message||error).slice(0,300),event.id).run();
  throw error;
 }
 await db.prepare('UPDATE billing_events SET done_at=?,error=NULL WHERE id=?').bind(iso(now),event.id).run();
 return {response:respond({received:true})};
}
