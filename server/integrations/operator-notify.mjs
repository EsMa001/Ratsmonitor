/**
 * Mail an den Betreiber (OPERATOR_EMAIL) aus der Betriebsüberwachung: Fehlermail einer systemd-Einheit
 * (scripts/notify-failure.mjs) und tägliche Sammelmail (scripts/ops-check.mjs). Beide Skripte laufen in Einheiten, die die
 * Kontendatei nicht sehen (requirements/konten-konzept.md 3.2); der Postausgang (mail_outbox) liegt aber dort. Deshalb
 * rufen sie POST /api/internal/notify (Bearer IMPORT_TOKEN) auf, und der Webdienst reiht die Mail hier ein und verschickt
 * sie sofort über den Postausgang (sendMail, processOutbox in server/accounts/mail.mjs). Vorlage 'ops' (mail-templates.mjs),
 * Kontingent 'operator' (ohne Stundengrenze; die Skripte melden sich selten). Ist der Webdienst selbst aus, kommt keine
 * Mail; dafür gibt es die äußere Prüfung über /api/health.
 */
import {sendMail,processOutbox} from '../accounts/mail.mjs';

export const SUBJECT_MAX=200,MESSAGE_MAX=20000;
/** Betreff einzeilig und begrenzt, Text begrenzt (Protokollauszüge können lang sein) */
export function trimNotice({subject,message}){
 return {subject:String(subject??'').replace(/\s+/g,' ').trim().slice(0,SUBJECT_MAX)||'Hinweis',message:String(message??'').slice(0,MESSAGE_MAX)};
}
/**
 * Mail an OPERATOR_EMAIL einreihen und den Postausgang gleich abarbeiten. {sent, reason?, ...Zahlen von processOutbox}.
 * db: Kontendatei (cfg.db); ohne sie oder ohne OPERATOR_EMAIL wird nichts verschickt, der Grund steht in reason.
 */
export async function notifyOperator(db,cfg,{subject,message,site=cfg?.siteUrl,now=Date.now()}){
 if(!db)return {sent:false,reason:'Keine Kontendatei (ACCOUNTS_FILE): dort liegt der Postausgang.'};
 if(!cfg?.mail?.operator)return {sent:false,reason:'OPERATOR_EMAIL fehlt.'};
 if(!site)return {sent:false,reason:'SITE_URL fehlt.'};
 const data=trimNotice({subject,message});
 const queued=await sendMail(db,cfg,{to:cfg.mail.operator,template:'ops',data,quota:'operator',now});
 if(!queued.queued)return {sent:false,reason:'Nicht eingereiht.'};
 const counts=await processOutbox(db,cfg,{site,now});
 return {counts,transport:cfg.mail.transport,sent:counts.sent>0,...(counts.sent>0?{}:{reason:'Versand fehlgeschlagen oder zurückgestellt; Grund im Protokoll des Webdienstes ([konten] Mail …).'})};
}
