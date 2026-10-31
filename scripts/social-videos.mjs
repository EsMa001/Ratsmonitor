/* Social-Videos zu den Vorschlägen des Admin-Reiters „Social Media“ bauen (Zeitplaner-Job „social-videos“, nachts nach „Einordnung“).
   Je Vorschlag (server/integrations/social-model.mjs, socialTopics) ein Video aus dem Datenblatt des Berichts
   (shared/social-video-sheet.mjs → scripts/social-video/auto.py, ohne KI). Verlässt ein Vorschlag den Reiter, verschwindet sein Video.
   Ändert sich das Datenblatt, wird das Video neu gebaut und die Freigabe entfällt; der Admin entscheidet nur über die Freigabe.
   Unvollständige Datenblätter (shared/social-video-sheet.mjs, `warnings`) werden nicht gebaut, sondern als „blocked“ vermerkt.
   Beim ersten Lauf richtet der Job fehlende Python-Pakete, Piper und die Stimme selbst ein (scripts/social-video/tools.mjs);
   Systempakete kann er ohne Root nicht installieren, dann steht in der Meldung der apt-Befehl.
   Aufruf: node scripts/social-videos.mjs [--check] [--dry-run] [--only <Vorgangs-ID[,ID…]>] [--limit N] [--minutes N] [--today JJJJ-MM-TT] [--also ID,ID]  (--also nur zum Ausprobieren: Berichte behandeln, als stünden sie im Reiter)
     --check     nur Werkzeuge prüfen, nichts bauen   --dry-run  nur sagen, was gebaut und gelöscht würde */
import {DatabaseSync} from 'node:sqlite';
import {spawn,spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {sqliteAdapter} from './sqlite-adapter.mjs';
import {videoSheet} from '../shared/social-video-sheet.mjs';
import {socialTopics} from '../server/integrations/social-model.mjs';
import {planVideos,sheetKey,videoFile,videoDir,listVideos,saveVideo,removeVideo} from '../server/integrations/social-videos.mjs';
import {ensureTools} from './social-video/tools.mjs';
const arg=(n,d=null)=>{const i=process.argv.indexOf(n);return i<0?d:(process.argv[i+1]??true);};
const flag=n=>process.argv.includes(n);
const log=s=>console.log(`[${new Date().toISOString().slice(11,19)}] ${s}`);
const dir=videoDir();
if(!dir){log('Weder RM_SOCIAL_VIDEOS noch DATABASE_FILE gesetzt, nichts zu tun.');process.exit(0);}
let tools=await ensureTools({dir,check:true,log});
if(flag('--check')){log(tools.ok?'Werkzeuge vollständig.':(tools.hint||'Es fehlt etwas: '+tools.todo.join(', ')));process.exit(tools.ok||!tools.missing.length?0:1);}
const here=new URL('.',import.meta.url).pathname;
const wdir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
const local=fs.existsSync(wdir)?fs.readdirSync(wdir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'):null;
const file=process.env.DATABASE_FILE||(local?wdir+local:null);
if(!file){log('Keine Datenbank gefunden, nichts zu tun.');process.exit(0);}
const sql=new DatabaseSync(file);sql.exec('PRAGMA busy_timeout=60000');
const db=sqliteAdapter(sql);
if(!sql.prepare("SELECT 1 FROM sqlite_master WHERE name='social_videos'").get()){log('Tabelle social_videos fehlt (Migration 0049), nichts zu tun.');process.exit(0);}
const {REGIONS}=await import('../shared/regions.ts');
const {POPULATION}=await import('../shared/catalog.mjs');
const bkg=JSON.parse(fs.readFileSync(new URL('../shared/de-regions.json',import.meta.url),'utf8'));
const extraNames=[...bkg.areas,...bkg.districts].map(a=>['de-'+a[0],a[2]]);
const today=arg('--today',new Date().toISOString().slice(0,10));
const data=await socialTopics(db,REGIONS,{today,extraNames,population:POPULATION,...(arg('--per-day')?{perDay:Number(arg('--per-day'))}:{}),...(arg('--min-fit')?{minFit:Number(arg('--min-fit'))}:{})});
const regionOf=id=>REGIONS.find(r=>r.id===id);
const topics=data.days.flatMap(d=>d.topics);
// Nur zum Ausprobieren: weitere Berichte so behandeln, als stünden sie im Reiter (--also ID,ID)
for(const id of String(arg('--also','')).split(',').filter(Boolean)){
 if(topics.some(t=>t.id===id))continue;
 const r=await db.prepare('SELECT region_id,json_extract(payload,\'$.title\') title FROM topics WHERE id=?').bind(id).first();
 if(r){const reg=regionOf(r.region_id);topics.push({id,regionId:r.region_id,region:reg?.shortName||reg?.name||r.region_id,title:r.title});}
}
const only=arg('--only');
const sheets=new Map();
for(const t of topics){
 const row=await db.prepare('SELECT payload FROM topics WHERE id=?').bind(t.id).first();
 if(!row)continue;
 const report=JSON.parse(row.payload);
 const r=regionOf(t.regionId);
 const sheet=videoSheet(report,{regionName:t.region,today,kommune:r?.name});
 sheets.set(t.id,{t,sheet,key:sheetKey(sheet)});
}
const existing=await listVideos(db);
const plan=planVideos([...sheets].map(([id,s])=>({id,key:s.key})),existing);
if(only){const ids=String(only).split(',');plan.build=plan.build.filter(x=>ids.includes(x));plan.remove=[];}
const limit=Number(arg('--limit',99)),stopAt=Date.now()+Number(arg('--minutes',150))*60000;
log(`${topics.length} Vorschläge: ${plan.build.length} zu bauen, ${plan.keep.length} bleiben, ${plan.remove.length} zu löschen.`);
if(flag('--dry-run')){for(const id of plan.build)log('bauen: '+id+' '+sheets.get(id).t.title);for(const id of plan.remove)log('löschen: '+id);process.exit(0);}
const videos=tools.paths.videos;fs.mkdirSync(videos,{recursive:true});
for(const id of plan.remove){
 const r=existing.find(x=>x.topic_id===id);
 if(r?.file)fs.rmSync(path.join(videos,r.file),{force:true});
 await removeVideo(db,id);log('gelöscht: '+id);
}
// Dateien ohne Zeile (abgebrochene Läufe) räumen
const known=new Set((await listVideos(db)).map(r=>r.file).filter(Boolean));
for(const f of fs.readdirSync(videos))if(f.endsWith('.mp4')&&!known.has(f)&&!plan.build.some(id=>videoFile(id)===f))fs.rmSync(path.join(videos,f),{force:true});
let made=0,failed=0,blocked=0;
const toBuild=plan.build.slice(0,limit);
// Fehlendes (Pakete, Piper, Stimme) wird erst eingerichtet, wenn wirklich etwas zu bauen ist
if(toBuild.some(id=>sheets.get(id).sheet.ok)&&!tools.ok&&!tools.missing.length)tools=await ensureTools({dir,log});
if(toBuild.some(id=>sheets.get(id).sheet.ok)&&!tools.ok){log('Werkzeuge nicht bereit: '+tools.hint);process.exit(1);}
const render=(sheetFile,out)=>new Promise(resolve=>{
 const child=spawn('python3',[path.join(here,'social-video','auto.py'),sheetFile,out],{env:{...tools.env,PYTHONDONTWRITEBYTECODE:'1'}});
 let tail='';const keep=b=>{tail=(tail+b).slice(-600);};
 child.stdout.on('data',keep);child.stderr.on('data',keep);
 const timer=setTimeout(()=>child.kill('SIGKILL'),25*60000);
 const stop=()=>child.kill('SIGTERM');process.once('SIGTERM',stop);
 child.on('close',code=>{clearTimeout(timer);process.off('SIGTERM',stop);resolve({code,tail});});
});
const seconds=f=>{const r=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',f],{encoding:'utf8'});const n=Number(String(r.stdout).trim());return Number.isFinite(n)?Math.round(n*10)/10:null;};
for(const id of toBuild){
 if(Date.now()>stopAt){log('Zeit aufgebraucht, der Rest folgt im nächsten Lauf.');break;}
 const {t,sheet,key}=sheets.get(id),base={topic_id:id,region_id:t.regionId,title:t.title,sheet_key:key,made_at:new Date().toISOString()};
 if(!sheet.ok){await saveVideo(db,{...base,state:'blocked',note:sheet.warnings.join('; ').slice(0,500)});blocked++;log(`nicht gebaut (${t.region}): ${sheet.warnings.join('; ')}`);continue;}
 const name=videoFile(id),sheetFile=path.join(tools.paths.work,`sheet_${name}.json`),out=path.join(tools.paths.work,`out_${name}`);
 fs.writeFileSync(sheetFile,JSON.stringify(sheet));
 log(`baue ${t.region}: ${t.title.slice(0,70)}`);
 const t0=Date.now(),r=await render(sheetFile,out);
 fs.rmSync(sheetFile,{force:true});
 if(r.code!==0||!fs.existsSync(out)){await saveVideo(db,{...base,state:'failed',note:('Bau gescheitert: '+r.tail).slice(0,500)});failed++;log('gescheitert: '+r.tail.slice(-200));continue;}
 fs.copyFileSync(out,path.join(videos,name));fs.rmSync(out,{force:true});fs.rmSync(out.replace(/\.mp4$/,'_Titelbild.png'),{force:true});
 await saveVideo(db,{...base,state:'ready',file:name,seconds:seconds(path.join(videos,name))});made++;
 log(`fertig in ${Math.round((Date.now()-t0)/1000)} s`);
}
log(`Ergebnis: ${made} gebaut, ${blocked} unvollständig, ${failed} gescheitert.`);
process.exit(failed&&!made?1:0);
