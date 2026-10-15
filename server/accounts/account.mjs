// Kontodaten: gespeicherte Suchen, gemerkte Artikel, Einstellungen, Übernahme aus dem Browser, Datenauskunft und
// Löschen (requirements/konten-konzept.md, Abschnitte 5.4, 5.5, 7, 8). Alle Routen verlangen eine Sitzung;
// ändernde zusätzlich gleiche Herkunft und JSON. Grenzen kommen nur aus der wirksamen Stufe (shared/plans.mjs).
import {randomToken,sha256hex,randomCode,normalizeCode,hmacHex} from './crypto.mjs';
import {AccountError,respond,requireSameOrigin,readJson,setCookie} from './http.mjs';
import {currentSession,accountState} from './login.mjs';
import {eventStatement,effectiveTier} from './sessions.mjs';
import {sendMail,processOutbox} from './mail.mjs';
import {siteBase} from './config.mjs';
import {limited} from './rate-limit.mjs';
import {LIMITS,FEATURES} from '../../shared/plans.mjs';

const iso=ms=>new Date(ms).toISOString();
const DAY=86400000,CODE_MS=15*60000;
/** Höchstzahl gespeicherter Einträge je Konto, aktiv oder nicht */
export const MAX_STORED={searches:500,articles:1000};
const TOKEN_RE=/^[A-Za-z0-9_-]{43}$/;

/** Sitzung und Stufe; ohne Sitzung 401. Schreibende Aufrufe: Herkunft prüfen und je Konto begrenzen. */
export async function requireUser(ctx,{write=false}={}){
 if(write)requireSameOrigin(ctx.request);
 const session=await currentSession(ctx);
 if(!session)throw new AccountError(401,'Bitte anmelden.');
 if(write&&limited('account-write',session.user_id,{max:60,windowMs:60000,now:ctx.now}))throw new AccountError(429,'Zu viele Änderungen in kurzer Zeit. Bitte kurz warten.');
 const state=await accountState(ctx,session);
 return {session,...state,limits:LIMITS[state.tier.tier],features:FEATURES[state.tier.tier]};
}

// ---------------------------------------------------------------- Prüfung der Eingaben (Positivlisten)
const str=(v,max)=>typeof v==='string'&&v.length<=max?v:undefined;
const bool=v=>v===true?true:undefined;
const AGS=/^\d{2,12}$/;
/** SearchSnapshot ohne id, name, notify, created, lastSeen (lib/savedSearch.ts) */
export function cleanState(input){
 if(!input||typeof input!=='object')throw new AccountError(400,'Ungültige Suche.');
 const radius=input.radius&&typeof input.radius==='object'&&AGS.test(String(input.radius.ags))&&Number.isFinite(input.radius.km)&&input.radius.km>=0&&input.radius.km<=500
  ?{ags:String(input.radius.ags),km:input.radius.km,...(Number.isFinite(input.radius.x)?{x:input.radius.x}:{}),...(Number.isFinite(input.radius.y)?{y:input.radius.y}:{})}:null;
 const more=Array.isArray(input.more)?input.more.slice(0,50).filter(m=>m&&AGS.test(String(m.ags))&&['only','with'].includes(m.scope)).map(m=>({ags:String(m.ags),scope:m.scope})):undefined;
 const out={q:str(input.q,500)??'',text:str(input.text,500)??'',area:str(input.area,20)??'',areaSrc:str(input.areaSrc,40)??'',radius,
  thema:str(input.thema,80)??'',monat:str(input.monat,20)??'',von:str(input.von,10),bis:str(input.bis,10),
  scope:['only','with'].includes(input.scope)?input.scope:undefined,more:more?.length?more:undefined,
  status:str(input.status,30)??'',level:['city','district'].includes(input.level)?input.level:undefined,
  future:bool(input.future),noformal:bool(input.noformal),allterms:bool(input.allterms),exact:bool(input.exact)};
 for(const k of Object.keys(out))if(out[k]===undefined)delete out[k];
 const text=JSON.stringify(out);
 if(text.length>8192)throw new AccountError(400,'Suche zu groß.');
 return text;
}
const cleanQuery=q=>typeof q==='string'&&q.length<=2000&&!/[\u0000-\u001f]/.test(q)?q:null;
const cleanName=n=>{const v=typeof n==='string'?n.normalize('NFC').replace(/\s+/g,' ').trim().slice(0,120):'';return v||null;};
const FREQ=['instant','daily','weekly'];
const searchRow=r=>({id:r.id,name:r.name,signature:r.signature,state:JSON.parse(r.ui_state),query:r.query,position:r.position,active:!!r.active,
 notify:{mail:!!r.notify_mail,freq:r.notify_freq||null},created:r.created_at,lastSeen:r.last_seen_at});

// ---------------------------------------------------------------- Gespeicherte Suchen
export async function searchesList(ctx){
 const {session}=await requireUser(ctx);
 const {results}=await ctx.db.prepare('SELECT * FROM saved_searches WHERE user_id=? ORDER BY position,created_at').bind(session.user_id).all();
 return {response:respond({searches:(results||[]).map(searchRow)})};
}
export async function searchesWrite(ctx){
 const user=await requireUser(ctx,{write:true}),uid=user.session.user_id;
 const body=await readJson(ctx.request,16384);
 const {db,now}=ctx,at=iso(now);
 const method=ctx.request.method;
 const id=str(body.id,64);
 if(!id||!/^[A-Za-z0-9_-]{1,64}$/.test(id))throw new AccountError(400,'Ungültige Kennung.');
 if(method==='DELETE'){
  await db.prepare('DELETE FROM saved_searches WHERE user_id=? AND id=?').bind(uid,id).run();
  return {response:respond({ok:true})};
 }
 const signature=str(body.signature,2000);
 if(method==='POST'){
  const name=cleanName(body.name);
  if(!name||!signature)throw new AccountError(400,'Name und Suche fehlen.');
  const state=cleanState(body.state);
  const count=await db.prepare('SELECT count(*) n,coalesce(max(position),-1) last FROM saved_searches WHERE user_id=? AND active=1').bind(uid).first();
  if(Number(count.n)>=user.limits.savedSearches)throw new AccountError(409,'Grenze der gespeicherten Suchen erreicht.',{limit:'savedSearches'});
  const mail=body.notify?.mail===true;
  if(mail)await checkNotifications(ctx,uid,user.limits);
  const r=await db.prepare('INSERT INTO saved_searches(user_id,id,signature,name,ui_state,query,query_version,position,active,notify_mail,notify_freq,created_at,updated_at,last_seen_at) VALUES(?,?,?,?,?,?,1,?,1,?,?,?,?,?) ON CONFLICT DO NOTHING RETURNING id')
   .bind(uid,id,signature,name,state,cleanQuery(body.query),Number(count.last)+1,mail?1:0,FREQ.includes(body.notify?.freq)?body.notify.freq:null,at,at,at).first();
  if(!r)throw new AccountError(409,'Diese Suche ist schon gespeichert.',{duplicate:true});
  return {response:respond({ok:true},{status:201})};
 }
 if(method==='PATCH'){
  const sets=[],args=[];
  if(body.name!==undefined){const name=cleanName(body.name);if(!name)throw new AccountError(400,'Name fehlt.');sets.push('name=?');args.push(name);}
  if(body.state!==undefined){sets.push('ui_state=?','signature=?','query=?');args.push(cleanState(body.state),signature??'',cleanQuery(body.query));if(!signature)throw new AccountError(400,'Signatur fehlt.');}
  if(body.notify!==undefined){
   const mail=body.notify?.mail===true;
   if(mail)await checkNotifications(ctx,uid,user.limits,{search:id});
   sets.push('notify_mail=?','notify_freq=?');args.push(mail?1:0,FREQ.includes(body.notify?.freq)?body.notify.freq:null);
  }
  if(body.seen===true){sets.push('last_seen_at=?');args.push(at);}
  if(Number.isInteger(body.position)&&body.position>=0&&body.position<10000){sets.push('position=?');args.push(body.position);}
  if(!sets.length)throw new AccountError(400,'Nichts zu ändern.');
  sets.push('updated_at=?');args.push(at);
  const r=await db.prepare(`UPDATE saved_searches SET ${sets.join(',')} WHERE user_id=? AND id=?`).bind(...args,uid,id).run().catch(e=>{if(/UNIQUE/i.test(String(e?.message)))throw new AccountError(409,'Diese Suche ist schon gespeichert.',{duplicate:true});throw e;});
  if(!Number(r?.meta?.changes))throw new AccountError(404,'Suche nicht gefunden.');
  return {response:respond({ok:true})};
 }
 throw new AccountError(405,'Methode nicht erlaubt.');
}
/** Benachrichtigungen (Glocke an Artikeln, Mail an Suchen) zählen gemeinsam; in Thema 1 nur Vormerkung */
async function checkNotifications(ctx,uid,limits,{search=null,article=null}={}){
 const row=await ctx.db.prepare(`SELECT (SELECT count(*) FROM saved_searches WHERE user_id=?1 AND active=1 AND notify_mail=1 AND id<>coalesce(?2,''))
  +(SELECT count(*) FROM saved_articles WHERE user_id=?1 AND active=1 AND follow=1 AND topic_id<>coalesce(?3,'')) n`).bind(uid,search,article).first();
 if(Number(row?.n||0)>=limits.notifications)throw new AccountError(409,'Grenze der Benachrichtigungen erreicht.',{limit:'notifications'});
}

// ---------------------------------------------------------------- Gemerkte Artikel
/** Titel, Datum, Gebiet und Status vom Server (search_cards), nie vom Client; zusammengeführte Vorgänge aufgelöst */
export async function articleSnapshots(content,ids,{resolveMax=20}={}){
 const out=new Map();
 if(!content||!ids.length)return out;
 const {results}=await content.prepare('SELECT id,title,date,region_id,status FROM search_cards WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(ids)).all();
 for(const r of results||[])out.set(r.id,{id:r.id,title:r.title,date:r.date,region:r.region_id,status:r.status});
 let budget=resolveMax;
 for(const id of ids){
  if(out.has(id)||budget--<=0)continue;
  let current=id;const seen=new Set([id]);
  for(let i=0;i<5;i++){
   const row=await content.prepare("SELECT json_extract(payload,'$.identity.mergedInto') m FROM topics WHERE id=?").bind(current).first();
   if(!row?.m||seen.has(row.m))break;
   seen.add(row.m);current=row.m;
  }
  if(current!==id){const r=await content.prepare('SELECT id,title,date,region_id,status FROM search_cards WHERE id=?').bind(current).first();if(r)out.set(id,{id:r.id,title:r.title,date:r.date,region:r.region_id,status:r.status,mergedFrom:id});}
 }
 return out;
}
export async function articlesList(ctx){
 const {session}=await requireUser(ctx);
 const {results}=await ctx.db.prepare('SELECT topic_id,follow,active,snapshot,saved_at,last_seen_at FROM saved_articles WHERE user_id=? ORDER BY saved_at DESC').bind(session.user_id).all();
 return {response:respond({articles:(results||[]).map(r=>({id:r.topic_id,follow:!!r.follow,active:!!r.active,savedAt:r.saved_at,lastSeen:r.last_seen_at,...(r.snapshot?{snapshot:JSON.parse(r.snapshot)}:{})}))})};
}
const TOPIC_ID=/^[A-Za-z0-9_.:-]{1,200}$/;
export async function articlesWrite(ctx){
 const user=await requireUser(ctx,{write:true}),uid=user.session.user_id;
 const body=await readJson(ctx.request,4096);
 const id=str(body.id,200);
 if(!id||!TOPIC_ID.test(id))throw new AccountError(400,'Ungültiger Vorgang.');
 const {db,now}=ctx,at=iso(now),method=ctx.request.method;
 if(method==='DELETE'){await db.prepare('DELETE FROM saved_articles WHERE user_id=? AND topic_id=?').bind(uid,id).run();return {response:respond({ok:true})};}
 if(method==='POST'){
  const count=await db.prepare('SELECT count(*) n FROM saved_articles WHERE user_id=? AND active=1').bind(uid).first();
  if(Number(count.n)>=user.limits.bookmarks)throw new AccountError(409,'Grenze der gemerkten Artikel erreicht.',{limit:'bookmarks'});
  const follow=body.follow===true;
  if(follow)await checkNotifications(ctx,uid,user.limits);
  const snap=(await articleSnapshots(ctx.content,[id])).get(id);
  if(!snap)throw new AccountError(404,'Vorgang nicht gefunden.');
  const r=await db.prepare('INSERT INTO saved_articles(user_id,topic_id,follow,active,snapshot,last_status,saved_at) VALUES(?,?,?,1,?,?,?) ON CONFLICT DO NOTHING RETURNING topic_id')
   .bind(uid,snap.id,follow?1:0,JSON.stringify(snap),snap.status??null,at).first();
  return {response:respond({ok:true,snapshot:snap,duplicate:!r},{status:r?201:200})};
 }
 if(method==='PATCH'){
  const sets=[],args=[];
  if(typeof body.follow==='boolean'){if(body.follow)await checkNotifications(ctx,uid,user.limits,{article:id});sets.push('follow=?');args.push(body.follow?1:0);}
  if(body.seen===true){sets.push('last_seen_at=?');args.push(at);}
  if(!sets.length)throw new AccountError(400,'Nichts zu ändern.');
  const r=await db.prepare(`UPDATE saved_articles SET ${sets.join(',')} WHERE user_id=? AND topic_id=?`).bind(...args,uid,id).run();
  if(!Number(r?.meta?.changes))throw new AccountError(404,'Artikel nicht gemerkt.');
  return {response:respond({ok:true})};
 }
 throw new AccountError(405,'Methode nicht erlaubt.');
}

// ---------------------------------------------------------------- Einstellungen und Profil
const cleanCalendar=list=>Array.isArray(list)?list.slice(0,200).filter(c=>c&&AGS.test(String(c.ags))).map(c=>({ags:String(c.ags),name:str(c.name,120)??'',km:Number.isFinite(c.km)&&c.km>=0&&c.km<=200?c.km:0})):[];
const cleanAgs=list=>Array.isArray(list)?[...new Set(list.map(String).filter(a=>AGS.test(a)))].slice(0,200):[];
export async function settingsRead(ctx){
 const {session}=await requireUser(ctx);
 const row=await ctx.db.prepare('SELECT weekly,weekly_day,calendar,calendar_ags FROM user_settings WHERE user_id=?').bind(session.user_id).first();
 return {response:respond({name:session.name,email:session.email,weekly:!!row?.weekly,weeklyDay:row?.weekly_day??null,calendar:JSON.parse(row?.calendar||'[]'),calendarAgs:JSON.parse(row?.calendar_ags||'[]')})};
}
export async function settingsWrite(ctx){
 const {session}=await requireUser(ctx,{write:true});
 const body=await readJson(ctx.request,65536);
 const {db,now}=ctx,at=iso(now),uid=session.user_id;
 const statements=[];
 if(body.name!==undefined)statements.push(db.prepare('UPDATE users SET name=? WHERE id=?').bind(cleanName(body.name),uid));
 const s=await db.prepare('SELECT weekly,weekly_day,calendar,calendar_ags FROM user_settings WHERE user_id=?').bind(uid).first();
 const weekly=body.weekly!==undefined?(body.weekly===true?1:0):(s?.weekly??0);
 const day=body.weeklyDay!==undefined?(Number.isInteger(body.weeklyDay)&&body.weeklyDay>=0&&body.weeklyDay<=6?body.weeklyDay:null):(s?.weekly_day??null);
 const calendar=body.calendar!==undefined?JSON.stringify(cleanCalendar(body.calendar)):(s?.calendar??'[]');
 const ags=body.calendarAgs!==undefined?JSON.stringify(cleanAgs(body.calendarAgs)):(s?.calendar_ags??'[]');
 statements.push(db.prepare('INSERT INTO user_settings(user_id,weekly,weekly_day,calendar,calendar_ags,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET weekly=excluded.weekly,weekly_day=excluded.weekly_day,calendar=excluded.calendar,calendar_ags=excluded.calendar_ags,updated_at=excluded.updated_at').bind(uid,weekly,day,calendar,ags,at));
 await db.batch(statements);
 return {response:respond({ok:true})};
}

// ---------------------------------------------------------------- Übernahme aus dem Browser (Abschnitt 8)
export async function importData(ctx){
 const user=await requireUser(ctx,{write:true}),uid=user.session.user_id;
 const body=await readJson(ctx.request,262144);
 const {db,now}=ctx,at=iso(now);
 const searches=Array.isArray(body.searches)?body.searches.slice(0,200):[];
 const articles=Array.isArray(body.articles)?body.articles.slice(0,500):[];
 // Obergrenzen je Konto, auch für nicht aktive Einträge (wiederholte Übernahmen ließen die Datei sonst wachsen)
 const stored=await db.prepare('SELECT (SELECT count(*) FROM saved_searches WHERE user_id=?1) s,(SELECT count(*) FROM saved_articles WHERE user_id=?1) a').bind(uid).first();
 if(Number(stored.s)+searches.length>MAX_STORED.searches||Number(stored.a)+articles.length>MAX_STORED.articles)throw new AccountError(409,'Zu viele gespeicherte Einträge im Konto.',{limit:'stored'});
 const notifyRow=await db.prepare('SELECT (SELECT count(*) FROM saved_searches WHERE user_id=?1 AND active=1 AND notify_mail=1)+(SELECT count(*) FROM saved_articles WHERE user_id=?1 AND active=1 AND follow=1) n').bind(uid).first();
 let notifications=Number(notifyRow?.n||0);
 /** Benachrichtigung nur, solange die Stufe sie erlaubt (Vormerkung, Thema 2) */
 const allowNotify=wanted=>{if(!wanted||notifications>=user.limits.notifications)return 0;notifications++;return 1;};
 const result={searches:{added:[],existing:[],invalid:[]},articles:{added:[],existing:[],missing:[]}};
 const base=await db.prepare('SELECT coalesce(max(position),-1) p,(SELECT count(*) FROM saved_searches WHERE user_id=?1 AND active=1) n FROM saved_searches WHERE user_id=?1').bind(uid).first();
 let position=Number(base.p)+1,activeSearches=Number(base.n);
 const statements=[];
 for(const s of searches){
  const id=str(s?.id,64);
  try{
   if(!id||!/^[A-Za-z0-9_-]{1,64}$/.test(id))throw 0;
   const name=cleanName(s.name),signature=str(s.signature,2000);if(!name||!signature)throw 0;
   const state=cleanState(s.state);
   const active=activeSearches<user.limits.savedSearches;if(active)activeSearches++;
   statements.push({kind:'search',id,stmt:db.prepare('INSERT INTO saved_searches(user_id,id,signature,name,ui_state,query,query_version,position,active,notify_mail,notify_freq,created_at,updated_at,last_seen_at) VALUES(?,?,?,?,?,?,1,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING RETURNING id')
    .bind(uid,id,signature,name,state,cleanQuery(s.query),position++,active?1:0,active?allowNotify(s.notify?.mail===true):0,FREQ.includes(s.notify?.freq)?s.notify.freq:null,str(s.created,30)??at,at,str(s.lastSeen,30)??null)});
  }catch{result.searches.invalid.push(id??null);}
 }
 const ids=articles.map(a=>str(a?.id,200)).filter(id=>id&&TOPIC_ID.test(id));
 const snaps=await articleSnapshots(ctx.content,[...new Set(ids)]);
 const countA=await db.prepare('SELECT count(*) n FROM saved_articles WHERE user_id=? AND active=1').bind(uid).first();
 let activeArticles=Number(countA.n);
 for(const a of articles){
  const id=str(a?.id,200),snap=id&&snaps.get(id);
  if(!snap){result.articles.missing.push(id??null);continue;}
  const active=activeArticles<user.limits.bookmarks;if(active)activeArticles++;
  statements.push({kind:'article',id,stmt:db.prepare('INSERT INTO saved_articles(user_id,topic_id,follow,active,snapshot,last_status,saved_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT DO NOTHING RETURNING topic_id')
   .bind(uid,snap.id,active?allowNotify(a.follow===true):0,active?1:0,JSON.stringify(snap),snap.status??null,str(a.savedAt,30)??at)});
 }
 const settings=body.settings&&typeof body.settings==='object'?body.settings:null;
 const batch=statements.map(s=>s.stmt);
 if(settings)batch.push(db.prepare('INSERT INTO user_settings(user_id,weekly,weekly_day,calendar,calendar_ags,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET weekly=excluded.weekly,weekly_day=excluded.weekly_day,calendar=CASE WHEN excluded.calendar<>\'[]\' THEN excluded.calendar ELSE user_settings.calendar END,calendar_ags=CASE WHEN excluded.calendar_ags<>\'[]\' THEN excluded.calendar_ags ELSE user_settings.calendar_ags END,updated_at=excluded.updated_at')
  .bind(uid,settings.weekly===true?1:0,Number.isInteger(settings.weeklyDay)&&settings.weeklyDay>=0&&settings.weeklyDay<=6?settings.weeklyDay:null,JSON.stringify(cleanCalendar(settings.calendar)),JSON.stringify(cleanAgs(settings.calendarAgs)),at));
 if(typeof body.name==='string'&&!user.session.name)batch.push(db.prepare('UPDATE users SET name=? WHERE id=? AND name IS NULL').bind(cleanName(body.name),uid));
 const answers=batch.length?await db.batch(batch):[];
 statements.forEach((s,i)=>{
  const added=(answers[i]?.results||[]).length>0;
  (s.kind==='search'?result.searches:result.articles)[added?'added':'existing'].push(s.id);
 });
 return {response:respond({ok:true,...result,limits:{savedSearches:user.limits.savedSearches,bookmarks:user.limits.bookmarks}})};
}

// ---------------------------------------------------------------- Code für Löschen und Datenauskunft (Zweckbindung)
/** Neues Flow-Cookie und Token mit Zweck delete/export an die Kontoadresse; nur der Code (kein Link) */
async function sendPurposeCode(ctx,session,purpose){
 const {db,cfg,now,names}=ctx,at=iso(now);
 const flowValue=randomToken(32),flowHash=await sha256hex(flowValue),code=randomCode();
 if(limited('purpose-code',session.user_id,{max:5,windowMs:3600000,now}))throw new AccountError(429,'Zu viele Codes angefordert. Bitte in einer Stunde erneut.');
 // Eigener Zählschlüssel: Fehlversuche hier zählen nicht zur Sperre der Anmeldung per Code
 const emailHmac=await hmacHex(cfg.secret,'purpose-rate',session.email);
 await db.batch([
  db.prepare('DELETE FROM login_tokens WHERE user_id=? AND purpose=? AND used_at IS NULL').bind(session.user_id,purpose),
  db.prepare('INSERT INTO login_flows(id,email_hmac,attempts,created_at,expires_at) VALUES(?,?,0,?,?)').bind(flowHash,emailHmac,at,iso(now+CODE_MS)),
  db.prepare('INSERT INTO login_tokens(id,flow_hash,code_hash,email,purpose,user_id,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)')
   .bind(await sha256hex(randomToken(32)),flowHash,await sha256hex(purpose+'|'+flowHash+'|'+code),session.email,purpose,session.user_id,at,iso(now+CODE_MS)),
 ]);
 const site=siteBase(cfg,ctx.request);
 const later=[async()=>{await sendMail(db,cfg,{to:session.email,template:purpose+'_code',data:{code},userId:session.user_id,quota:'account',discardAfterMs:CODE_MS,now});await processOutbox(db,cfg,{site,now});}];
 return {cookie:setCookie(names.flow,flowValue,{maxAge:CODE_MS/1000,secure:names.secure,sameSite:'Strict'}),later};
}
/** Löst einen Code nur für diesen Zweck, dieses Konto und dieses Flow-Cookie ein */
async function redeemPurposeCode(ctx,session,purpose,rawCode){
 const code=normalizeCode(rawCode);
 if(!code)throw new AccountError(400,'Bitte den achtstelligen Code eingeben.');
 const flowValue=ctx.cookies.get(ctx.names.flow);
 if(!TOKEN_RE.test(flowValue||''))throw new AccountError(400,'Bitte einen neuen Code anfordern.');
 const {db,now}=ctx,at=iso(now),flowHash=await sha256hex(flowValue);
 const flow=await db.prepare('UPDATE login_flows SET attempts=attempts+1 WHERE id=? AND attempts<5 AND expires_at>? RETURNING attempts').bind(flowHash,at).first();
 if(!flow)throw new AccountError(400,'Bitte einen neuen Code anfordern.');
 const used=await db.prepare('UPDATE login_tokens SET used_at=? WHERE flow_hash=? AND code_hash=? AND purpose=? AND user_id=? AND used_at IS NULL AND expires_at>? RETURNING id')
  .bind(at,flowHash,await sha256hex(purpose+'|'+flowHash+'|'+code),purpose,session.user_id,at).first();
 if(!used){const left=Math.max(0,5-Number(flow.attempts));throw new AccountError(400,left?`Code falsch oder abgelaufen, noch ${left} ${left===1?'Versuch':'Versuche'}.`:'Bitte einen neuen Code anfordern.');}
}

// ---------------------------------------------------------------- Konto löschen (5.4)
export async function deleteAccount(ctx){
 const user=await requireUser(ctx,{write:true}),session=user.session;
 const body=await readJson(ctx.request,1024);
 if(user.roles.includes('admin'))throw new AccountError(403,'Admin-Konten werden nur über die Kommandozeile gelöscht.');
 if(body.code===undefined){
  const {cookie,later}=await sendPurposeCode(ctx,session,'delete');
  return {response:respond({codeSent:true},{cookies:[cookie]}),later};
 }
 await redeemPurposeCode(ctx,session,'delete',body.code);
 return removeUser(ctx,{userId:session.user_id,email:session.email,notify:true,cookies:[setCookie(ctx.names.session,'',{maxAge:0,secure:ctx.names.secure}),setCookie(ctx.names.flow,'',{maxAge:0,secure:ctx.names.secure,sameSite:'Strict'})]});
}
/** Löschen mit Kaskade, Löschprotokoll außerhalb der Datei, Hinweismail (auch von der Kommandozeile genutzt) */
export async function removeUser(ctx,{userId,email,notify=true,cookies=[]}){
 const {db,cfg,now}=ctx;
 await db.batch([
  db.prepare('DELETE FROM login_tokens WHERE email=? OR user_id=?').bind(email,userId),
  db.prepare('DELETE FROM invites WHERE email=?').bind(email),
  db.prepare("DELETE FROM mail_outbox WHERE user_id=? AND status IN ('queued','sending')").bind(userId),
  db.prepare('DELETE FROM users WHERE id=?').bind(userId),
 ]);
 try{await cfg.hooks?.logDeletion?.({userHash:await sha256hex(userId),emailHmac:await hmacHex(cfg.secret,'deletion',email),at:iso(now)});}catch(e){console.error('[konten] Löschprotokoll nicht geschrieben:',e?.message);}
 try{await cfg.hooks?.checkpoint?.();}catch{/* nur Node */}
 const later=[];
 if(notify){
  const site=siteBase(cfg,ctx.request);
  later.push(async()=>{
   const mail=await sendMail(db,cfg,{to:email,template:'deleted',quota:'account',now});
   await processOutbox(db,cfg,{site,now});
   // Die Adresse nicht im Postausgang liegen lassen, auch wenn der Versand scheiterte (nur diese Zeile)
   if(mail.id)await db.prepare("UPDATE mail_outbox SET \"to\"=NULL,data=NULL,status=CASE WHEN status='sent' THEN status ELSE 'dropped' END WHERE id=?").bind(mail.id).run();
  });
 }
 return {response:respond({ok:true,deleted:true},{cookies}),later};
}

// ---------------------------------------------------------------- Datenauskunft (5.5)
export async function exportData(ctx){
 const user=await requireUser(ctx,{write:true}),session=user.session;
 const body=await readJson(ctx.request,1024);
 const fresh=Date.parse(session.auth_at)>ctx.now-DAY;
 if(!fresh){
  if(body.code===undefined){const {cookie,later}=await sendPurposeCode(ctx,session,'export');return {response:respond({codeSent:true},{cookies:[cookie]}),later};}
  await redeemPurposeCode(ctx,session,'export',body.code);
 }
 const data=await collectUserData(ctx.db,session.user_id,session.email);
 await eventStatement(ctx.db,{userId:session.user_id,kind:'export',now:ctx.now}).run();
 const {db,cfg,now}=ctx,site=siteBase(cfg,ctx.request);
 const later=[async()=>{await sendMail(db,cfg,{to:session.email,template:'exported',userId:session.user_id,quota:'account',now});await processOutbox(db,cfg,{site,now});}];
 const headers={'Content-Disposition':`attachment; filename="plenara-daten-${iso(now).slice(0,10)}.json"`};
 return {response:respond({...data,exportedAt:iso(now)},{headers}),later};
}
/** Alle Daten zu einem Konto, ohne Hashes (Art. 15 und 20) */
export async function collectUserData(db,userId,email){
 const all=async(sql,...a)=>(await db.prepare(sql).bind(...a).all()).results||[];
 const user=await db.prepare('SELECT id,email,email_verified_at,name,org,customer_type,status,created_at,last_login_at FROM users WHERE id=?').bind(userId).first();
 return {
  hinweis:'Zweck, Empfänger und Speicherdauer stehen in der Datenschutzerklärung (/datenschutz).',
  konto:user,
  rollen:await all('SELECT role,granted_at FROM user_roles WHERE user_id=?',userId),
  stufen:await all('SELECT tier,source,starts_at,ends_at,note FROM plan_grants WHERE user_id=?',userId),
  zustimmungen:await all('SELECT doc,version,given_at,withdrawn_at,privacy_version FROM consents WHERE user_id=?',userId),
  einstellungen:await db.prepare('SELECT weekly,weekly_day,calendar,calendar_ags,updated_at FROM user_settings WHERE user_id=?').bind(userId).first(),
  suchen:(await all('SELECT * FROM saved_searches WHERE user_id=? ORDER BY position',userId)).map(searchRow),
  artikel:await all('SELECT topic_id,follow,active,snapshot,saved_at,last_seen_at FROM saved_articles WHERE user_id=?',userId),
  sitzungen:await all('SELECT device,created_at,auth_at,last_seen_at,expires_at FROM sessions WHERE user_id=?',userId),
  kalenderAbos:await all('SELECT created_at,revoked_at FROM calendar_feeds WHERE user_id=?',userId),
  ereignisse:await all('SELECT at,kind,detail FROM auth_events WHERE user_id=? ORDER BY at',userId),
  mails:await all('SELECT created_at,template,status FROM mail_outbox WHERE user_id=? ORDER BY created_at',userId),
  adminAktionen:await all('SELECT at,method,path,action,count FROM admin_audit WHERE user_id=? ORDER BY at',userId),
  offeneAnmeldungen:await all('SELECT purpose,created_at,expires_at FROM login_tokens WHERE (email=? OR user_id=?) AND used_at IS NULL',email,userId),
 };
}

// ---------------------------------------------------------------- Kalender-Abo per Token (Kalender-Apps schicken kein Cookie)
/** GET: Abo vorhanden? POST: neuen Link erzeugen (alter wird ungültig). DELETE: Abo beenden. */
export async function calendarFeed(ctx){
 const method=ctx.request.method;
 const user=await requireUser(ctx,{write:method!=='GET'}),uid=user.session.user_id;
 const {db,now}=ctx,at=iso(now);
 if(method==='GET'){
  const row=await db.prepare('SELECT created_at FROM calendar_feeds WHERE user_id=? AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1').bind(uid).first();
  return {response:respond({active:!!row,since:row?.created_at??null,allowed:!!user.features.calendar})};
 }
 if(method==='DELETE'){
  await db.prepare('UPDATE calendar_feeds SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL').bind(at,uid).run();
  return {response:respond({ok:true})};
 }
 if(method!=='POST')throw new AccountError(405,'Methode nicht erlaubt.');
 if(!user.features.calendar)throw new AccountError(403,'Der Kalender gehört zu einer höheren Stufe.',{feature:'calendar'});
 const site=siteBase(ctx.cfg,ctx.request);
 if(!site)throw new AccountError(503,'SITE_URL fehlt.');
 const token=randomToken(32);
 await db.batch([
  db.prepare('UPDATE calendar_feeds SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL').bind(at,uid),
  db.prepare('INSERT INTO calendar_feeds(id,user_id,created_at) VALUES(?,?,?)').bind(await sha256hex(token),uid,at),
 ]);
 return {response:respond({ok:true,url:`${site}/api/calendar/feed/${token}.ics`})};
}
/** Gebiete zum Abo-Token, nur wenn Abo, Konto und Stufe (Kalender) gültig sind; sonst null */
export async function feedAreas(db,token,{now=Date.now()}={}){
 const value=String(token||'').replace(/\.ics$/,'');
 if(!TOKEN_RE.test(value))return null;
 const row=await db.prepare(`SELECT f.user_id,s.calendar_ags FROM calendar_feeds f JOIN users u ON u.id=f.user_id
   LEFT JOIN user_settings s ON s.user_id=f.user_id WHERE f.id=? AND f.revoked_at IS NULL AND u.status='active'`).bind(await sha256hex(value)).first();
 if(!row)return null;
 const tier=await effectiveTier(db,row.user_id,{now});
 if(!FEATURES[tier.tier]?.calendar)return null;
 return JSON.parse(row.calendar_ags||'[]');
}
