/**
 * Zeitpläne der Server-Jobs (Admin-Reiter „Jobs & Zeitpläne“). Die Auslöser auf dem Server (systemd-Timer; Knöpfe sofort über job-trigger.mjs und .path-Einheiten) rufen alle
 * 10 Minuten scripts/schedule.mjs <job> auf; der entscheidet nach der Einstellung hier, ob der Job jetzt dran ist, startet ihn
 * und vermerkt den Lauf. So lassen sich Jobs in der Administration ein- und ausschalten und ihre Zeit ändern, ohne die
 * Timer anzufassen. system_state:
 *  - 'schedules'      Einstellungen je Job: {enabled, time:'HH:MM'} (täglich) bzw. {enabled, every:Minuten}
 *  - 'schedule-runs'  je Job letzter Start, Ende, Dauer, Ergebnis, laufend (schedule.mjs)
 *  - 'schedule-now'   je Job „jetzt einmal ausführen“ (Zeitpunkt des Wunsches)
 * Uhrzeiten gelten in deutscher Zeit (Europe/Berlin), in 10-Minuten-Schritten (so oft fragen die Auslöser).
 */
import {BUDGET_GB} from '../../shared/pdf-rank.mjs';
export const SCHEDULES_KEY='schedules',SCHEDULE_RUNS_KEY='schedule-runs',SCHEDULE_NOW_KEY='schedule-now',SCHEDULE_STOP_KEY='schedule-stop';
/** Ergebnis des letzten Laufs von „Themen & Texte“ je Schritt (scripts/rule-texts.mjs schreibt es) */
export const RULE_TEXTS_KEY='rule-texts-last';
/** Wunsch „Alle neu erstellen“ ({requestedAt}); der nächste Lauf von scripts/rule-texts.mjs rechnet dann alles neu und löscht ihn */
export const RULE_TEXTS_ALL_KEY='rule-texts-all';
export const ZONE='Europe/Berlin',STEP_MIN=10;
/** Ein täglicher Job, der zur Zeit nicht laufen konnte (Server aus), wird so lange danach noch nachgeholt */
export const CATCH_UP_MS=3*3600000;

/**
 * Die Jobs. cmd: Befehl im Programmordner (node = derselbe Node); steps: was der Job tut, für die Anzeige.
 * Standardzeiten wie vor dem Zeitplaner (deploy/node/*.timer, Cron).
 */
export const JOBS=Object.freeze([
 {id:'accounts',label:'Konten: Pflege und Sicherung',flow:'tages',icon:'shield',time:'00:10',
  what:'Wendet die Löschfristen der Konten an, verschickt „Testzugang endet“ und Hinweise bei langer Inaktivität, prüft den Postausgang und sichert die Kontendatei verschlüsselt. Gehört nicht zur Abfolge der Tagespipeline.',
  steps:['Abgelaufene Anmeldungen, Sitzungen und Einladungen löschen, Protokolle nach Frist','Hinweismails (Testzugang endet, Inaktivität)','Kontendatei verschlüsselt sichern (age, 7 Stände)'],
  limits:'Wenige Sekunden. Ohne Kontendatei (ACCOUNTS_FILE) nichts zu tun.',warn:'Ohne diesen Job gelten keine Löschfristen und es gibt keine Sicherung der Konten.',
  cmd:['bash','deploy/node/accounts-job.sh']},
 /* Tagespipeline (jede Nacht, in dieser Reihenfolge): Sichern → Abruf → Extraktion → Verarbeitung. Namen: shared/pipeline-terms.mjs */
 {id:'backup',label:'Sichern',flow:'tages',icon:'shield',time:'00:30',
  what:'Legt eine in sich stimmige Kopie der Datenbank an, dazu Index und Texte der PDF-Ablage.',
  steps:['Älteste Sicherung löschen, damit es nie mehr als 2 sind','Kopie per VACUUM INTO (die Website läuft weiter)','PDF-Ablage: Index und Texte (sonntags voll, sonst nur Neues), keine PDFs','Mit BACKUP_REMOTE (rclone): Kopie außer Haus','Bei Fehler bleibt die vorige Sicherung'],
  limits:'Braucht so viel freien Platz wie die Datenbank groß ist.',warn:'Ohne diesen Job gibt es keine neuen Sicherungen.',
  cmd:['bash','deploy/node/backup.sh']},
 {id:'import-nightly',label:'Abruf, nachts',flow:'tages',icon:'moon',time:'01:00',
  what:'Holt aus allen angebundenen Quellen die Sitzungen und Berichte des letzten Tages und die schon angesetzten künftigen; sonntags einen Monat zurück, damit Nachträge zu älteren Sitzungen (später veröffentlichte Niederschriften, Beschlüsse) nicht fehlen. Quellen, die gerade nicht abrufbar sind, holt die Nacharbeit nach.',
  steps:['Abruf für alle Quellen anlegen (1 Tag zurück, sonntags 1 Monat); Gebiete und Server, die im Fehlerspeicher warten, zurückstellen','Berichte je Gebiet in 24 Bahnen abrufen; was scheitert, kommt in den Fehlerspeicher (Stufe Abruf)','Suche und Werte der Adminseiten je Gebiet nachführen'],
  limits:'Höchstens 4 Stunden.',
  cmd:['node','--max-old-space-size=6144','dist/standalone/worker/import-worker.mjs','--create','sources','--window','1d','--weekly-window','1m','--weekly-day','0','--max-minutes','240']},
 {id:'startseite-trends',label:'Startseite: Karte und Trends',flow:'tages',icon:'search',time:'05:10',
  what:'Rechnet für die Startseite vor, wo die Beispielbegriffe (Wärmeplanung, Kita, …) zum ersten Mal beraten wurden und wie viele Gebiete je Monat dazukamen.',
  steps:['Je Begriff die Ausbreitung rechnen wie plenara.X','Je Kreis die erste Gemeinde und den Verlauf je Monat ablegen'],
  limits:'Wenige Minuten. Ohne diesen Job zeigt die Startseite den mitgelieferten Stand.',
  cmd:['node','--no-warnings','scripts/startseite-trends.mjs']},
 {id:'pdf-nightly',label:'Extraktion, nachts',flow:'tages',icon:'file',time:'05:30',
  what:'Lädt alle PDFs der Berichte, die der Abruf seit dem letzten Lauf geschrieben hat (Hauptdokument und Anlagen, die KI liest alle), liest ihren Text und die Seiten ohne Text per OCR (Reiter PDF-Import).',
  steps:[`PDF laden: Hauptdokumente der Nacht, feste Grenze ${BUDGET_GB} GB; wartende Server auslassen`,'Anlagen laden: übrige PDFs derselben Berichte','Text lesen','OCR der neuen Dateien, Hauptdokumente zuerst (höchstens 45 Minuten; der Rest im Job „OCR, tagsüber“)','Dokumentart, Stand zählen','Verarbeitung anstoßen'],
  limits:'Höchstens 2 Stunden, Laden höchstens 48 Minuten (Hauptdokumente 29, Anlagen 19). Was scheitert, kommt in den Fehlerspeicher (Stufe Extraktion).',
  cmd:['node','--no-warnings','scripts/pdf-store/nightly.mjs','--kind','nightly','--daily','--minutes','120','--budget-gb',String(BUDGET_GB),'--ocr-workers','2']},
 {id:'rule-texts',label:'Verarbeitung, nachts',flow:'tages',icon:'text',time:'08:50',
  what:'Leitet aus Titeln und Texten ab, was nach festen Regeln geht (Reiter Themen & Texte), führt Suche und Zahlen nach und zählt, was für die KI bereitsteht.',
  steps:['Titel einordnen (Sachgebiet nach der Titelregel)','Regeln anwenden: Art des Punkts, Thema, Regel-Zusammenfassung, Fakten (nur Berichte mit neuen Eingaben)','Suche aktualisieren','Zahlen rechnen (plenara.X)','KI-Stand zählen, Wege zählen (Pipeline-Debug)'],
  limits:'Meist unter einer Stunde. Startet direkt nach „Extraktion, nachts“ (sie stößt ihn an); 08:50 Uhr nur als Rückfall.',
  cmd:['node','--no-warnings','scripts/rule-texts.mjs']},
 /* Nacharbeit (tagsüber, automatisch, nur Tagesbereich) */
 {id:'nacharbeit',label:'Nacharbeit',flow:'nacharbeit',icon:'clock',every:30,window:['09:00','23:00'],
  what:'Versucht erneut, was in der Tagespipeline gescheitert ist (Tagesbereich: Sitzungen der letzten 7 Tage, frühestens 12.10.2026), sobald der Abbruchgrund es erlaubt. Eine Quelle, die blockt, wird erst nach ihrer Wartezeit und dann mit einer Stichprobe wieder gefragt.',
  steps:['Fällige Einträge, erst Abruf, dann Extraktion, dann Verarbeitung; neueste Sitzung zuerst, je Server höchstens 20','Gelingt ein Abruf: für die geschriebenen Berichte gleich PDF laden, Anlagen laden, Text lesen, OCR, Regeln anwenden','Gescheitert: nächster Termin nach dem Grund'],
  limits:'Nur zwischen 09:00 und 23:00 Uhr, je Lauf höchstens 20 Minuten und 500 Einträge; lässt aus, wenn ein Altbestand-Auftrag lädt.',
  cmd:['node','--no-warnings','scripts/nacharbeit.mjs','--range','daily','--minutes','20']},
 {id:'ocr',label:'OCR, tagsüber',flow:'nacharbeit',icon:'scan',every:10,window:['07:00','23:00'],
  what:'Liest Seiten ohne Text (Scans) per OCR, die die Extraktion in der Nacht nicht geschafft hat (Tagesbereich): Hauptdokumente vor Anlagen, neueste Sitzung zuerst. Ist auf der Seite „Altbestand“ die OCR des Altbestands angefordert, liest er danach auch diesen (10 bis 22 Uhr).',
  steps:['Reihe ohne Dateien, die im Fehlerspeicher warten','Pakete zu 25 Dateien als eigene Prozesse, Grenzen je Seite (90 s) und Datei (5 min), Wächter','Danach für die Berichte mit neuem Text gleich Regeln anwenden und Suche aktualisieren','Ist nichts zu lesen, endet der Job sofort'],
  limits:'Nur zwischen 07:00 und 23:00 Uhr, je Lauf höchstens 3 Stunden; eigene Einheit, Anhalten trifft nur die OCR.',
  cmd:['node','--no-warnings','scripts/pdf-store/nightly.mjs','--kind','ocr','--ocr-only','--range','daily','--minutes','180','--ocr-workers','2','--until','23:00']},
 /* Altbestand und Aufträge (nur auf Knopfdruck) */
 {id:'altbestand',label:'Altbestand',flow:'altbestand',icon:'archive',every:10,window:['10:00','22:00'],
  what:'Führt aus, was auf der Seite „Altbestand“ angefordert ist: Gebiete rückwirkend abrufen (mit Extraktion und Verarbeitung der geschriebenen Berichte) und alte Fehler erneut versuchen. Ohne Anforderung endet er sofort.',
  steps:['Alte Fehler: fällige Einträge des Altbestands, erst Abruf, dann Extraktion, dann Verarbeitung','Rückwirkender Abruf: je 8 Gebiete, danach PDF laden, Anlagen laden, Text lesen, OCR, Regeln anwenden'],
  limits:'Nur zwischen 10:00 und 22:00 Uhr, je Lauf höchstens 2 Stunden; macht Platz, wenn die Nacharbeit fällige Einträge hat.',
  cmd:['node','--max-old-space-size=4096','--no-warnings','scripts/altbestand.mjs','--minutes','120','--until','22:00']},
 {id:'import',label:'Abrufaufträge',flow:'altbestand',icon:'download',every:10,
  what:'Arbeitet Abrufaufträge ab, die im Reiter „Abruf & Verarbeitung“ angelegt wurden („Im Hintergrund abrufen“).',
  steps:['Nachsehen, ob ein Auftrag offen ist','Wenn ja: abrufen wie nachts, sonst sofort fertig'],
  limits:'Höchstens 4 Stunden je Aufruf.',
  cmd:['node','--max-old-space-size=6144','dist/standalone/worker/import-worker.mjs','--run','--max-minutes','240']},
 {id:'pdf-job',label:'PDF-Aufträge und Messungen',flow:'altbestand',icon:'inbox',every:10,
  what:'Führt Aufträge aus den Reitern PDF-Import und Altbestand aus (ältere Monate laden, Anlagen laden, Text lesen), zählt den Stand der Ablage auf Wunsch neu und misst stündlich den Speicher.',
  steps:['Lebenszeichen für die Administration','Wartenden Auftrag starten (einer zur Zeit, 10 bis 22 Uhr)','„Stand neu zählen“ und Speichermessung'],
  limits:'Ein Auftrag höchstens 3 Stunden.',warn:'Ohne diesen Job starten die Knöpfe im Reiter PDF-Import nichts.',
  cmd:['node','--no-warnings','scripts/pdf-store/job.mjs','--minutes','180','--budget-gb',String(BUDGET_GB)]},
]);
export const EVERY_CHOICES=[10,20,30,60,120];
const parse=v=>{try{return v?JSON.parse(v):null;}catch{return null;}};

/** Einstellung eines Jobs: gespeichert oder Standard */
export function settingOf(job,saved){
 const s=saved?.[job.id]||{};
 return job.every?{enabled:s.enabled!==false,every:EVERY_CHOICES.includes(s.every)?s.every:job.every}
  :{enabled:s.enabled!==false,time:/^([01]\d|2[0-3]):[0-5]0$/.test(s.time||'')?s.time:job.time};
}

/* Deutsche Uhrzeit: Versatz zu UTC zum Zeitpunkt t (Minuten) */
function offsetMin(t){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:ZONE,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).formatToParts(new Date(t)).map(x=>[x.type,x.value]));
 return Math.round((Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute)-Math.floor(t/60000)*60000)/60000);
}
/** Zeitpunkt (ms) der Uhrzeit HH:MM deutscher Zeit am Tag von `t`, `days` Tage später */
export function slotAt(t,time,days=0){
 const off=offsetMin(t),local=new Date(t+off*60000),[h,m]=time.split(':').map(Number);
 const guess=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate()+days,h,m);
 return guess-offsetMin(guess-off*60000)*60000;
}
/** Liegt `now` im Tagesfenster eines Jobs (window ['HH:MM','HH:MM'], deutsche Zeit)? Ohne Fenster immer */
export function inWindow(job,now=Date.now()){
 if(!job.window)return true;
 return now>=slotAt(now,job.window[0])&&now<slotAt(now,job.window[1]);
}
/** Ist der Job jetzt dran? {due, slot} ohne Rücksicht auf ein/aus (das prüft der Aufrufer) */
export function dueNow(job,setting,run,now=Date.now()){
 const last=run?.lastStart?Date.parse(run.lastStart):0;
 if(setting.every)return {due:inWindow(job,now)&&(!last||now-last>=(setting.every-1)*60000),slot:null};
 const slot=slotAt(now,setting.time);
 return {due:now>=slot&&now-slot<CATCH_UP_MS&&last<slot,slot};
}
/** Offene Wünsche aus der Administration, die ein Job gleich erledigen soll, auch wenn er ausgeschaltet ist (ein Knopfdruck
    zählt wie „jetzt ausführen“; der Schalter stoppt nur die geplanten Zeiten): beim Auftragsdienst „Stand neu zählen“,
    „Neu messen“, wartende Aufträge und ein als laufend vermerkter Auftrag (läuft der Dienst gar nicht, war er abgebrochen;
    job.mjs vermerkt ihn dann, statt dass er bis zum nächsten Einschalten als „läuft“ stehen bleibt). get: Schlüssel → Wert */
export function pendingWork(id,get,now=Date.now()){
 if(id==='altbestand'){const r=get('altbestand-requests')||{};return inWindow(JOBS.find(j=>j.id==='altbestand'),now)&&(!!r.import&&!r.import.finishedAt&&!r.import.stoppedAt||!!r.rework&&!r.rework.finishedAt);}
 if(id!=='pdf-job')return false;
 const open=x=>!!x?.requestedAt&&!x.startedAt,jobs=get('pdf-store-job');
 return open(get('pdf-store-count'))||open(get('server-disk-count'))||(Array.isArray(jobs?.queue)?jobs.queue.length>0:jobs?.state==='waiting')||jobs?.current?.state==='running'||
  Object.values(jobs?.running||{}).some(j=>j?.state==='running');
}
/** Nächster geplanter Start (ms) */
export function nextRun(job,setting,run,now=Date.now()){
 if(!setting.enabled)return null;
 if(setting.every){
  const last=run?.lastStart?Date.parse(run.lastStart):0,next=Math.max(now,last+setting.every*60000);
  if(!job.window||inWindow(job,next))return next;
  const open=slotAt(next,job.window[0]);return next<open?open:slotAt(next,job.window[0],1);
 }
 const today=slotAt(now,setting.time),last=run?.lastStart?Date.parse(run.lastStart):0;
 return now<today||last<today&&now-today<CATCH_UP_MS?today:slotAt(now,setting.time,1);
}

/** Alle Jobs mit Einstellung, letztem Lauf, nächstem Start (nur lesen) */
export async function schedulesState(db,now=Date.now()){
 const {results}=await db.prepare('SELECT key,value FROM system_state WHERE key IN (?,?,?,?,?,?)').bind(SCHEDULES_KEY,SCHEDULE_RUNS_KEY,SCHEDULE_NOW_KEY,SCHEDULE_STOP_KEY,RULE_TEXTS_KEY,RULE_TEXTS_ALL_KEY).all();
 const by=new Map(results.map(r=>[r.key,parse(r.value)]));
 const saved=by.get(SCHEDULES_KEY)||{},runs=by.get(SCHEDULE_RUNS_KEY)||{},asked=by.get(SCHEDULE_NOW_KEY)||{},stops=by.get(SCHEDULE_STOP_KEY)||{};
 return {jobs:JOBS.map(({cmd,...job})=>{const setting=settingOf(job,saved),run=runs[job.id]||null;
  return {...job,setting,run,...(job.id==='rule-texts'?{last:by.get(RULE_TEXTS_KEY)||null,all:by.get(RULE_TEXTS_ALL_KEY)||null}:{}),now:asked[job.id]||null,stop:stops[job.id]||null,next:(n=>n&&new Date(n).toISOString())(nextRun(job,setting,run,now))};}),
  managed:Object.keys(runs).length>0};
}

/** Laufenden Job anhalten: Wunsch vermerken ('schedule-stop', für die Anzeige „wird angehalten“); angehalten wird auf dem
    Server über die Auslöser-Datei stop-<job> (job-trigger.mjs, deploy/node/ratsmonitor-stop-*.path → systemctl stop) */
export async function requestScheduleStop(db,id,now=new Date()){
 if(!JOBS.some(j=>j.id===id))throw Object.assign(Error('Unbekannter Job.'),{status:400});
 const row=await db.prepare('SELECT value FROM system_state WHERE key=?').bind(SCHEDULE_STOP_KEY).first();
 const next={...(parse(row?.value)||{}),[id]:now.toISOString()};
 await db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(SCHEDULE_STOP_KEY,JSON.stringify(next)).run();
 return {requestedAt:next[id]};
}
/** Einstellung ändern: {enabled?, time?, every?} */
export async function setSchedule(db,id,{enabled,time,every}={}){
 const job=JOBS.find(j=>j.id===id);if(!job)throw Object.assign(Error('Unbekannter Job.'),{status:400});
 if(enabled!==undefined&&typeof enabled!=='boolean')throw Object.assign(Error('Ungültige Angabe.'),{status:400});
 if(time!==undefined&&(job.every||!/^([01]\d|2[0-3]):[0-5]0$/.test(time)))throw Object.assign(Error('Uhrzeit in 10-Minuten-Schritten angeben (etwa 01:00 oder 05:30).'),{status:400});
 if(every!==undefined&&(!job.every||!EVERY_CHOICES.includes(every)))throw Object.assign(Error('Ungültiger Abstand.'),{status:400});
 const row=await db.prepare('SELECT value FROM system_state WHERE key=?').bind(SCHEDULES_KEY).first();
 const saved=parse(row?.value)||{},cur=saved[id]||{};
 const next={...saved,[id]:{...cur,...(enabled!==undefined?{enabled}:{}),...(time!==undefined?{time}:{}),...(every!==undefined?{every}:{}),changedAt:new Date().toISOString()}};
 await db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(SCHEDULES_KEY,JSON.stringify(next)).run();
 return {setting:settingOf(job,next)};
}
/** „Themen & Texte“ alle neu erstellen: Wunsch vermerken, dann wie „jetzt ausführen“ */
export async function requestRuleTextsAll(db,now=new Date()){
 await db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(RULE_TEXTS_ALL_KEY,JSON.stringify({requestedAt:now.toISOString()})).run();
 return runScheduleNow(db,'rule-texts',now);
}
/** Job beim nächsten Aufruf (binnen 10 Minuten) einmal ausführen, auch wenn er ausgeschaltet ist */
export async function runScheduleNow(db,id,now=new Date()){
 if(!JOBS.some(j=>j.id===id))throw Object.assign(Error('Unbekannter Job.'),{status:400});
 const row=await db.prepare('SELECT value FROM system_state WHERE key=?').bind(SCHEDULE_NOW_KEY).first();
 const next={...(parse(row?.value)||{}),[id]:now.toISOString()};
 await db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(SCHEDULE_NOW_KEY,JSON.stringify(next)).run();
 return {requestedAt:next[id]};
}
