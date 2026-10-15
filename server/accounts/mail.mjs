// Postausgang der Kontomails (requirements/konten-konzept.md, Abschnitt 10). sendMail schreibt eine Zeile in
// mail_outbox; processOutbox verschickt fällige Zeilen (nach der Antwort per after(), jede Minute über
// /api/internal/outbox und beim Start). Nach dem Versand werden Adresse und Inhalt gelöscht.
import {render} from './mail-templates.mjs';

const iso=ms=>new Date(ms).toISOString();
export const QUOTA_PER_HOUR={login:100,signup:20,account:50};
const RETRY_MS=[10000,60000];
const MAX_ATTEMPTS=3;

/**
 * Mail in den Postausgang. Ist das Kontingent der Stunde erschöpft, wird nichts eingereiht ({queued:false}),
 * höchstens einmal je Stunde geht eine Warnung an OPERATOR_EMAIL (zählt nicht mit).
 */
export async function sendMail(db,cfg,{to,template,data=null,userId=null,quota,discardAfterMs=null,now=Date.now()}){
 if(quota!=='operator'){
  const row=await db.prepare('SELECT count(*) n FROM mail_outbox WHERE quota=? AND created_at>?').bind(quota,iso(now-3600000)).first();
  if(Number(row?.n||0)>=QUOTA_PER_HOUR[quota]){
   console.warn(`[konten] Mailkontingent ${quota} erschöpft, Mail ${template} nicht eingereiht`);
   await warnOperator(db,cfg,`Das Mailkontingent „${quota}“ (${QUOTA_PER_HOUR[quota]} je Stunde) ist erschöpft. Weitere Mails dieser Art werden in dieser Stunde nicht verschickt.`,now);
   return {queued:false};
  }
 }
 const row=await db.prepare('INSERT INTO mail_outbox(created_at,user_id,"to",template,data,status,attempts,next_at,discard_after,quota) VALUES(?,?,?,?,?,?,0,?,?,?) RETURNING id')
  .bind(iso(now),userId,to,template,data?JSON.stringify(data):null,'queued',iso(now),discardAfterMs?iso(now+discardAfterMs):null,quota).first();
 return {queued:true,id:row?.id};
}
export async function warnOperator(db,cfg,message,now=Date.now()){
 if(!cfg.mail.operator)return;
 const recent=await db.prepare("SELECT 1 x FROM mail_outbox WHERE quota='operator' AND created_at>? LIMIT 1").bind(iso(now-3600000)).first();
 if(recent)return;
 await sendMail(db,cfg,{to:cfg.mail.operator,template:'operator',data:{message},quota:'operator',now});
}

/** Fällige Mails verschicken. Gibt Zahlen zurück; wirft nie wegen eines einzelnen Fehlers. */
/** @param {{site?:string,now?:number,limit?:number,fetchImpl?:typeof fetch}} [options] */
export async function processOutbox(db,cfg,options={}){
 const {site,now=Date.now(),limit=20,fetchImpl=globalThis.fetch}=options;
 const at=iso(now);
 // Zeilen, die beim Senden hängen blieben (Prozess beendet), nach zwei Minuten erneut versuchen
 await db.prepare("UPDATE mail_outbox SET status='queued' WHERE status='sending' AND next_at<?").bind(iso(now-120000)).run();
 await db.prepare("UPDATE mail_outbox SET status='dropped',\"to\"=NULL,data=NULL WHERE status='queued' AND discard_after IS NOT NULL AND discard_after<?").bind(at).run();
 const {results}=await db.prepare("SELECT id FROM mail_outbox WHERE status='queued' AND next_at<=? ORDER BY id LIMIT ?").bind(at,limit).all();
 const counts={sent:0,failed:0,retry:0};
 for(const {id} of results||[]){
  const row=await db.prepare("UPDATE mail_outbox SET status='sending',attempts=attempts+1,next_at=? WHERE id=? AND status='queued' RETURNING \"to\",template,data,attempts").bind(at,id).first();
  if(!row)continue;
  try{
   if(!site)throw new Error('SITE_URL fehlt');
   const message=render(row.template,row.data?JSON.parse(row.data):{},{site});
   const ref=await deliver(db,cfg,{to:row.to,...message},{fetchImpl,now});
   await db.prepare("UPDATE mail_outbox SET status='sent',provider_ref=?,\"to\"=NULL,data=NULL WHERE id=?").bind(ref?String(ref).slice(0,200):null,id).run();
   counts.sent++;
  }catch(error){
   const last=row.attempts>=MAX_ATTEMPTS;
   console.warn(`[konten] Mail ${row.template} (#${id}) Versuch ${row.attempts} fehlgeschlagen: ${clean(error)}`);
   await db.prepare(last?"UPDATE mail_outbox SET status='failed',\"to\"=NULL,data=NULL WHERE id=?":"UPDATE mail_outbox SET status='queued',next_at=? WHERE id=?")
    .bind(...(last?[id]:[iso(now+RETRY_MS[Math.min(row.attempts-1,RETRY_MS.length-1)]),id])).run();
   last?counts.failed++:counts.retry++;
  }
 }
 return counts;
}
/** Fehlertexte ohne Adressen und Schlüssel ins Protokoll */
const clean=error=>String(error instanceof Error?error.message:error).replace(/[^\s@]+@[^\s@]+/g,'<adresse>').replace(/(key|token|bearer)\s*[:=]?\s*\S+/gi,'$1 <entfernt>').slice(0,200);

/** Versand je Transport: outbox (Dev-Postfach), log (nur Vorlage und Status), http (REST-API des Anbieters) */
async function deliver(db,cfg,{to,subject,text,html},{fetchImpl,now}){
 const transport=cfg.mail.transport;
 if(transport==='outbox'){
  const r=await db.prepare('INSERT INTO dev_mail(at,"to",subject,text,html) VALUES(?,?,?,?,?) RETURNING id').bind(iso(now),to,subject,text,html).first();
  return 'dev-'+r?.id;
 }
 if(transport==='log'){console.log(`[konten] Mail „${subject}“ (Transport log, nicht verschickt)`);return 'log';}
 if(transport==='http'){
  if(!cfg.mail.apiUrl||!cfg.mail.apiKey)throw new Error('MAIL_API_URL oder MAIL_API_KEY fehlt');
  const response=await fetchImpl(cfg.mail.apiUrl,{method:'POST',signal:AbortSignal.timeout(10000),
   headers:{'Authorization':`Bearer ${cfg.mail.apiKey}`,'Content-Type':'application/json'},
   body:JSON.stringify(providerPayload(cfg,{to,subject,text,html}))});
  if(!response.ok)throw new Error(`Anbieter antwortet ${response.status}`);
  const body=await response.json().catch(()=>({}));
  return body?.id||body?.messageId||body?.message_id||'ok';
 }
 throw new Error('Unbekannter MAIL_TRANSPORT: '+transport);
}
/**
 * Übersetzung in das Format des Anbieters: die einzige Stelle, die beim Wechsel angepasst wird (Entscheidung offen,
 * konten-konzept.md Abschnitt 10). Klick- und Öffnungsverfolgung muss beim Anbieter abgeschaltet sein.
 */
export function providerPayload(cfg,{to,subject,text,html}){
 return {from:cfg.mail.from,to:[to],...(cfg.mail.replyTo?{reply_to:cfg.mail.replyTo}:{}),subject,text,html};
}
