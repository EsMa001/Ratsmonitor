// Kündigungsbutton nach § 312k BGB (Seite /kuendigen, POST /api/billing/cancel): ohne Anmeldung und ständig erreichbar
// (Link „Verträge hier kündigen“ in der Fußzeile jeder Seite). Die Bestätigungsseite fragt nur ab, was § 312k Abs. 2 nennt:
// Art der Kündigung (bei außerordentlicher der Grund), Identifizierung über die E-Mail-Adresse des Kontos, Vertrag, Zeitpunkt
// und Adresse für die Bestätigung (dieselbe). Antwort und synchrone Arbeit sind für jede Adresse gleich (kein Rückschluss,
// ob es ein Konto gibt); alles Adressabhängige läuft danach (later): Abo bei Stripe zum gewünschten Zeitpunkt beenden,
// Nachweis in cancellations, Bestätigung in Textform per Mail (Abs. 4: Inhalt, Eingang mit Datum und Uhrzeit, Vertragsende).
import {AccountError,respond,requireSameOrigin,readJson} from './http.mjs';
import {hmacHex} from './crypto.mjs';
import {limited,limitedAll} from './rate-limit.mjs';
import {sendMail,processOutbox} from './mail.mjs';
import {siteBase} from './config.mjs';
import {normalizeEmail} from './login.mjs';
import {billingReady,stripeApi,syncSubscription,tierOfPrice,RUNNING} from './billing.mjs';
import {TIER_LABEL} from '../../shared/plans.mjs';

const DAY=86400000;
const iso=ms=>new Date(ms).toISOString();
export const CONTRACT='Plenara-Abo (Plus oder Pro)';

/** Eingaben prüfen; ungültig → 400 mit Hinweis für das Formular */
export function cleanCancellation(body,{now=Date.now()}={}){
 const email=normalizeEmail(body?.email);
 if(!email)throw new AccountError(400,'Bitte die E-Mail-Adresse Ihres Kontos angeben.',{field:'email'});
 const kind=body?.kind==='extraordinary'?'extraordinary':'ordinary';
 const reason=typeof body?.reason==='string'?body.reason.trim().slice(0,2000):'';
 if(kind==='extraordinary'&&!reason)throw new AccountError(400,'Bitte den Grund der außerordentlichen Kündigung angeben.',{field:'reason'});
 const when=body?.when==='date'?'date':'next';
 let date=null;
 if(when==='date'){
  date=typeof body?.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(body.date)?body.date:null;
  if(!date||Number.isNaN(Date.parse(date+'T00:00:00Z'))||date<iso(now).slice(0,10))throw new AccountError(400,'Bitte ein Datum ab heute angeben.',{field:'date'});
 }
 return {email,kind,reason:kind==='extraordinary'?reason:'',when,date};
}

/**
 * Kündigung ausführen (nach der Antwort). Laufendes Abo der Adresse: ordentlich zum Periodenende oder zum späteren Wunschtag
 * (bis dahin verlängert es sich wie gewohnt); außerordentlich ebenfalls spätestens zum Periodenende ohne weitere Abbuchung,
 * den Grund prüft der Betreiber (Mail an OPERATOR_EMAIL). Ergebnis: canceled, review, none (kein laufendes Abo), error.
 */
export async function processCancellation(ctx,input,{receivedAt,site}){
 const {db,cfg,now}=ctx;
 const user=await db.prepare("SELECT id FROM users WHERE email=? AND status='active'").bind(input.email).first();
 const sub=user?await db.prepare(`SELECT id,price_id,period_end FROM subscriptions WHERE user_id=? AND status IN (${RUNNING.map(s=>`'${s}'`).join(',')})
   ORDER BY updated_at DESC LIMIT 1`).bind(user.id).first():null;
 let result='none',endsAt=null;
 if(sub){
  const periodEnd=Date.parse(sub.period_end);
  const wanted=input.when==='date'?Date.parse(input.date+'T23:59:59Z'):null;
  const later=input.kind==='ordinary'&&wanted&&wanted>periodEnd;
  endsAt=later?wanted:periodEnd;
  try{
   if(!billingReady(cfg))throw new Error('Bezahlung nicht eingerichtet');
   const updated=await stripeApi(cfg,'POST','subscriptions/'+encodeURIComponent(sub.id),later?{cancel_at:Math.floor(wanted/1000),proration_behavior:'none'}:{cancel_at_period_end:true});
   await syncSubscription(ctx,updated);
   result=input.kind==='extraordinary'?'review':'canceled';
  }catch(error){
   console.error('[konten] Kündigung nicht bei Stripe eingetragen:',error instanceof Error?error.message:String(error));
   result='error';
  }
 }
 await db.prepare('INSERT INTO cancellations(received_at,email_hmac,user_id,kind,reason,wanted,subscription_id,ends_at,result) VALUES(?,?,?,?,?,?,?,?,?)')
  .bind(receivedAt,await hmacHex(cfg.secret,'cancellation',input.email),user?.id??null,input.kind,input.reason||null,input.date??'next',sub?.id??null,endsAt?iso(endsAt):null,result).run();
 // Bestätigung immer, auch ohne Konto (sonst verriete das Ausbleiben, ob es eines gibt); nicht abbestellbar
 await sendMail(db,cfg,{to:input.email,template:'cancel_received',userId:user?.id??null,quota:'account',now,
  data:{receivedAt,tier:sub?TIER_LABEL[tierOfPrice(cfg,sub.price_id)]:null,kind:input.kind,reason:input.reason,when:input.when,date:input.date,result,endsAt:endsAt?iso(endsAt):null}});
 if(cfg.mail.operator&&(result==='review'||result==='error'))await sendMail(db,cfg,{to:cfg.mail.operator,template:'operator',quota:'operator',now,
  data:{message:result==='review'?`Außerordentliche Kündigung eingegangen (Konto ${user.id}, Abo ${sub.id}). Das Abo endet spätestens am ${iso(endsAt).slice(0,10)}. Grund: ${input.reason}`
   :`Kündigung konnte nicht bei Stripe eingetragen werden (Konto ${user?.id}, Abo ${sub?.id}). Bitte von Hand im Dashboard kündigen.`}});
 if(site)await processOutbox(db,cfg,{site,now});
 return {result,endsAt};
}

/** POST /api/billing/cancel: ohne Sitzung, gleiche Herkunft und JSON; Antwort {ok, receivedAt} für jede Adresse gleich */
export async function cancelRoute(ctx){
 requireSameOrigin(ctx.request);
 if(limitedAll('cancel',ctx.ip,[{max:5,windowMs:15*60000},{max:20,windowMs:DAY}],ctx.now))throw new AccountError(429,'Zu viele Kündigungen von diesem Anschluss. Bitte später erneut versuchen.');
 const input=cleanCancellation(await readJson(ctx.request,8192),{now:ctx.now});
 const receivedAt=iso(ctx.now),site=siteBase(ctx.cfg,ctx.request);
 // Je Adresse höchstens 3 Bestätigungen am Tag (sonst ließe sich ein Postfach zumüllen); die Antwort bleibt gleich
 const emailKey=await hmacHex(ctx.cfg.secret,'cancellation',input.email);
 const later=limited('cancel-mail',emailKey,{max:3,windowMs:DAY,now:ctx.now})?[]:[()=>processCancellation(ctx,input,{receivedAt,site})];
 return {response:respond({ok:true,receivedAt,contract:CONTRACT,...input}),later};
}
