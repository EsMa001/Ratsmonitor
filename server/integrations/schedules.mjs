/**
 * Zeitpläne der Server-Jobs (Admin-Reiter „Jobs & Zeitpläne“). Die Auslöser auf dem Server (systemd-Timer, Cron) rufen alle
 * 10 Minuten scripts/schedule.mjs <job> auf; der entscheidet nach der Einstellung hier, ob der Job jetzt dran ist, startet ihn
 * und vermerkt den Lauf. So lassen sich Jobs in der Administration ein- und ausschalten und ihre Zeit ändern, ohne die
 * Timer anzufassen. system_state:
 *  - 'schedules'      Einstellungen je Job: {enabled, time:'HH:MM'} (täglich) bzw. {enabled, every:Minuten}
 *  - 'schedule-runs'  je Job letzter Start, Ende, Dauer, Ergebnis, laufend (schedule.mjs)
 *  - 'schedule-now'   je Job „jetzt einmal ausführen“ (Zeitpunkt des Wunsches)
 * Uhrzeiten gelten in deutscher Zeit (Europe/Berlin), in 10-Minuten-Schritten (so oft fragen die Auslöser).
 */
export const SCHEDULES_KEY='schedules',SCHEDULE_RUNS_KEY='schedule-runs',SCHEDULE_NOW_KEY='schedule-now';
export const ZONE='Europe/Berlin',STEP_MIN=10;
/** Ein täglicher Job, der zur Zeit nicht laufen konnte (Server aus), wird so lange danach noch nachgeholt */
export const CATCH_UP_MS=3*3600000;

/**
 * Die Jobs. cmd: Befehl im Programmordner (node = derselbe Node); steps: was der Job tut, für die Anzeige.
 * Standardzeiten wie vor dem Zeitplaner (deploy/node/*.timer, Cron).
 */
export const JOBS=Object.freeze([
 {id:'import-nightly',label:'Berichte abrufen, nachts',icon:'moon',time:'01:00',
  what:'Holt aus allen angebundenen Quellen die Berichte der letzten Woche: neue Vorgänge, geänderte Stände, neue Dokumente.',
  steps:['Abruf für alle Quellen anlegen (Zeitraum 1 Woche)','Berichte je Gebiet in 24 Bahnen abrufen','Einordnen nach festen Regeln, Zusammenfassungen, Werte der Adminseiten nachführen'],
  limits:'Höchstens 4 Stunden; was nicht fertig wird, holt der laufende Abruf nach.',
  cmd:['node','--max-old-space-size=6144','dist/standalone/worker/import-worker.mjs','--create','sources','--window','1w','--max-minutes','240']},
 {id:'backup',label:'Datensicherung',icon:'shield',time:'03:30',
  what:'Legt eine in sich stimmige Kopie der Datenbank an.',
  steps:['Älteste Sicherung löschen, damit es nie mehr als 2 sind','Kopie per VACUUM INTO (die Website läuft weiter)','Bei Fehler bleibt die vorige Sicherung'],
  limits:'Braucht so viel freien Platz wie die Datenbank groß ist.',warn:'Ohne diesen Job gibt es keine neuen Sicherungen.',
  cmd:['bash','deploy/node/backup.sh']},
 {id:'search-words',label:'Wortliste der Suche',icon:'search',time:'04:20',
  what:'Führt die Wortliste der Suche nach, damit Suchen schnell bleiben; fehlen die vorberechneten Zahlen, baut er sie neu auf.',
  steps:['Neue und geänderte Karten einlesen','Vorberechnete Zahlen je Gebiet und Thema nachführen'],
  limits:'Nachführen wenige Minuten, voller Neuaufbau bis etwa eine Stunde.',
  cmd:['node','--no-warnings','--max-old-space-size=6144','scripts/refresh-search-words.mjs']},
 {id:'pdf-nightly',label:'PDF-Import, nachts',icon:'file',time:'05:30',
  what:'Lädt die PDF-Hauptdokumente neuer Berichte, liest ihren Text und wertet ihn aus (Reiter PDF-Import).',
  steps:['PDFs laden, neueste Sitzungen zuerst, feste Grenze 100 GB','Textebene lesen, Scans per OCR','Zusammenfassungen, Fakten, Wortliste','Stand für den Reiter PDF-Import zählen'],
  limits:'Höchstens 3 Stunden, Laden höchstens 72 Minuten.',
  cmd:['node','--no-warnings','scripts/pdf-store/nightly.mjs','--kind','nightly','--minutes','180','--budget-gb','100','--ocr-workers','2']},
 {id:'import',label:'Abrufaufträge',icon:'download',every:10,
  what:'Arbeitet Abrufaufträge ab, die im Reiter „Abruf & Verarbeitung“ angelegt wurden („Im Hintergrund abrufen“).',
  steps:['Nachsehen, ob ein Auftrag offen ist','Wenn ja: abrufen wie nachts, sonst sofort fertig'],
  limits:'Höchstens 4 Stunden je Aufruf.',
  cmd:['node','--max-old-space-size=6144','dist/standalone/worker/import-worker.mjs','--run','--max-minutes','240']},
 {id:'pdf-job',label:'PDF-Aufträge und Messungen',icon:'inbox',every:10,
  what:'Führt Aufträge aus dem Reiter PDF-Import aus, zählt dessen Stand auf Wunsch neu und misst stündlich den Speicher.',
  steps:['Lebenszeichen für die Administration','Wartenden Auftrag starten (einer zur Zeit)','„Stand neu zählen“ und Speichermessung'],
  limits:'Ein Auftrag höchstens 3 Stunden.',warn:'Ohne diesen Job starten die Knöpfe im Reiter PDF-Import nichts.',
  cmd:['node','--no-warnings','scripts/pdf-store/job.mjs','--minutes','180','--budget-gb','100']},
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
/** Ist der Job jetzt dran? {due, slot} ohne Rücksicht auf ein/aus (das prüft der Aufrufer) */
export function dueNow(job,setting,run,now=Date.now()){
 const last=run?.lastStart?Date.parse(run.lastStart):0;
 if(setting.every)return {due:!last||now-last>=(setting.every-1)*60000,slot:null};
 const slot=slotAt(now,setting.time);
 return {due:now>=slot&&now-slot<CATCH_UP_MS&&last<slot,slot};
}
/** Nächster geplanter Start (ms) */
export function nextRun(job,setting,run,now=Date.now()){
 if(!setting.enabled)return null;
 if(setting.every){const last=run?.lastStart?Date.parse(run.lastStart):0;return Math.max(now,last+setting.every*60000);}
 const today=slotAt(now,setting.time),last=run?.lastStart?Date.parse(run.lastStart):0;
 return now<today||last<today&&now-today<CATCH_UP_MS?today:slotAt(now,setting.time,1);
}

/** Alle Jobs mit Einstellung, letztem Lauf, nächstem Start (nur lesen) */
export async function schedulesState(db,now=Date.now()){
 const {results}=await db.prepare('SELECT key,value FROM system_state WHERE key IN (?,?,?)').bind(SCHEDULES_KEY,SCHEDULE_RUNS_KEY,SCHEDULE_NOW_KEY).all();
 const by=new Map(results.map(r=>[r.key,parse(r.value)]));
 const saved=by.get(SCHEDULES_KEY)||{},runs=by.get(SCHEDULE_RUNS_KEY)||{},asked=by.get(SCHEDULE_NOW_KEY)||{};
 return {jobs:JOBS.map(({cmd,...job})=>{const setting=settingOf(job,saved),run=runs[job.id]||null;
  return {...job,setting,run,now:asked[job.id]||null,next:(n=>n&&new Date(n).toISOString())(nextRun(job,setting,run,now))};}),
  managed:Object.keys(runs).length>0};
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
/** Job beim nächsten Aufruf (binnen 10 Minuten) einmal ausführen, auch wenn er ausgeschaltet ist */
export async function runScheduleNow(db,id,now=new Date()){
 if(!JOBS.some(j=>j.id===id))throw Object.assign(Error('Unbekannter Job.'),{status:400});
 const row=await db.prepare('SELECT value FROM system_state WHERE key=?').bind(SCHEDULE_NOW_KEY).first();
 const next={...(parse(row?.value)||{}),[id]:now.toISOString()};
 await db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(SCHEDULE_NOW_KEY,JSON.stringify(next)).run();
 return {requestedAt:next[id]};
}
