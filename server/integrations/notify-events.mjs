/**
 * Ereignisse für die Benachrichtigungen (requirements/benachrichtigungen-konzept.md, drizzle/0046_notify_events.sql).
 * Der Import (server/services/sync.ts) fragt je geschriebenem Bericht notifyEvent; der Job notify
 * (server/accounts/notify.mjs) liest die Tabelle nur.
 *  - 'new': Bericht, den es vorher nicht gab. Nur wenn das Gebiet schon Bestand hatte (der erste Import eines Gebiets bringt
 *    seine Geschichte, keine Neuigkeit) und die Sitzung höchstens NOTIFY_RECENT_MS zurückliegt (Altbestand löst nichts aus).
 *  - 'change': vorhandener Bericht mit neuem Status oder neuer Sitzung in der Beratungsfolge (neue Sitzungen nur, wenn sie
 *    höchstens NOTIFY_RECENT_MS zurückliegen; ein Nachtrag alter Stationen ist keine Nachricht).
 * Zusammengeführte Berichte (identity.mergedInto) melden nie; ihr Ziel meldet die Änderung.
 */
const DAY=864e5;
export const NOTIFY_RECENT_MS=30*DAY,NOTIFY_KEEP_MS=14*DAY;
export const NOTIFY_INSERT_SQL='INSERT INTO notify_events(at,topic_id,region_id,kind,date,status,prev_status,detail) VALUES(?,?,?,?,?,?,?,?)';
/* Höchstens 2000 Zeilen je Import, älteste zuerst (Index auf at): die Tabelle bleibt klein, ohne den Import aufzuhalten */
export const NOTIFY_PRUNE_SQL='DELETE FROM notify_events WHERE seq IN (SELECT seq FROM notify_events WHERE at<? ORDER BY at LIMIT 2000)';

const day=d=>String(d||'').slice(0,10);
/* Eine Sitzung des Vorgangs: Tag und Gremium (Adressen der Sitzungen ändern sich bei manchen Systemen von Abruf zu Abruf) */
const sessionKey=e=>`${day(e.date)}|${e.committee||''}`;

/**
 * Ereignis zu einem Bericht oder null. previous: gespeicherter Stand vor dem Import (fehlt bei neuen Berichten).
 * Rückgabe: Werte für NOTIFY_INSERT_SQL.
 */
export function notifyEvent(previous,topic,{at,hadStock,region}){
 if(!topic||topic.identity?.mergedInto)return null;
 const recent=Date.parse(at)-NOTIFY_RECENT_MS;
 const isRecent=d=>Date.parse(day(d))>=recent;
 const sessions=(topic.events||[]).filter(e=>e&&/^\d{4}-\d{2}-\d{2}/.test(String(e.date||'')));
 let kind,added;
 if(!previous){
  if(!hadStock||!isRecent(topic.eventDate))return null;
  kind='new';added=sessions;
 }else{
  const known=new Set((previous.events||[]).map(sessionKey));
  added=sessions.filter(e=>!known.has(sessionKey(e))&&isRecent(e.date));
  if(!added.length&&previous.status===topic.status)return null;
  kind='change';
 }
 const detail={sessions:added.slice(-5).map(e=>({d:day(e.date),c:String(e.committee||'').slice(0,200),...(e.status?{s:e.status}:{})}))};
 return [at,topic.id,region,kind,day(topic.eventDate)||null,topic.status??null,previous?.status??null,JSON.stringify(detail)];
}
