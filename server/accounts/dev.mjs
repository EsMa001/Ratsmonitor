// Nur im lokalen Dev-Server (import.meta.env.DEV): Anmelden ohne Mail, Dev-Postfach, Stufe wechseln.
// Im Produktionsbuild antworten die Routen mit 404 (tests/accounts-session.test.mjs).
import {AccountError,respond,requireSameOrigin,readJson,setCookie} from './http.mjs';
import {randomId} from './crypto.mjs';
import {createSession,eventStatement} from './sessions.mjs';
import {currentSession,normalizeEmail} from './login.mjs';
import {validTier} from '../../shared/plans.mjs';
const iso=ms=>new Date(ms).toISOString();
export const DEV_ACCOUNTS=[{email:'basic@plenara.test',tier:'basic'},{email:'pro@plenara.test',tier:'pro'},{email:'enterprise@plenara.test',tier:'enterprise'},{email:'admin@plenara.test',tier:'enterprise',admin:true}];
const devOnly=ctx=>{if(!ctx.cfg.dev)throw new AccountError(404,'Nicht gefunden.');};
export async function devLogin(ctx){
 devOnly(ctx);requireSameOrigin(ctx.request);
 const {email:raw}=await readJson(ctx.request);
 const email=normalizeEmail(raw);
 if(!email)throw new AccountError(400,'Adresse fehlt.');
 const {db,now}=ctx,at=iso(now);
 let user=await db.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
 if(!user){user={id:randomId('u_')};await db.prepare('INSERT INTO users(id,email,email_verified_at,status,created_at) VALUES(?,?,?,?,?)').bind(user.id,email,at,'active',at).run();}
 const session=await createSession(db,{userId:user.id,device:'Dev',now});
 await db.batch([session.statement,eventStatement(db,{userId:user.id,kind:'login',detail:{dev:true},now})]);
 return {response:respond({ok:true},{cookies:[setCookie(ctx.names.session,session.value,{maxAge:session.maxAge,secure:false})]})};
}
export async function devMails(ctx){
 devOnly(ctx);
 const {results}=await ctx.db.prepare('SELECT id,at,"to",subject,text,html FROM dev_mail ORDER BY id DESC LIMIT 50').all();
 return {response:respond({mails:results||[]})};
}
export async function devTier(ctx){
 devOnly(ctx);requireSameOrigin(ctx.request);
 const session=await currentSession(ctx);
 if(!session)throw new AccountError(401,'Bitte anmelden.');
 const {tier}=await readJson(ctx.request);
 const {db,now}=ctx;
 const statements=[db.prepare("DELETE FROM plan_grants WHERE user_id=? AND note='dev'").bind(session.user_id)];
 if(validTier(tier)&&tier!=='guest')statements.push(db.prepare("INSERT INTO plan_grants(user_id,tier,source,starts_at,note,created_by) VALUES(?,?,'manual',?,'dev','dev')").bind(session.user_id,tier,iso(now)));
 await db.batch(statements);
 return {response:respond({ok:true})};
}
