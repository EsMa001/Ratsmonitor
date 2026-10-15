// Nachtbericht des Betriebsplans: alles, was ein Lauf der Tagespipeline, der Nacharbeit, der OCR tagsüber und des Altbestands
// hinterlässt, auf einen Blick (nur lesend). Für die Fehlersuche am Morgen nach einer Nacht.
//
//   node scripts/pipeline-report.mjs [--hours 24] [--db <sqlite>] [--no-journal]
// Auf dem Server (als root, liest Datenbank und Journal; braucht nur Node, kein Deploy):
//   ssh ratsmonitor 'node --input-type=module - --hours 30' < scripts/pipeline-report.mjs
//
// Quellen: system_state (schedules, schedule-log, rule-texts-last, nacharbeit-last, pdf-store-runs, pdf-daily-last, ai-counts,
// pipeline-trace, admin-pipeline-job), work_failures und source_hosts (Migration 0040), import_runs, journalctl je Einheit.
import {DatabaseSync} from 'node:sqlite';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';

const args=process.argv.slice(2).filter(a=>a!=='-');
const opt=(name,def)=>{const i=args.indexOf('--'+name);return i>=0?args[i+1]:def;};
const hours=Number(opt('hours',24));
const since=new Date(Date.now()-hours*3600000).toISOString();
const envDb=()=>{try{return fs.readFileSync('/srv/ratsmonitor/ratsmonitor.env','utf8').match(/^DATABASE_FILE="?([^"\n]+)"?/m)?.[1];}catch{return null;}};
const file=opt('db',process.env.DATABASE_FILE||envDb()||'/srv/ratsmonitor/data/ratsmonitor.sqlite');
const db=new DatabaseSync(file,{readOnly:true});db.exec('PRAGMA busy_timeout=20000');
const has=t=>!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t);
const state=key=>{const r=db.prepare('SELECT value FROM system_state WHERE key=?').get(key);try{return r?JSON.parse(r.value):null;}catch{return null;}};
const local=iso=>iso?new Date(iso).toLocaleString('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'-';
const min=s=>s==null?'-':s<90?`${Math.round(s)} s`:`${(s/60).toFixed(1)} min`;
const head=t=>console.log(`\n== ${t}`);
const short=(v,n=300)=>{const s=typeof v==='string'?v:JSON.stringify(v);return s&&s.length>n?s.slice(0,n)+' …':s;};

console.log(`Nachtbericht seit ${local(since)} (${hours} h), Datenbank ${file}`);
try{console.log('Stand:',fs.readlinkSync('/srv/ratsmonitor/app/current').split('/').pop());}catch{/* lokal */}

head('Schalter im Zeitplaner (aus = läuft nicht nach Plan)');
const sched=state('schedules')||{};
const off=Object.entries(sched).filter(([,s])=>s?.enabled===false).map(([id])=>id);
console.log(off.length?`aus: ${off.join(', ')}`:'alle Jobs an');

head('Laufbuch (schedule-log): Läufe je Job');
const log=(state('schedule-log')||[]).filter(e=>e.start>=since);
const byJob={};for(const e of log)(byJob[e.job]||=[]).push(e);
for(const [job,list] of Object.entries(byJob)){
 const bad=list.filter(e=>e.result!=='ok'||e.exit);
 const longest=Math.max(...list.map(e=>e.seconds||0));
 console.log(`${job.padEnd(18)} ${String(list.length).padStart(3)} Läufe, ${bad.length} nicht ok, erster ${local(list.at(-1).start)}, letzter ${local(list[0].start)}, längster ${min(longest)}`);
 for(const e of bad.slice(0,5))console.log(`   ! ${local(e.start)} ${e.result} exit ${e.exit} ${min(e.seconds)} ${e.trigger||''}`);
}
if(!log.length)console.log('keine Läufe im Zeitraum');

head('Abruf (import_runs, Auftrag)');
if(has('import_runs')){
 const runs=db.prepare('SELECT status,count(*) n FROM import_runs WHERE started_at>=? GROUP BY status').all(since);
 console.log(runs.length?runs.map(r=>`${r.status} ${r.n}`).join(', '):'keine Importläufe');
}
const job=state('admin-pipeline-job');
if(job){const c={};for(const it of job.items||[])c[it.status]=(c[it.status]||0)+1;
 console.log(`Auftrag ${String(job.id).slice(0,8)} (${job.status}, Fenster ${job.window}, angelegt ${local(job.createdAt)}): ${Object.entries(c).map(([k,v])=>`${k} ${v}`).join(', ')}`);}

head('Extraktion und PDF-Aufträge (pdf-store-runs)');
for(const r of (state('pdf-store-runs')||[]).filter(r=>(r.startedAt||'')>=since).slice(0,8)){
 console.log(`${local(r.startedAt)} ${r.kind} → ${r.result} (${local(r.finishedAt)})${r.failed?.length?` fehlgeschlagen: ${r.failed.join(', ')}`:''}`);
 for(const s of r.steps||[])console.log(`   ${s.ok?' ':'!'} ${String(s.name).padEnd(22)} ${min(s.seconds).padStart(9)}  ${short(s.summary,220)??''}`);
}
console.log('pdf-daily-last:',short(state('pdf-daily-last'),200));

head('Verarbeitung (rule-texts-last)');
const rt=state('rule-texts-last');
if(rt){console.log(`${local(rt.startedAt)} bis ${local(rt.finishedAt)}: ${rt.result}${rt.all?' (alle neu)':''}`);
 for(const s of rt.steps||[])console.log(`   ${s.ok?' ':'!'} ${String(s.name).padEnd(22)} ${min(s.seconds).padStart(9)}  ${short(s.summary,220)??''}`);}
console.log('ai-counts:',short(state('ai-counts'),300));
console.log('pipeline-trace:',short(state('pipeline-trace'),600));

head('Nacharbeit (nacharbeit-last)');
console.log(short(state('nacharbeit-last'),700));

if(has('work_failures')){
 head('Fehlerspeicher: im Zeitraum vermerkt (letzter Fehlschlag)');
 for(const r of db.prepare(`SELECT step,class,origin,count(*) n,sum(first_at>=?) neu,sum(next_try_at IS NULL) endg FROM work_failures WHERE last_at>=? GROUP BY 1,2,3 ORDER BY n DESC LIMIT 25`).all(since,since))
  console.log(`${r.step.padEnd(10)} ${r.class.padEnd(10)} ${r.origin.padEnd(8)} ${String(r.n).padStart(6)} (neu ${r.neu}, ohne Termin ${r.endg})`);
 head('Fehlerspeicher: jetzt fällig im Tagesbereich');
 const now=new Date().toISOString();
 for(const r of db.prepare(`SELECT step,class,count(*) n FROM work_failures WHERE origin='daily' AND next_try_at IS NOT NULL AND next_try_at<=? GROUP BY 1,2 ORDER BY n DESC`).all(now))
  console.log(`${r.step.padEnd(10)} ${r.class.padEnd(10)} ${r.n}`);
 head('Fehlerspeicher: häufigste Gründe im Zeitraum');
 for(const r of db.prepare(`SELECT step,coalesce(reason,'') reason,count(*) n FROM work_failures WHERE last_at>=? GROUP BY 1,2 ORDER BY n DESC LIMIT 12`).all(since))
  console.log(`${String(r.n).padStart(6)} ${r.step.padEnd(10)} ${short(r.reason,140)}`);
 head('Server (source_hosts): Stand und Änderungen im Zeitraum');
 console.log(db.prepare('SELECT state,count(*) n FROM source_hosts GROUP BY 1').all().map(r=>`${r.state} ${r.n}`).join(', '));
 for(const r of db.prepare(`SELECT host,state,level,fails,next_try_at,reason FROM source_hosts WHERE updated_at>=? ORDER BY updated_at DESC LIMIT 15`).all(since))
  console.log(`   ${r.host.padEnd(36)} ${r.state.padEnd(9)} Stufe ${r.level}, ${r.fails} Fehler, wieder ${local(r.next_try_at)} ${short(r.reason,60)??''}`);
}
db.close();

if(!args.includes('--no-journal')){
 const units=['ratsmonitor-backup','ratsmonitor-import-nightly','ratsmonitor-startseite-trends','ratsmonitor-pdf-nightly','ratsmonitor-rule-texts','ratsmonitor-nacharbeit','ratsmonitor-ocr','ratsmonitor-altbestand','ratsmonitor-import','ratsmonitor-pdf-job','ratsmonitor'];
 const run=(cmd,a)=>{try{return execFileSync(cmd,a,{encoding:'utf8',maxBuffer:64<<20});}catch(e){return e.stdout||'';}};
 head('Journal je Einheit (Warnungen, Abbrüche, letzte Zeilen)');
 for(const u of units){
  const text=run('journalctl',['-u',u,'--since',since.replace('T',' ').slice(0,19)+' UTC','-o','cat','--no-pager']);
  if(!text.trim())continue;
  const lines=text.trim().split('\n');
  // auffällig: Abbrüche, Ausnahmen, Exit-Status, „N Fehler“ mit N > 0 (nicht „0 Fehler“ und nicht der Name „Fehlerspeicher“)
  const bad=lines.filter(l=>!/^(Starting|Finished) /.test(l)&&(/\b(error|abbruch|abgebrochen|warn\w*|failed|killed|timeout|exception|SIGTERM|SIGKILL)\b|status=\d|Zeitgrenze erreicht/i.test(l)||/(^|[^\d])[1-9]\d* (Fehler|failed)\b/.test(l)));
  const res=run('systemctl',['show',u,'-p','Result,ExecMainStatus','--value']).trim().split('\n').join('/');
  console.log(`-- ${u}: ${lines.length} Zeilen, ${bad.length} auffällig, zuletzt ${res}`);
  for(const l of bad.slice(-8))console.log('   ! '+short(l,220));
  for(const l of lines.slice(-3))console.log('     '+short(l,220));
 }
}
