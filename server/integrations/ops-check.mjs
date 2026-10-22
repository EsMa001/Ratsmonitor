/**
 * Betriebsprüfung (Zeitplaner-Job „betrieb“, scripts/ops-check.mjs; docs/betrieb/node-server.md, „Betriebsüberwachung“):
 * einmal am Tag prüfen, ob der Betrieb in Ordnung ist, und neue Befunde als eine Sammelmail an OPERATOR_EMAIL schicken.
 * Hier steht nur die Schwellenlogik (ohne Datenbank und Dateisystem, Test tests/ops-check.test.mjs); das Skript sammelt die
 * Eingaben und verschickt.
 *
 * Prüfungen (Schlüssel der Warnung):
 *  - unit:<Einheit>      systemd-Auslöser (Timer, Pfad) nicht aktiv; units-stale: der Zeitplaner wird nicht mehr aufgerufen
 *  - job-missed:<Job>    täglicher Job der Tagespipeline ist heute nicht gelaufen, obwohl seine Zeit samt Nachholfrist vorbei ist
 *  - job-failed:<Job>    letzter Lauf eines Jobs heute mit Fehler
 *  - backup-none / backup-old   keine Sicherung bzw. älter als die Grenze (36 h)
 *  - disk                Platte über der Grenze (85 %)
 *  - db-growth           Datenbank wächst schneller als die Grenze (3 GB je Tag, gegen die Messung des vorigen Laufs)
 * Dieselbe Warnung geht höchstens einmal am Tag (deutsche Zeit); Stand in system_state 'ops-check':
 *  {date, sent:{Schlüssel: Zeitpunkt}, warnings:[Schlüssel], lastRunAt, measure:{at, dbBytes}}
 */
import {JOBS,CATCH_UP_MS,ZONE,settingOf,slotAt,unitsWarning} from './schedules.mjs';

export const OPS_KEY='ops-check';
/** Der prüfende Job selbst (zählt bei „heute nicht gelaufen“ nicht mit) */
export const OPS_JOB='betrieb';
export const OPS_DEFAULTS=Object.freeze({backupHours:36,diskPercent:85,dbGrowthGb:3});
const GB=1073741824,HOUR=3600000,DAY=86400000;
const iso=ms=>new Date(ms).toISOString();
const gb=bytes=>(bytes/GB).toFixed(1);
/** Grenzen aus der Umgebung (OPS_BACKUP_HOURS, OPS_DISK_PERCENT, OPS_DB_GROWTH_GB), sonst Standard */
export function opsThresholds(env={}){
 const num=(v,d)=>{const n=Number(v);return v!==undefined&&v!==''&&Number.isFinite(n)&&n>0?n:d;};
 return {backupHours:num(env.OPS_BACKUP_HOURS,OPS_DEFAULTS.backupHours),diskPercent:num(env.OPS_DISK_PERCENT,OPS_DEFAULTS.diskPercent),dbGrowthGb:num(env.OPS_DB_GROWTH_GB,OPS_DEFAULTS.dbGrowthGb)};
}
/** Kalendertag deutscher Zeit (JJJJ-MM-TT) */
export const berlinDay=now=>new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));

/**
 * Warnungen [{key,text}] aus den Eingaben:
 *  now; units: Stand 'systemd-units'; runs: 'schedule-runs'; schedules: 'schedules' (Einstellungen); backupAt: Zeitpunkt der
 *  jüngsten Sicherung (ISO) oder null; disk: {total,used} in Bytes oder null; dbBytes: Größe der Datenbank samt WAL;
 *  prev: {at,dbBytes} der vorigen Messung oder null.
 */
export function opsWarnings({now=Date.now(),units=null,runs={},schedules=null,backupAt=null,disk=null,dbBytes=null,prev=null}={},t=OPS_DEFAULTS){
 const out=[],warn=(key,text)=>out.push({key,text});
 /* 1. Auslöser */
 const u=unitsWarning(units,now);
 if(u){
  if(u.stale)warn('units-stale',`Der Zeitplaner wurde seit ${iso(Date.parse(u.at))} nicht mehr aufgerufen: kein systemd-Timer fragt mehr (systemctl list-timers 'ratsmonitor-*').`);
  for(const name of u.inactive)warn('unit:'+name,`Auslöser ${name} ist nicht aktiv (systemctl start ${name}).`);
 }else if(Object.keys(runs||{}).length)warn('units-unknown','Kein Stand der systemd-Auslöser vorhanden, obwohl der Zeitplaner Läufe vermerkt hat (systemctl im Zeitplaner nicht erreichbar?).');
 /* 2. Tagespipeline heute: tägliche Jobs, eingeschaltet, Zeit samt Nachholfrist vorbei, kein Start seit Mitternacht */
 const midnight=slotAt(now,'00:00');
 for(const job of JOBS){
  if(job.id===OPS_JOB||job.every)continue;
  const setting=settingOf(job,schedules),run=runs?.[job.id]||null;
  const started=run?.lastStart?Date.parse(run.lastStart):0,ended=run?.lastEnd?Date.parse(run.lastEnd):0;
  if(ended>=midnight&&run.result==='failed')warn('job-failed:'+job.id,`Job „${job.label}“ (${job.id}) endete heute mit Fehler (Exit ${run.exit??'?'}, ${run.lastEnd}).`);
  if(!setting.enabled)continue;
  const due=slotAt(now,setting.time)+CATCH_UP_MS;
  // Rückfallzeit (rule-texts): der Job läuft angestoßen von der Nachtkette; erst wenn auch die Rückfallzeit samt Frist vorbei ist, fehlt er
  if(now>=due&&started<midnight)warn('job-missed:'+job.id,`Job „${job.label}“ (${job.id}) ist heute nicht gelaufen (geplant ${setting.time} Uhr${run?.lastStart?`, zuletzt ${run.lastStart}`:', noch nie'}).`);
 }
 /* 3. Sicherung */
 const backupT=backupAt?Date.parse(backupAt):NaN;
 if(!Number.isFinite(backupT))warn('backup-none','Keine Sicherung der Datenbank gefunden (BACKUP_DIR).');
 else if(now-backupT>t.backupHours*HOUR)warn('backup-old',`Die letzte Sicherung ist ${Math.round((now-backupT)/HOUR)} Stunden alt (${iso(backupT)}, Grenze ${t.backupHours} h).`);
 /* 4. Platte */
 if(disk&&disk.total>0){
  const pct=disk.used/disk.total*100;
  if(pct>=t.diskPercent)warn('disk',`Platte zu ${pct.toFixed(0)} % belegt (${gb(disk.used)} von ${gb(disk.total)} GB, frei ${gb(disk.total-disk.used)} GB; Grenze ${t.diskPercent} %).`);
 }
 /* 5. Wachstum der Datenbank gegen die vorige Messung (frühestens nach 12 Stunden, sonst rauscht es) */
 const prevT=prev?.at?Date.parse(prev.at):NaN;
 if(dbBytes!=null&&prev?.dbBytes!=null&&Number.isFinite(prevT)&&now-prevT>=DAY/2){
  const perDay=(dbBytes-prev.dbBytes)/((now-prevT)/DAY);
  if(perDay>=t.dbGrowthGb*GB)warn('db-growth',`Die Datenbank wächst um ${gb(perDay)} GB je Tag (jetzt ${gb(dbBytes)} GB, vorige Messung ${gb(prev.dbBytes)} GB am ${iso(prevT)}; Grenze ${t.dbGrowthGb} GB).`);
 }
 return out;
}

/**
 * Sammelmail: welche Warnungen heute noch nicht gemeldet wurden, und der neue Stand. Ein neuer Tag (deutsche Zeit) beginnt mit
 * leerem Gedächtnis, eine Warnung, die am Tag schon ging, kommt nicht noch einmal. markSent=false lässt den Stand der
 * gemeldeten unverändert (wenn der Versand scheitert, damit der nächste Lauf sie erneut versucht).
 */
export function opsDigest(state,warnings,{now=Date.now(),markSent=true}={}){
 const day=berlinDay(now),sent=state?.date===day&&state.sent?{...state.sent}:{};
 const fresh=warnings.filter(w=>!sent[w.key]);
 if(markSent)for(const w of fresh)sent[w.key]=iso(now);
 return {fresh,state:{...(state||{}),date:day,sent,warnings:warnings.map(w=>w.key),lastRunAt:iso(now)}};
}
/** Betreff und Text der Sammelmail: neue Befunde zuerst, darunter alles, was heute noch gilt */
export function opsMail(fresh,all,{now=Date.now(),host=''}={}){
 const other=all.filter(a=>!fresh.some(f=>f.key===a.key));
 const lines=[`Betriebsprüfung ${iso(now)}${host?` auf ${host}`:''}: ${all.length} ${all.length===1?'Befund':'Befunde'}, davon ${fresh.length} neu.`,'',
  'Neu:',...fresh.map(w=>`- ${w.text}`)];
 if(other.length)lines.push('','Bereits gemeldet, gilt weiter:',...other.map(w=>`- ${w.text}`));
 lines.push('','Dieselbe Warnung wird je Tag nur einmal gemeldet. Einzelheiten: /admin?seite=nacht und /admin?seite=zeitplaene.');
 return {subject:`${fresh.length} ${fresh.length===1?'neuer Befund':'neue Befunde'} der Betriebsprüfung`,message:lines.join('\n')};
}
