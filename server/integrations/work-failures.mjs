/**
 * Fehlerspeicher und Serverstufe (Migration 0040, requirements/betriebsplan-konzept.md, Abschnitt 4).
 *
 * Jeder Schritt der Tagespipeline und des Bestandsaufbaus schreibt, was scheitert, mit recordFailure in work_failures und
 * löscht es bei Erfolg mit clearFailure. Die Klasse des Abbruchgrunds (classify) bestimmt die Wiedervorlage (nextTry); der Job
 * „nacharbeit“ holt fällige Einträge mit dueEntries. Abrufer lesen vorher die Serverstufe (hostStates, hostWaiting) und lassen
 * wartende Server aus; ein fälliger Server bekommt zuerst eine Stichprobe (SAMPLE Einträge), ein Erfolg setzt ihn auf ok.
 *
 * db: D1-artig (prepare/bind/first/all/run), auch node:sqlite über sqliteAdapter (scripts/ai-job.mjs). Ohne Migration 0040
 * tun alle Funktionen nichts (hasFailureStore).
 */
const H=3600000,D=24*H;
/** Klassen des Abbruchgrunds */
export const CLASSES=Object.freeze(['blocked','denied','transient','gone','slow','busy','internal']);
/** Wartezeiten je Klasse für den Eintrag; danach wiederholt sich der letzte Abstand (REPEAT), damit nichts dauerhaft vergessen wird:
    im Tagesbereich versucht es die Nacharbeit dann noch wöchentlich, im Altbestand nur noch auf Knopfdruck */
const ENTRY_WAIT={transient:[H,6*H,D,3*D],denied:[7*D,30*D]},REPEAT={transient:7*D,denied:30*D};
/** Wartezeiten des Servers: bremsen (vorübergehend) und gesperrt (Zugriff verweigert); nach dem Ende von LOCK: pruefen */
export const HOST_WAIT=Object.freeze([H,4*H,12*H,D,3*D,7*D]),HOST_LOCK=Object.freeze([7*D,30*D]);
/** Fehler in Folge, ab denen ein Server wartet (429 sofort) */
export const HOST_FAILS=3;
/** Einträge eines fälligen Servers, bevor die ganze Reihe läuft */
export const SAMPLE=3;
/** Sperre im Haus: kurz warten, zählt nicht als Versuch */
const BUSY_WAIT=10*60000;
/** Klassen, die für die Serverstufe zählen */
const COUNTS=new Set(['blocked','denied','transient']);
const iso=t=>new Date(t).toISOString();

/**
 * Tagesbereich und Altbestand (Entscheidung 15.10.2026): Die automatische Nacharbeit bearbeitet nur den Tagesbereich, also
 * Einträge zu Berichten, deren Sitzung höchstens DAILY_DAYS Tage zurückliegt (oder künftig ist), frühestens DAILY_SINCE, und die
 * nicht vor DAILY_SINCE gescheitert sind (keine Altfehler). Ohne Sitzungstag (Import eines Gebiets) zählt der erste Fehlschlag.
 * Alles andere ist Altbestand und wird nur auf der Seite „Altbestand“ (Debug) auf Knopfdruck bearbeitet.
 */
export const DAILY_SINCE='2026-10-12',DAILY_DAYS=7;
/** Erster Tag des Tagesbereichs (JJJJ-MM-TT) */
export const dailyBoundary=(now=Date.now())=>{const d=iso(now-DAILY_DAYS*D).slice(0,10);return d>DAILY_SINCE?d:DAILY_SINCE;};
/** Gehört ein Eintrag (Sitzungstag, erster Fehlschlag) zum Tagesbereich? */
export const inDailyRange=(eventDate,firstAt,now=Date.now())=>{
 const b=dailyBoundary(now),first=String(firstAt||iso(now)).slice(0,10);
 return first>=DAILY_SINCE&&String(eventDate||first).slice(0,10)>=b;
};
/* Dasselbe als SQL-Bedingung über work_failures (zwei Platzhalter: Grenze, DAILY_SINCE). Einträge mit Herkunft 'backlog' (übertragene
   Altfehler, Läufe des Altbestands) gehören nie zum Tagesbereich, auch wenn ihr Sitzungstag jung ist. */
const DAILY_SQL="(origin<>'backlog' AND coalesce(nullif(substr(event_date,1,10),''),substr(first_at,1,10))>=? AND substr(first_at,1,10)>=?)";
/** Bedingung und Werte für einen Bereich: 'daily' | 'backlog' | 'all' */
export function rangeWhere(range,now=Date.now()){
 if(range==='daily')return {sql:DAILY_SQL,args:[dailyBoundary(now),DAILY_SINCE]};
 if(range==='backlog')return {sql:'NOT '+DAILY_SQL,args:[dailyBoundary(now),DAILY_SINCE]};
 return {sql:'1=1',args:[]};
}

/** Stufen der Verarbeitung: erst abrufen, dann Daten extrahieren, dann verarbeiten (Regeln, KI) */
export const PHASES=Object.freeze({import:'abruf',pdf:'extraktion',text:'extraktion','ocr-fetch':'extraktion',ocr:'extraktion',rules:'verarbeitung'});
export const PHASE_ORDER=Object.freeze(['abruf','extraktion','verarbeitung']);
export const phaseOf=step=>PHASES[step]||'verarbeitung';

/** Programmstand, unter dem der Prozess läuft (für internal): RM_RELEASE, sonst der Ordner releases/<commit> */
export function currentRelease(){
 try{return process.env.RM_RELEASE||(process.cwd().match(/releases[\\/]([^\\/]+)/)||[])[1]||'';}catch{return '';}
}

/**
 * Abbruchgrund → Klasse. {http, error (Text), status ('error'|'unsupported'), refused (Quelle bat um Pause), internal
 * (Ausnahme im eigenen Code), slow (Zeitgrenze je Datei), busy (Sperre im Haus), changed (andere Prüfsumme)}.
 * Rückgabe eine von CLASSES.
 */
export function classify({http=null,error='',status=null,refused=false,internal=false,slow=false,busy=false,changed=false}={}){
 const e=String(error||'');
 if(slow)return 'slow';
 if(busy||http===409||/database is locked|SQLITE_BUSY|Import läuft bereits/i.test(e))return 'busy';
 if(refused||http===429||http===503||/Retry-After|Abweisung|rate limit/i.test(e))return 'blocked';
 if(changed||status==='unsupported'||http===404||http===410||/zu groß|Datei geändert|kein PDF/i.test(e))return 'gone';
 if(http===401||http===403||http===451)return 'denied';
 if(http>=500||/timeout|aborted|ENOTFOUND|EAI_AGAIN|ECONN|socket|fetch failed|TLS|certificate|SSL|unvollständig/i.test(e))return 'transient';
 if(http>=400)return 'gone';
 if(internal)return 'internal';
 return 'transient';
}

/** Nächster Versuch eines Eintrags (ISO) oder null (endgültig bzw. nur nach neuem Programmstand). tries: Versuche inklusive diesem */
export function nextTry(cls,tries,{now=Date.now(),hostNext=null}={}){
 if(cls==='busy')return iso(now+BUSY_WAIT);
 if(cls==='blocked')return hostNext||iso(now+HOST_WAIT[0]);
 if(cls==='slow')return tries<=1?iso(now):null;
 const w=ENTRY_WAIT[cls];
 if(!w)return null;
 return iso(now+(tries<=w.length?w[tries-1]:REPEAT[cls]));
}

/** Gibt es die Tabellen (Migration 0040)? „Ja“ je db gemerkt, „nein“ nur eine Minute (eine später eingespielte Migration wird
    ohne Neustart erkannt) */
const known=new WeakMap();
export async function hasFailureStore(db){
 const k=known.get(db);
 if(k&&(k.ok||Date.now()-k.at<60000))return k.ok;
 let ok=false;try{ok=!!(await db.prepare("SELECT 1 AS x FROM sqlite_master WHERE type='table' AND name='work_failures'").first());}catch{ok=false;}
 known.set(db,{ok,at:Date.now()});return ok;
}

/** Zeile der Serverstufe oder null */
export async function hostRow(db,host){
 if(!host||!await hasFailureStore(db))return null;
 return await db.prepare('SELECT * FROM source_hosts WHERE host=?').bind(host).first()||null;
}
/** Alle Server, die nicht ok sind: Map host → Zeile */
export async function hostStates(db){
 if(!await hasFailureStore(db))return new Map();
 const {results}=await db.prepare("SELECT * FROM source_hosts WHERE state<>'ok'").all();
 return new Map((results||[]).map(r=>[r.host,r]));
}
/** Wartet der Server noch (wird ausgelassen)? pruefen ohne Termin wartet immer */
export const hostWaiting=(row,now=Date.now())=>!!row&&row.state!=='ok'&&(!row.next_try_at||Date.parse(row.next_try_at)>now);
/** Ist der Server fällig für eine Stichprobe (nicht ok, Termin erreicht)? */
export const hostDue=(row,now=Date.now())=>!!row&&row.state!=='ok'&&!!row.next_try_at&&Date.parse(row.next_try_at)<=now;

/** Erfolg an einem Server: ok, Zähler zurück */
export async function hostOk(db,host,now=Date.now()){
 if(!host||!await hasFailureStore(db))return;
 await db.prepare("UPDATE source_hosts SET state='ok',fails=0,level=0,next_try_at=NULL,last_ok_at=?,updated_at=? WHERE host=? AND (state<>'ok' OR fails>0)").bind(iso(now),iso(now),host).run();
}

/**
 * Fehler an einem Server. Zählt nur blocked, denied, transient. Ein Server geht in die Wartezeit, wenn er ok war und der
 * Fehler 429 war oder HOST_FAILS in Folge erreicht sind, oder wenn er gerade fällig war (Stichprobe gescheitert, Stufe +1).
 * Weitere Fehler in derselben Wartezeit zählen nur. retryAfterMs: Wunsch der Quelle, geht vor. Rückgabe: neue Zeile oder null.
 */
export async function hostFailed(db,host,cls,{now=Date.now(),retryAfterMs=null,reason=''}={}){
 if(!host||!COUNTS.has(cls)||!await hasFailureStore(db))return null;
 const row=await hostRow(db,host)||{host,state:'ok',fails:0,level:0,next_try_at:null};
 // Während der Wartezeit zählen Fehler nicht (sie stammen aus Läufen, die vor der Stufe begonnen haben)
 let fails=row.state!=='ok'&&!hostDue(row,now)?row.fails:row.fails+1;
 // ok: 429 sofort, sonst HOST_FAILS in Folge; fällig (Stichprobe): 429 sofort, sonst SAMPLE Fehler der Stichprobe
 const enter=row.state==='ok'?cls==='blocked'||fails>=HOST_FAILS:hostDue(row,now)&&(cls==='blocked'||fails>=SAMPLE);
 let {state,level,next_try_at:next}=row;
 if(enter){
  if(cls==='denied'||row.state==='gesperrt'&&cls!=='blocked'){
   const at=row.state==='gesperrt'?level:0;
   // prüfen: ein Mensch soll hinsehen (Anzeige), eine Stichprobe gibt es trotzdem alle 30 Tage, damit nichts dauerhaft vergessen wird
   if(at>=HOST_LOCK.length){state='pruefen';next=iso(now+30*D);level=at;}
   else{state='gesperrt';next=iso(now+HOST_LOCK[at]);level=at+1;}
  }else{
   const at=row.state==='bremsen'?Math.min(level,HOST_WAIT.length-1):0;
   const wanted=Number.isFinite(retryAfterMs)&&retryAfterMs>0?Math.min(HOST_WAIT.at(-1),Math.max(60000,retryAfterMs)):0;
   state='bremsen';next=iso(now+Math.max(wanted,HOST_WAIT[at]));level=at+1;
  }
  fails=0;
 }
 await db.prepare(`INSERT INTO source_hosts(host,state,fails,level,next_try_at,last_fail_at,reason,updated_at) VALUES(?,?,?,?,?,?,?,?)
  ON CONFLICT(host) DO UPDATE SET state=excluded.state,fails=excluded.fails,level=excluded.level,next_try_at=excluded.next_try_at,
  last_fail_at=excluded.last_fail_at,reason=excluded.reason,updated_at=excluded.updated_at`)
  .bind(host,state,fails,level,next,iso(now),String(reason||cls).slice(0,300),iso(now)).run();
 return {host,state,fails,level,next_try_at:next};
}

/**
 * Fehler eines Schritts vermerken (ersetzt den vorigen Eintrag desselben Schritts und Gegenstands) und die Serverstufe
 * fortschreiben. f: {step, key, host?, cls? (sonst classify(f)), http?, error?, eventDate?, origin?, retryAfterMs?, release?}.
 * Rückgabe: {class, next_try_at, tries} oder null ohne Migration.
 */
export async function recordFailure(db,f,now=Date.now()){
 if(!f?.step||!f.key||!await hasFailureStore(db))return null;
 const cls=f.cls||classify(f);
 const host=f.host||null;
 const h=await hostFailed(db,host,cls,{now,retryAfterMs:f.retryAfterMs,reason:f.error||cls});
 const old=await db.prepare('SELECT tries,first_at FROM work_failures WHERE step=? AND key=?').bind(f.step,String(f.key)).first();
 const tries=cls==='busy'?old?.tries||1:(old?.tries||0)+1;
 const hostNext=h?.next_try_at||(await hostRow(db,host))?.next_try_at||null;
 let next=nextTry(cls,tries,{now,hostNext:cls==='blocked'?hostNext:null});
 // minWaitMs: frühester neuer Versuch (teilweise Abrufe: der Nachtlauf versucht sie ohnehin jede Nacht, die Nacharbeit nur noch
 // höchstens einmal am Tag; 18.10.2026: 1.203 Versuche, 15 gelungen)
 if(next&&f.minWaitMs>0&&Date.parse(next)<now+f.minWaitMs)next=iso(now+f.minWaitMs);
 const release=cls==='internal'?f.release??currentRelease():null;
 // Herkunft zur Anzeige: Altbestand, wenn der Aufrufer es sagt oder der Eintrag nicht in den Tagesbereich fällt
 f={...f,origin:f.origin==='backlog'||!inDailyRange(f.eventDate,old?.first_at||iso(now),now)?'backlog':'daily'};
 await db.prepare(`INSERT INTO work_failures(step,key,host,class,reason,http,tries,first_at,last_at,next_try_at,event_date,origin,release) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(step,key) DO UPDATE SET host=excluded.host,class=excluded.class,reason=excluded.reason,http=excluded.http,tries=excluded.tries,
  last_at=excluded.last_at,next_try_at=excluded.next_try_at,event_date=coalesce(excluded.event_date,work_failures.event_date),
  origin=CASE WHEN work_failures.origin='daily' THEN 'daily' ELSE excluded.origin END,release=excluded.release`)
  .bind(f.step,String(f.key),host,cls,String(f.error||'').slice(0,300)||null,Number.isFinite(f.http)?f.http:null,tries,old?.first_at||iso(now),iso(now),next,f.eventDate||null,f.origin==='backlog'?'backlog':'daily',release).run();
 return {class:cls,next_try_at:next,tries};
}

/** Erfolg eines Schritts: Eintrag weg, Server ok (wenn angegeben) */
export async function clearFailure(db,{step,key,host=null},now=Date.now()){
 if(!await hasFailureStore(db))return;
 if(step&&key)await db.prepare('DELETE FROM work_failures WHERE step=? AND key=?').bind(step,String(key)).run();
 if(host)await hostOk(db,host,now);
}

/**
 * Fällige Einträge für die Nacharbeit: next_try_at erreicht, oder internal unter einem anderen Programmstand. Server, die
 * warten, werden ausgelassen; ein fälliger Server bekommt höchstens SAMPLE Einträge (Stichprobe). range: 'daily' (Tagesbereich,
 * automatische Nacharbeit), 'backlog' (Altbestand, nur auf Knopfdruck) oder 'all'. Reihenfolge: Stufen in PHASE_ORDER (erst
 * abrufen, dann extrahieren, dann verarbeiten), darin neueste Sitzung zuerst. slow nur mit includeSlow. Rückgabe: Zeilen.
 */
export async function dueEntries(db,{now=Date.now(),limit=500,perHost=20,steps=null,release=currentRelease(),includeSlow=false,range='daily'}={}){
 if(!await hasFailureStore(db))return [];
 const r=rangeWhere(range,now);
 const where=["(next_try_at<=? OR (class='internal' AND coalesce(release,'')<>?))",r.sql],args=[iso(now),release||'',...r.args];
 if(!includeSlow)where.push("class<>'slow'");
 if(steps?.length){where.push(`step IN (${steps.map(()=>'?').join(',')})`);args.push(...steps);}
 // Reihenfolge: Stufe, neueste Sitzung zuerst, darin die mit den wenigsten Versuchen (chronische Fehler blockieren keine frischen), dann älteste zuletzt versucht
 const phaseRank=`CASE step WHEN 'import' THEN 0 WHEN 'rules' THEN 2 ELSE 1 END`;
 const {results}=await db.prepare(`SELECT * FROM work_failures WHERE ${where.join(' AND ')} ORDER BY ${phaseRank},coalesce(event_date,'') DESC,tries,last_at LIMIT ?`).bind(...args,limit*4).all();
 const hosts=await hostStates(db),taken=new Map(),out=[];
 for(const r of results||[]){
  if(out.length>=limit)break;
  const row=r.host?hosts.get(r.host):null;
  if(hostWaiting(row,now))continue;
  const cap=hostDue(row,now)?SAMPLE:perHost,n=taken.get(r.host)||0;
  if(r.host&&n>=cap)continue;
  taken.set(r.host,n+1);out.push(r);
 }
 return out;
}

/**
 * Zähler für Anzeige und Protokoll: je Bereich (daily, backlog), Stufe, Schritt und Klasse: alle, fällig (die Nacharbeit nimmt
 * sie im nächsten Lauf), endgültig (kein automatischer Versuch); dazu Server je Stufe und die Grenze des Tagesbereichs.
 */
export async function failureCounts(db,now=Date.now()){
 if(!await hasFailureStore(db))return {missing:'0040'};
 const d=rangeWhere('daily',now);
 const {results}=await db.prepare(`SELECT CASE WHEN ${d.sql} THEN 'daily' ELSE 'backlog' END AS range,step,class,count(*) AS n,sum(next_try_at IS NULL) AS final,sum(next_try_at<=?) AS due FROM work_failures GROUP BY 1,2,3`).bind(...d.args,iso(now)).all();
 const hosts=(await db.prepare('SELECT state,count(*) AS n FROM source_hosts GROUP BY 1').all()).results||[];
 return {at:iso(now),boundary:dailyBoundary(now),since:DAILY_SINCE,rows:(results||[]).map(r=>({...r,phase:phaseOf(r.step)})),hosts:Object.fromEntries(hosts.map(h=>[h.state,h.n]))};
}

/** Endgültige oder wartende Einträge wieder öffnen (Knopf): nach Bereich, Stufe, Klasse, Schritt, Server oder einzeln. Rückgabe: Anzahl */
export async function reopen(db,{cls=null,step=null,host=null,key=null,range='all',phase=null}={},now=Date.now()){
 if(!await hasFailureStore(db))return 0;
 const rw=rangeWhere(range,now),where=[rw.sql],args=[...rw.args];
 if(phase){const steps=Object.keys(PHASES).filter(s=>PHASES[s]===phase);where.push(`step IN (${steps.map(()=>'?').join(',')})`);args.push(...steps);}
 if(cls){where.push('class=?');args.push(cls);}
 if(step){where.push('step=?');args.push(step);}
 if(host){where.push('host=?');args.push(host);}
 if(key){where.push('key=?');args.push(String(key));}
 const r=await db.prepare(`UPDATE work_failures SET next_try_at=?,tries=0 WHERE ${where.join(' AND ')}`).bind(iso(now),...args).run();
 if(host)await db.prepare("UPDATE source_hosts SET state='ok',fails=0,level=0,next_try_at=NULL,updated_at=? WHERE host=?").bind(iso(now),host).run();
 return r?.meta?.changes??0;
}
/** Server freigeben (Knopf „jetzt freigeben“): Termin auf jetzt, die nächste Nacharbeit macht die Stichprobe */
export async function releaseHost(db,host,now=Date.now()){
 if(!host||!await hasFailureStore(db))return;
 await db.prepare("UPDATE source_hosts SET next_try_at=?,state=CASE WHEN state='pruefen' THEN 'gesperrt' ELSE state END,updated_at=? WHERE host=?").bind(iso(now),iso(now),host).run();
}
