// Benachrichtigungen per E-Mail (requirements/benachrichtigungen-konzept.md). Der Job notify (scripts/accounts/notify.mjs,
// alle 10 Minuten) sammelt aus den Ereignissen des Imports (notify_events in der Inhaltsdatei, nur gelesen) die Treffer
// gespeicherter Suchen, die Neuigkeiten gefolgter Vorgänge und neue Sitzungen in Kalendergebieten (notify_items in der
// Kontendatei) und reiht fällige Treffer je Konto als eine Mail in den Postausgang ein. Abbestellen per Token ohne Anmeldung.
import {parseMonitorSearch,searchFilters} from '../integrations/monitor-search.mjs';
import {slotAt,ZONE} from '../integrations/schedules.mjs';
import {LIMITS,FEATURES} from '../../shared/plans.mjs';
import {STATUS} from '../../shared/types.ts';
import {effectiveTier} from './sessions.mjs';
import {sendMail} from './mail.mjs';
import {randomToken,sha256hex} from './crypto.mjs';
import {AccountError,respond,readJson} from './http.mjs';
import {limited} from './rate-limit.mjs';

const iso=ms=>new Date(ms).toISOString();
const HOUR=3600000,DAY=24*HOUR;
/** Ereignisse so lange erneut prüfen: Thema und Zusammenfassung eines neuen Berichts kommen oft erst mit der Verarbeitung
    in der Nacht; doppelt gemeldet wird nie (Schlüssel von notify_items). */
export const NOTIFY_WINDOW_MS=48*HOUR;
/** Täglich und wöchentlich um diese Uhrzeit (deutsche Zeit); je Abschnitt höchstens so viele Einträge in der Mail */
export const SEND_TIME='07:00',MAX_PER_GROUP=10;
/** Pflegefristen (scripts/accounts/maintenance.mjs): verschickte und verfallene Treffer, Abbestell-Tokens */
export const NOTIFY_RETENTION={items:30*DAY,tokens:180*DAY};
/** Rhythmus des Wochenberichts: 0 bis 6 Wochentag (0 = Sonntag), 7 täglich */
export const DAILY_REPORT=7;
const FREQ=['instant','daily','weekly'];

/* ---------------------------------------------------------------- Fälligkeit */
const weekdayAt=t=>['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(new Intl.DateTimeFormat('en-US',{timeZone:ZONE,weekday:'short'}).format(new Date(t)));
/** Wann ein Treffer verschickt wird: sofort, beim nächsten 07:00-Termin oder am nächsten gewählten Wochentag (0 = Sonntag) um 07:00 */
export function dueAt(freq,at,weekday=1){
 if(freq==='instant')return at;
 for(let d=0;d<=8;d++){
  const slot=slotAt(at,SEND_TIME,d);
  if(slot>at&&(freq==='daily'||weekdayAt(slot)===weekday))return slot;
 }
 return at;
}
/** Wochentag für „wöchentlich“: der des Wochenberichts; ist der täglich (oder nicht gesetzt), Montag */
const weekdayOf=settings=>Number.isInteger(settings?.weekly_day)&&settings.weekly_day<DAILY_REPORT?settings.weekly_day:1;
const freqOf=f=>FREQ.includes(f)?f:'daily';
/** Rhythmus einer Suche: eigene Glocke, sonst der Wochenbericht */
const searchDue=(s,settings,at)=>s.notify_mail?dueAt(freqOf(s.notify_freq),at,weekdayOf(settings))
 :dueAt(settings?.weekly_day===DAILY_REPORT?'daily':'weekly',at,weekdayOf(settings));

/* ---------------------------------------------------------------- Abfrage einer gespeicherten Suche */
/**
 * Parameter der Meldung: dieselbe Abfrage wie die Übersicht (saved_searches.query), ohne Seite und Sortierung. Die
 * Schnellauswahl des Zeitraums (von „@d7“ …) und das stillschweigende Ende „heute“ gelten nicht: Neu ist neu, und gerade
 * die schon angesetzten künftigen Vorgänge sollen gemeldet werden. Ein fester Zeitraum bleibt Bedingung.
 */
export function alertParams(query,state={}){
 const p=new URLSearchParams(query||'');
 for(const k of ['page','size','part','revision','sort','around'])p.delete(k);
 if(String(state.von||'').startsWith('@')){p.delete('from');p.delete('to');}
 else if(!state.bis)p.delete('to');
 return p;
}
const statusLabel=s=>STATUS[s]?.label||'';
const parse=(text,fallback)=>{try{return text?JSON.parse(text):fallback;}catch{return fallback;}};

/* ---------------------------------------------------------------- Sammeln */
/**
 * Treffer aus den Ereignissen der letzten 48 Stunden in notify_items schreiben. content: Inhaltsdatei (nur lesen),
 * db: Kontendatei, catalog: Gebiete (shared/regions.ts). deadline: Zeitpunkt, zu dem der Lauf aufhört (der nächste setzt fort).
 */
export async function collectNotifications(db,content,catalog,{now=Date.now(),deadline=Infinity,dryRun=false}={}){
 const report={events:0,users:0,searches:0,searchesSkipped:0,items:0,stopped:false};
 let events;
 try{events=(await content.prepare('SELECT seq,at,topic_id,region_id,kind,date,status,prev_status,detail FROM notify_events WHERE at>=? ORDER BY seq').bind(iso(now-NOTIFY_WINDOW_MS)).all()).results||[];}
 catch{return {...report,skipped:'Ereignistabelle fehlt (drizzle/0046)'};}
 report.events=events.length;
 if(!events.length)return report;
 const byId=new Map(catalog.map(r=>[r.id,r]));
 const fresh=events.filter(e=>e.kind==='new'),changes=events.filter(e=>e.kind==='change');
 const {results:users=[]}=await db.prepare(`SELECT u.id FROM users u LEFT JOIN user_settings s ON s.user_id=u.id WHERE u.status='active' AND (
   coalesce(s.weekly,0)=1 OR coalesce(s.calendar_mail,0)=1
   OR EXISTS(SELECT 1 FROM saved_searches x WHERE x.user_id=u.id AND x.active=1 AND x.notify_mail=1)
   OR EXISTS(SELECT 1 FROM saved_articles a WHERE a.user_id=u.id AND a.active=1 AND a.follow=1))`).all();
 const insert=db.prepare(`INSERT INTO notify_items(user_id,ref,key,event_seq,created_at,due_at,card) VALUES(?,?,?,?,?,?,?)
   ON CONFLICT(user_id,ref,key) DO UPDATE SET card=excluded.card WHERE notify_items.mail_id IS NULL AND notify_items.dropped=0 AND notify_items.card<>excluded.card`);
 const cardOf=(row,extra={})=>({id:row.id,title:row.title,place:byId.get(row.region_id)?.name??'',gremium:row.gremium||'',date:row.date||'',status:statusLabel(row.status),...extra});
 for(const {id:uid} of users){
  if(Date.now()>deadline){report.stopped=true;break;}
  const tier=(await effectiveTier(db,uid,{now})).tier;
  if(!LIMITS[tier]?.notifications)continue;
  report.users++;
  const settings=await db.prepare('SELECT weekly,weekly_day,weekly_since,calendar_mail,calendar_freq,calendar_since,calendar_ags FROM user_settings WHERE user_id=?').bind(uid).first();
  const rows=[];
  // Gespeicherte Suchen: mit Glocke ab notify_since, sonst über den Wochenbericht ab weekly_since (nie vor dem Anlegen)
  const {results:searches=[]}=await db.prepare(`SELECT id,ui_state,query,notify_mail,notify_freq,notify_since,created_at FROM saved_searches
    WHERE user_id=? AND active=1 AND query IS NOT NULL AND (notify_mail=1 OR ?=1)`).bind(uid,settings?.weekly?1:0).all();
  for(const s of searches){
   const since=s.notify_mail?s.notify_since:[settings?.weekly_since,s.created_at].filter(Boolean).sort().pop();
   if(!since){report.searchesSkipped++;continue;}
   const candidates=fresh.filter(e=>e.at>=since&&e.at>=s.created_at);
   if(!candidates.length)continue;
   report.searches++;
   let hits;
   try{hits=await matchSearch(content,catalog,s,candidates.map(e=>e.topic_id));}
   catch(error){report.searchesSkipped++;console.warn(`[benachrichtigungen] Suche ${s.id} übersprungen: ${error instanceof Error?error.message:error}`);continue;}
   const seq=new Map(candidates.map(e=>[e.topic_id,e]));
   for(const row of hits){const e=seq.get(row.id);rows.push([uid,'s:'+s.id,row.id,e.seq,iso(now),iso(searchDue(s,settings,Date.parse(e.at))),JSON.stringify(cardOf(row))]);}
  }
  // Gefolgte Vorgänge: neuer Status oder neue Sitzung, sofort
  const {results:articles=[]}=await db.prepare('SELECT topic_id,follow_since FROM saved_articles WHERE user_id=? AND active=1 AND follow=1 AND follow_since IS NOT NULL').bind(uid).all();
  const followed=new Map(articles.map(a=>[a.topic_id,a.follow_since]));
  const mine=changes.filter(e=>followed.has(e.topic_id)&&e.at>=followed.get(e.topic_id));
  if(mine.length){
   const cards=await cardsOf(content,mine.map(e=>e.topic_id));
   for(const e of mine){
    const row=cards.get(e.topic_id);if(!row)continue;
    rows.push([uid,'a:'+e.topic_id,'e'+e.seq,e.seq,iso(now),iso(Date.parse(e.at)),JSON.stringify(cardOf(row,{note:changeNote(e)}))]);
   }
  }
  // Kalender (Enterprise): neue künftige Sitzungen in den Kalendergebieten, je Gebiet, Tag und Gremium ein Eintrag
  if(settings?.calendar_mail&&settings.calendar_since&&FEATURES[tier]?.calendar){
   const ags=new Set(parse(settings.calendar_ags,[]));
   const regions=new Set(catalog.filter(r=>ags.has(r.ags)).map(r=>r.id));
   const today=iso(now).slice(0,10),sessions=new Map();
   for(const e of events){
    if(!regions.has(e.region_id)||e.at<settings.calendar_since)continue;
    for(const x of parse(e.detail,{}).sessions||[]){
     if(!(x.d>=today))continue;
     const key=`${e.region_id}|${x.d}|${x.c}`;
     const hit=sessions.get(key)||{seq:e.seq,at:e.at,ids:new Set()};hit.ids.add(e.topic_id);sessions.set(key,hit);
    }
   }
   if(sessions.size){
    const cards=await cardsOf(content,[...new Set([...sessions.values()].flatMap(h=>[...h.ids]))]);
    for(const [key,hit] of sessions){
     const [region,d,c]=key.split('|'),titles=[...hit.ids].map(id=>cards.get(id)?.title).filter(Boolean);
     if(!titles.length)continue;
     const card={id:'',title:`${c||'Sitzung'} am ${d.split('-').reverse().join('.')}`,place:byId.get(region)?.name??'',gremium:'',date:d,status:'',
      note:`${titles.length} ${titles.length===1?'Vorgang':'Vorgänge'} auf der Tagesordnung, darunter: ${titles.slice(0,3).join('; ')}`.slice(0,600),topic:[...hit.ids][0]};
     rows.push([uid,'c',key,hit.seq,iso(now),iso(dueAt(freqOf(settings.calendar_freq),Date.parse(hit.at),weekdayOf(settings))),JSON.stringify(card)]);
    }
   }
  }
  // Probelauf: nur zählen, was geprüft würde (bereits gemeldete Treffer eingeschlossen)
  if(dryRun){report.items+=rows.length;continue;}
  for(let i=0;i<rows.length;i+=200){
   const part=rows.slice(i,i+200);
   const done=await db.batch(part.map(r=>insert.bind(...r)));
   report.items+=done.reduce((n,r)=>n+Number(r?.meta?.changes||0),0);
  }
 }
 return report;
}

/** Berichte einer gespeicherten Suche unter den Kandidaten: genau die Bedingungen der Übersicht (searchFilters) */
export async function matchSearch(content,catalog,s,ids){
 const f=parseMonitorSearch(alertParams(s.query,parse(s.ui_state,{})));
 // Eigener Teil: keine Kandidaten der Wortliste und kein Zähler, nur die Bedingungen; die Kandidaten sind die neuen Berichte
 f.part='notify';
 const {page}=await searchFilters(content,catalog,f);
 const {results=[]}=await content.prepare(`SELECT id,region_id,date,status,title,gremium FROM search_cards WHERE id IN (SELECT value FROM json_each(?)) AND ${page.where} ORDER BY date DESC,id`)
  .bind(JSON.stringify([...new Set(ids)]),...page.args).all();
 return results;
}
async function cardsOf(content,ids){
 const {results=[]}=await content.prepare('SELECT id,region_id,date,status,title,gremium FROM search_cards WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify([...new Set(ids)])).all();
 return new Map(results.map(r=>[r.id,r]));
}
const deDay=d=>String(d||'').slice(0,10).split('-').reverse().join('.');
/** Was sich an einem gefolgten Vorgang getan hat, in einem Satz */
export function changeNote(e){
 const sessions=parse(e.detail,{}).sessions||[];
 const parts=[];
 if(e.prev_status!==e.status&&statusLabel(e.status))parts.push(`Neuer Stand: ${statusLabel(e.status)}${statusLabel(e.prev_status)?` (vorher ${statusLabel(e.prev_status)})`:''}`);
 const last=sessions[sessions.length-1];
 if(last)parts.push(`${last.d>=String(e.at).slice(0,10)?'Angesetzt':'Beraten'} am ${deDay(last.d)}${last.c?` im Gremium ${last.c}`:''}`);
 return parts.join('. ');
}

/* ---------------------------------------------------------------- Versenden */
/**
 * Fällige Treffer je Konto als eine Mail in den Postausgang (Kontingent notify). Treffer, deren Bezug nicht mehr gilt
 * (Suche entfernt oder ohne Glocke und Wochenbericht, Artikel ohne Glocke, Stufe ohne Benachrichtigungen, Konto gesperrt),
 * verfallen. Mail und Markierung der Treffer stehen in einer Transaktion: doppelt verschickt wird nichts.
 */
export async function deliverNotifications(db,cfg,{now=Date.now(),site=cfg.siteUrl,deadline=Infinity}={}){
 const report={mails:0,items:0,dropped:0,held:0,stopped:false};
 if(!site)return {...report,skipped:'SITE_URL fehlt'};
 const at=iso(now);
 const {results:users=[]}=await db.prepare('SELECT DISTINCT user_id FROM notify_items WHERE mail_id IS NULL AND dropped=0 AND due_at<=?').bind(at).all();
 for(const {user_id:uid} of users){
  if(Date.now()>deadline){report.stopped=true;break;}
  const user=await db.prepare('SELECT email,status FROM users WHERE id=?').bind(uid).first();
  const tier=(await effectiveTier(db,uid,{now})).tier;
  const {results:items=[]}=await db.prepare('SELECT ref,key,card FROM notify_items WHERE user_id=? AND mail_id IS NULL AND dropped=0 AND due_at<=? ORDER BY ref,due_at,key').bind(uid,at).all();
  const drop=async refs=>{if(!refs.length)return;report.dropped+=refs.length;
   await db.batch(refs.map(i=>db.prepare('UPDATE notify_items SET dropped=1 WHERE user_id=? AND ref=? AND key=?').bind(uid,i.ref,i.key)));};
  if(user?.status!=='active'||!user.email||!LIMITS[tier]?.notifications){await drop(items);continue;}
  const valid=await validRefs(db,uid,tier);
  const keep=items.filter(i=>valid.has(i.ref)),gone=items.filter(i=>!valid.has(i.ref));
  await drop(gone);
  if(!keep.length)continue;
  const groups=[],tokens=[['*',randomToken()]];
  for(const [ref,list] of Map.groupBy(keep,i=>i.ref)){
   const cards=list.map(i=>parse(i.card,{}));
   const meta=valid.get(ref),token=randomToken();
   tokens.push([ref,token]);
   groups.push({kind:meta.kind,title:meta.title,link:`${site}${meta.path}`,token,more:Math.max(0,cards.length-MAX_PER_GROUP),
    items:cards.slice(0,MAX_PER_GROUP).map(c=>({title:c.title,place:c.place,gremium:c.gremium,date:c.date,status:c.status,note:c.note||'',link:`${site}/beschluss/${encodeURIComponent(c.id||c.topic||'')}`}))});
  }
  const hashed=await Promise.all(tokens.map(async([ref,t])=>[await sha256hex(t),ref]));
  // In der Transaktion der Mail: erst die Treffer markieren (last_insert_rowid() ist die Mail), danach die Tokens speichern
  const extra=[...keep.map(i=>db.prepare('UPDATE notify_items SET mail_id=last_insert_rowid() WHERE user_id=? AND ref=? AND key=?').bind(uid,i.ref,i.key)),
   ...hashed.map(([id,ref])=>db.prepare('INSERT INTO notify_tokens(id,user_id,ref,created_at) VALUES(?,?,?,?)').bind(id,uid,ref,at))];
  const queued=await sendMail(db,cfg,{to:user.email,template:'notify',data:{token:tokens[0][1],groups},userId:uid,quota:'notify',extra,now});
  if(!queued.queued){report.held+=keep.length;break;}
  report.mails++;report.items+=keep.length;
 }
 return report;
}
/** Bezüge, für die ein Konto gerade Mails bekommt: ref → {kind, title, path} */
async function validRefs(db,uid,tier){
 const out=new Map();
 const settings=await db.prepare('SELECT weekly,calendar_mail FROM user_settings WHERE user_id=?').bind(uid).first();
 const {results:searches=[]}=await db.prepare('SELECT id,name,notify_mail FROM saved_searches WHERE user_id=? AND active=1 AND (notify_mail=1 OR ?=1)').bind(uid,settings?.weekly?1:0).all();
 for(const s of searches)out.set('s:'+s.id,{kind:'search',title:s.name,path:'/konto/suchen'});
 const {results:articles=[]}=await db.prepare('SELECT topic_id,snapshot FROM saved_articles WHERE user_id=? AND active=1 AND follow=1').bind(uid).all();
 for(const a of articles)out.set('a:'+a.topic_id,{kind:'article',title:parse(a.snapshot,{}).title||'',path:`/beschluss/${encodeURIComponent(a.topic_id)}`});
 if(settings?.calendar_mail&&FEATURES[tier]?.calendar)out.set('c',{kind:'calendar',title:'',path:'/konto/kalender'});
 return out;
}

/* ---------------------------------------------------------------- Abbestellen */
const TOKEN_RE=/^[A-Za-z0-9_-]{43}$/;
/** Was ein Token abbestellen würde (für die Seite /abbestellen, schreibt nichts): {kind, title} oder 404 */
export async function unsubscribeInfo(db,token){
 const row=await tokenRow(db,token);
 if(row.ref==='*')return {kind:'all',title:''};
 if(row.ref==='c')return {kind:'calendar',title:''};
 if(row.ref.startsWith('s:')){const s=await db.prepare('SELECT name FROM saved_searches WHERE user_id=? AND id=?').bind(row.user_id,row.ref.slice(2)).first();return {kind:'search',title:s?.name??''};}
 const a=await db.prepare('SELECT snapshot FROM saved_articles WHERE user_id=? AND topic_id=?').bind(row.user_id,row.ref.slice(2)).first();
 return {kind:'article',title:parse(a?.snapshot,{}).title||''};
}
/**
 * Abbestellen: '*' schaltet alle Benachrichtigungen des Kontos aus (Glocken, Wochenbericht, Kalender-Mails; Suchen und
 * Artikel bleiben gespeichert), sonst nur den einen Bezug. Offene Treffer verfallen. Mehrfaches Abbestellen ist harmlos.
 */
export async function unsubscribe(db,token,{now=Date.now()}={}){
 const row=await tokenRow(db,token),uid=row.user_id,at=iso(now);
 const statements=[];
 const searchOff=id=>db.prepare('UPDATE saved_searches SET notify_mail=0,notify_since=NULL,updated_at=? WHERE user_id=?'+(id?' AND id=?':'')).bind(...[at,uid,...(id?[id]:[])]);
 if(row.ref==='*'){
  statements.push(searchOff(null),db.prepare('UPDATE saved_articles SET follow=0,follow_since=NULL WHERE user_id=?').bind(uid),
   db.prepare('UPDATE user_settings SET weekly=0,weekly_since=NULL,calendar_mail=0,calendar_since=NULL,updated_at=? WHERE user_id=?').bind(at,uid),
   db.prepare('UPDATE notify_items SET dropped=1 WHERE user_id=? AND mail_id IS NULL').bind(uid));
 }else if(row.ref==='c'){
  statements.push(db.prepare('UPDATE user_settings SET calendar_mail=0,calendar_since=NULL,updated_at=? WHERE user_id=?').bind(at,uid));
 }else if(row.ref.startsWith('s:')){
  // Eine Suche ohne eigene Glocke kam über den Wochenbericht: dann endet der Wochenbericht (sonst käme sie wieder)
  const s=await db.prepare('SELECT notify_mail FROM saved_searches WHERE user_id=? AND id=?').bind(uid,row.ref.slice(2)).first();
  if(s?.notify_mail)statements.push(searchOff(row.ref.slice(2)));
  else statements.push(db.prepare('UPDATE user_settings SET weekly=0,weekly_since=NULL,updated_at=? WHERE user_id=?').bind(at,uid));
 }else statements.push(db.prepare('UPDATE saved_articles SET follow=0,follow_since=NULL WHERE user_id=? AND topic_id=?').bind(uid,row.ref.slice(2)));
 if(row.ref!=='*')statements.push(db.prepare('UPDATE notify_items SET dropped=1 WHERE user_id=? AND ref=? AND mail_id IS NULL').bind(uid,row.ref));
 statements.push(db.prepare("INSERT INTO auth_events(at,user_id,kind,detail) VALUES(?,?,'unsubscribe',?)").bind(at,uid,JSON.stringify({ref:row.ref==='*'?'*':row.ref.slice(0,2)})));
 await db.batch(statements);
 return {ok:true,kind:row.ref==='*'?'all':row.ref==='c'?'calendar':row.ref.startsWith('s:')?'search':'article'};
}
/**
 * POST /api/notify/unsubscribe, ohne Sitzung und ohne gleiche Herkunft (das Token ist die Berechtigung):
 *  - Ein-Klick des Mailprogramms (RFC 8058): ?t=<Token>, Formular „List-Unsubscribe=One-Click“ → abbestellen
 *  - Seite /abbestellen: JSON {t, peek:true} → nur ansehen, was abbestellt würde; {t} → abbestellen
 */
export async function unsubscribeRoute(ctx){
 if(ctx.request.method!=='POST')throw new AccountError(405,'Methode nicht erlaubt.');
 if(limited('unsubscribe',ctx.ip,{max:30,windowMs:15*60000,now:ctx.now}))throw new AccountError(429,'Zu viele Versuche. Bitte später erneut.');
 const json=/application\/json/i.test(ctx.request.headers.get('content-type')||'')?await readJson(ctx.request,1024):{};
 const token=ctx.url.searchParams.get('t')||json.t;
 if(json.peek===true)return {response:respond(await unsubscribeInfo(ctx.db,token))};
 return {response:respond(await unsubscribe(ctx.db,token,{now:ctx.now}))};
}
async function tokenRow(db,token){
 if(typeof token!=='string'||!TOKEN_RE.test(token))throw new AccountError(400,'Der Link ist ungültig.');
 const row=await db.prepare('SELECT user_id,ref FROM notify_tokens WHERE id=?').bind(await sha256hex(token)).first();
 if(!row)throw new AccountError(404,'Der Link ist abgelaufen oder ungültig. Sie können Benachrichtigungen im Konto ausschalten.');
 return row;
}
