// Betriebsprüfung (server/integrations/ops-check.mjs): Schwellen der Sammelmail, höchstens einmal je Warnung und Tag, und
// der Versand an den Betreiber über den Postausgang (server/integrations/operator-notify.mjs, Transport log).
import test from 'node:test';
import assert from 'node:assert/strict';
import {opsWarnings,opsDigest,opsMail,opsThresholds,berlinDay,OPS_DEFAULTS,OPS_JOB} from '../server/integrations/ops-check.mjs';
import {JOBS,unitNames} from '../server/integrations/schedules.mjs';
import {notifyOperator,trimNotice,SUBJECT_MAX} from '../server/integrations/operator-notify.mjs';
import {render} from '../server/accounts/mail-templates.mjs';
import {setup} from './helpers/accounts.mjs';

// 22.10.2026 09:30 deutscher Zeit (Sommerzeit, UTC+2)
const NOW=Date.parse('2026-10-22T07:30:00Z');
const GB=1073741824,H=3600000;
const ranToday=JOBS.filter(j=>!j.every).map(j=>[j.id,{lastStart:'2026-10-22T03:00:00Z',lastEnd:'2026-10-22T03:10:00Z',result:'ok'}]);
/** Alles in Ordnung */
const fine=()=>({now:NOW,units:{at:new Date(NOW-5*60000).toISOString(),units:Object.fromEntries(unitNames().map(n=>[n,'active']))},
 runs:Object.fromEntries(ranToday),schedules:null,backupAt:'2026-10-22T00:40:00Z',disk:{total:100*GB,used:70*GB},dbBytes:30*GB,prev:{at:new Date(NOW-24*H).toISOString(),dbBytes:29*GB}});
const keys=w=>w.map(x=>x.key).sort();

test('nothing to report when everything is fine',()=>{
 assert.deepEqual(opsWarnings(fine()),[]);
 assert.ok(JOBS.some(j=>j.id===OPS_JOB),'der prüfende Job steht im Zeitplaner');
});

test('timers: inactive units and a stale scheduler',()=>{
 const i=fine();i.units.units['ratsmonitor-ocr.timer']='inactive';
 assert.deepEqual(keys(opsWarnings(i)),['unit:ratsmonitor-ocr.timer']);
 assert.match(opsWarnings(i)[0].text,/systemctl start ratsmonitor-ocr\.timer/);
 const s=fine();s.units.at=new Date(NOW-2*H).toISOString();
 assert.deepEqual(keys(opsWarnings(s)),['units-stale']);
 const none=fine();none.units=null;
 assert.deepEqual(keys(opsWarnings(none)),['units-unknown'],'Läufe vermerkt, aber kein Stand der Auslöser');
 none.runs={};
 assert.deepEqual(keys(opsWarnings(none)).filter(k=>k.startsWith('units')),[],'lokal ohne Zeitplaner: keine Warnung');
});

test('daily pipeline: jobs whose time plus catch-up has passed and that did not start today',()=>{
 const i=fine();i.runs={};
 const missed=keys(opsWarnings(i)).filter(k=>k.startsWith('job-missed:')).map(k=>k.slice('job-missed:'.length));
 // um 09:30 sind 00:10, 00:30, 01:00, 05:10, 05:30 samt 3 h Nachholfrist vorbei; 08:50 (rule-texts, Rückfall) und der Prüfjob selbst nicht
 assert.deepEqual(missed,['accounts','backup','import-nightly','pdf-nightly','startseite-trends']);
 assert.ok(!missed.includes(OPS_JOB)&&!missed.includes('rule-texts'));
 // ausgeschaltet zählt nicht; gelaufen (auch ausgelassen vermerkt) zählt nicht; gestern gelaufen zählt
 i.schedules={'pdf-nightly':{enabled:false}};
 // Mitternacht deutscher Zeit ist 22:00Z: 21:10Z am 21.10. ist gestern, 22:10Z schon heute
 i.runs={backup:{lastStart:'2026-10-22T00:30:00Z',lastEnd:'2026-10-22T00:40:00Z',result:'ok'},accounts:{lastStart:'2026-10-21T21:10:00Z',lastEnd:'2026-10-21T21:10:05Z',result:'ok'}};
 const again=keys(opsWarnings(i)).filter(k=>k.startsWith('job-missed:'));
 assert.deepEqual(again,['job-missed:accounts','job-missed:import-nightly','job-missed:startseite-trends']);
 assert.match(opsWarnings(i).find(w=>w.key==='job-missed:accounts').text,/zuletzt 2026-10-21T21:10:00Z/);
 i.runs.accounts.lastStart='2026-10-21T22:10:00Z';
 assert.ok(!keys(opsWarnings(i)).includes('job-missed:accounts'),'00:10 deutscher Zeit ist heute');
 // Fehler heute: eigene Warnung, auch wenn der Job lief
 const f=fine();f.runs.backup={lastStart:'2026-10-22T00:30:00Z',lastEnd:'2026-10-22T00:31:00Z',result:'failed',exit:1};
 assert.deepEqual(keys(opsWarnings(f)),['job-failed:backup']);
 assert.match(opsWarnings(f)[0].text,/Exit 1/);
 // Fehler gestern: nicht mehr
 f.runs.backup.lastEnd='2026-10-21T00:31:00Z';f.runs.backup.lastStart='2026-10-21T00:30:00Z';
 assert.deepEqual(keys(opsWarnings(f)),['job-missed:backup']);
});

test('backup age, disk usage, database growth against thresholds',()=>{
 const b=fine();b.backupAt=new Date(NOW-37*H).toISOString();
 assert.deepEqual(keys(opsWarnings(b)),['backup-old']);assert.match(opsWarnings(b)[0].text,/37 Stunden/);
 b.backupAt=new Date(NOW-35*H).toISOString();assert.deepEqual(opsWarnings(b),[]);
 b.backupAt=null;assert.deepEqual(keys(opsWarnings(b)),['backup-none']);
 assert.deepEqual(keys(opsWarnings({...fine(),backupAt:new Date(NOW-40*H).toISOString()},{...OPS_DEFAULTS,backupHours:48})),[],'eigene Grenze');
 const d=fine();d.disk={total:100*GB,used:85*GB};
 assert.deepEqual(keys(opsWarnings(d)),['disk']);assert.match(opsWarnings(d)[0].text,/85 %.*frei 15\.0 GB/);
 d.disk.used=84*GB;assert.deepEqual(opsWarnings(d),[]);
 d.disk=null;assert.deepEqual(opsWarnings(d),[],'ohne Messung keine Warnung');
 const g=fine();g.dbBytes=33*GB;
 assert.deepEqual(keys(opsWarnings(g)),['db-growth']);assert.match(opsWarnings(g)[0].text,/4\.0 GB je Tag/);
 g.prev={at:new Date(NOW-48*H).toISOString(),dbBytes:29*GB};assert.deepEqual(opsWarnings(g),[],'über zwei Tage sind es 2 GB je Tag');
 g.prev={at:new Date(NOW-H).toISOString(),dbBytes:29*GB};assert.deepEqual(opsWarnings(g),[],'vorige Messung zu frisch: kein Urteil');
 g.prev=null;assert.deepEqual(opsWarnings(g),[],'erste Messung');
 assert.deepEqual(opsThresholds({OPS_BACKUP_HOURS:'48',OPS_DISK_PERCENT:'x',OPS_DB_GROWTH_GB:''}),{backupHours:48,diskPercent:85,dbGrowthGb:3,docIndexDays:2,docIndexBacklogPercent:5});
});

test('digest: each warning once per German day; a failed send keeps it fresh',()=>{
 const w=[{key:'disk',text:'Platte voll'},{key:'backup-old',text:'Sicherung alt'}];
 const first=opsDigest(null,w,{now:NOW});
 assert.equal(first.fresh.length,2);assert.equal(first.state.date,'2026-10-22');
 assert.deepEqual(Object.keys(first.state.sent).sort(),['backup-old','disk']);
 const later=opsDigest(first.state,[...w,{key:'db-growth',text:'wächst'}],{now:NOW+2*H});
 assert.deepEqual(later.fresh.map(x=>x.key),['db-growth'],'nur die neue');
 assert.deepEqual(later.state.warnings,['disk','backup-old','db-growth'],'alle, die gelten');
 const tomorrow=opsDigest(later.state,w,{now:NOW+17*H});// 00:30 deutscher Zeit am 23.10.
 assert.equal(berlinDay(NOW+17*H),'2026-10-23');
 assert.equal(tomorrow.fresh.length,2,'neuer Tag, alles wieder');
 const kept=opsDigest(first.state,[...w,{key:'db-growth',text:'wächst'}],{now:NOW+2*H,markSent:false});
 assert.deepEqual(Object.keys(kept.state.sent).sort(),['backup-old','disk'],'Versand gescheitert: nicht als gemeldet merken');
 const none=opsDigest(first.state,[],{now:NOW+3*H});
 assert.equal(none.fresh.length,0);assert.deepEqual(none.state.warnings,[]);
});

test('mail text names new findings first, then the ones already reported',()=>{
 const all=[{key:'disk',text:'Platte voll'},{key:'backup-old',text:'Sicherung alt'}],fresh=[all[1]];
 const m=opsMail(fresh,all,{now:NOW,host:'vps'});
 assert.equal(m.subject,'1 neuer Befund der Betriebsprüfung');
 assert.match(m.message,/auf vps: 2 Befunde, davon 1 neu/);
 assert.ok(m.message.indexOf('Sicherung alt')<m.message.indexOf('Platte voll'));
 assert.match(m.message,/Bereits gemeldet/);
 assert.equal(opsMail(all,all,{now:NOW}).subject,'2 neue Befunde der Betriebsprüfung');
 assert.ok(!/Bereits gemeldet/.test(opsMail(all,all,{now:NOW}).message));
});

test('notifyOperator: through the outbox, delivered at once; with MAIL_TRANSPORT=log a line in the log',async()=>{
 const h=setup({access:'open',extraEnv:{MAIL_TRANSPORT:'log',OPERATOR_EMAIL:'betrieb@example.org'}});
 delete h.env.ACCOUNTS_TEST_OUTBOX;
 const {accountsConfig}=await import('../server/accounts/config.mjs');
 const cfg=accountsConfig(h.env,{dev:false});
 assert.equal(cfg.mail.transport,'log');
 const logged=[],orig=console.log;console.log=(...a)=>logged.push(a.join(' '));
 let r;try{r=await notifyOperator(cfg.db,cfg,{subject:'Job fehlgeschlagen: ratsmonitor-backup.service',message:'Zeile 1\nZeile 2 <b>',now:NOW});}finally{console.log=orig;}
 assert.equal(r.sent,true);assert.equal(r.transport,'log');
 assert.ok(logged.some(l=>/Transport log/.test(l)&&/Plenara Betrieb: Job fehlgeschlagen: ratsmonitor-backup\.service/.test(l)),logged.join('|'));
 const row=h.accounts.sql.prepare('SELECT status,"to",data,template,quota FROM mail_outbox ORDER BY id DESC LIMIT 1').get();
 assert.equal(row.status,'sent');assert.equal(row.to,null,'Adresse nach dem Versand gelöscht');assert.equal(row.data,null);
 assert.equal(row.template,'ops');assert.equal(row.quota,'operator');
 // Vorlage: Text roh, HTML maskiert
 const mail=render('ops',{subject:'A & B',message:'x <b>'},{site:'https://plenara.test'});
 assert.equal(mail.subject,'Plenara Betrieb: A & B');assert.equal(mail.text,'x <b>');
 assert.match(mail.html,/A &amp; B/);assert.match(mail.html,/x &lt;b&gt;/);
 // Ohne Adresse oder Kontendatei: Grund statt Fehler
 assert.equal((await notifyOperator(cfg.db,{...cfg,mail:{...cfg.mail,operator:undefined}},{subject:'x',message:'y'})).sent,false);
 assert.match((await notifyOperator(undefined,cfg,{subject:'x',message:'y'})).reason,/Kontendatei/);
 assert.equal(trimNotice({subject:' a\n\nb '+'x'.repeat(300),message:null}).subject.length,SUBJECT_MAX);
 assert.equal(trimNotice({subject:'',message:'m'}).subject,'Hinweis');
});
