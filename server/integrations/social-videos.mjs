/**
 * Social-Videos je Themenvorschlag (Tabelle social_videos, drizzle/0049; Job „social-videos“, scripts/social-videos.mjs).
 * Ein Video je Vorschlag des Social-Reiters, gebaut ohne KI aus dem Datenblatt (shared/social-video-sheet.mjs). Dieses Modul
 * enthält nur, was auch ohne Video-Werkzeuge testbar ist: Prüfsumme des Datenblatts, die Entscheidung bauen/behalten/löschen,
 * Dateinamen und Freigabe. Der Admin entscheidet nur über die Freigabe; sie gilt für genau die Fassung, die er gesehen hat.
 */
import {createHash} from 'node:crypto';
import path from 'node:path';
export const VIDEO_STATES=Object.freeze(['ready','failed','blocked']);
/** Prüfsumme der Teile des Datenblatts, die das Video bestimmen (nicht: Tage bis zur nächsten Sitzung, sie laufen täglich weiter) */
export function sheetKey(sheet){
 const s={...sheet};
 if(s.naechste)s.naechste={committee:s.naechste.committee,datum:s.naechste.datum};
 return createHash('sha256').update(JSON.stringify(s)).digest('hex').slice(0,24);
}
/** Dateiname im Ordner der Videos: aus der Vorgangs-ID, ohne Sonderzeichen */
export const videoFile=topicId=>createHash('sha256').update(String(topicId)).digest('hex').slice(0,20)+'.mp4';
export const videoDir=(env=process.env)=>env.RM_SOCIAL_VIDEOS||(env.DATABASE_FILE?path.join(path.dirname(env.DATABASE_FILE),'social-videos'):null);
/**
 * Was zu tun ist. proposals: [{id,key}] (Vorschläge des Reiters mit Prüfsumme ihres Datenblatts), rows: Zeilen aus social_videos.
 * build: neu oder Datenblatt geändert oder früherer Versuch gescheitert (ein gescheiterter Versuch wird je Lauf einmal wiederholt);
 * keep: Video passt noch; remove: Vorschlag ist nicht mehr im Reiter.
 */
export function planVideos(proposals,rows){
 const have=new Map(rows.map(r=>[r.topic_id,r]));
 const ids=new Set(proposals.map(p=>p.id));
 const build=[],keep=[];
 for(const p of proposals){
  const r=have.get(p.id);
  if(r&&r.sheet_key===p.key&&r.state==='ready')keep.push(p.id);
  else if(r&&r.sheet_key===p.key&&r.state==='blocked')keep.push(p.id); // Datenblatt unverändert unvollständig: nichts zu bauen
  else build.push(p.id);
 }
 return {build,keep,remove:rows.filter(r=>!ids.has(r.topic_id)).map(r=>r.topic_id)};
}
export async function listVideos(db){
 const {results}=await db.prepare('SELECT topic_id,region_id,title,sheet_key,state,file,seconds,note,made_at,released_at,released_by FROM social_videos').all();
 return results||[];
}
export async function saveVideo(db,v){
 await db.prepare(`INSERT INTO social_videos(topic_id,region_id,title,sheet_key,state,file,seconds,note,made_at,released_at,released_by) VALUES(?,?,?,?,?,?,?,?,?,NULL,NULL)
  ON CONFLICT(topic_id) DO UPDATE SET region_id=excluded.region_id,title=excluded.title,sheet_key=excluded.sheet_key,state=excluded.state,file=excluded.file,
  seconds=excluded.seconds,note=excluded.note,made_at=excluded.made_at,released_at=NULL,released_by=NULL`)
  .bind(v.topic_id,v.region_id,v.title,v.sheet_key,v.state,v.file??null,v.seconds??null,v.note??null,v.made_at).run();
}
export async function removeVideo(db,topicId){await db.prepare('DELETE FROM social_videos WHERE topic_id=?').bind(topicId).run();}
/** Freigabe setzen oder zurücknehmen. Nur ein fertiges Video lässt sich freigeben, und nur die Fassung mit dieser Prüfsumme. */
export async function setRelease(db,topicId,{on,by,key}){
 const row=await db.prepare('SELECT state,sheet_key FROM social_videos WHERE topic_id=?').bind(topicId).first();
 if(!row)return {ok:false,error:'Zu diesem Vorschlag gibt es kein Video.'};
 if(on){
  if(row.state!=='ready')return {ok:false,error:'Nur ein fertiges Video lässt sich freigeben.'};
  if(key&&key!==row.sheet_key)return {ok:false,error:'Das Video wurde inzwischen neu gebaut. Bitte die neue Fassung ansehen.'};
 }
 await db.prepare('UPDATE social_videos SET released_at=?,released_by=? WHERE topic_id=?').bind(on?new Date().toISOString():null,on?String(by||''):null,topicId).run();
 return {ok:true};
}
/** Angaben für den Reiter, nach Vorgangs-ID: ohne Dateinamen und Pfade */
export async function videoInfo(db){
 const out={};
 for(const r of await listVideos(db))out[r.topic_id]={state:r.state,seconds:r.seconds,note:r.note,madeAt:r.made_at,releasedAt:r.released_at,key:r.sheet_key};
 return out;
}
/** Videodatei für den Abruf im Reiter, mit Bereichsanfrage (Range), damit der Player springen kann. Nur Dateien, die in der Tabelle stehen. */
export async function readVideo(db,topicId,range,env=process.env){
 const row=await db.prepare("SELECT file FROM social_videos WHERE topic_id=? AND state='ready'").bind(topicId).first();
 const dir=videoDir(env);
 if(!row?.file||!dir)return null;
 const fs=await import(/* @vite-ignore */ 'node:fs/promises');
 let buf;try{buf=await fs.readFile(path.join(dir,'videos',row.file));}catch{return null;}
 const m=/^bytes=(\d*)-(\d*)$/.exec(range||'');
 if(!m||(m[1]===''&&m[2]===''))return {status:200,body:buf,headers:{'Content-Length':String(buf.length),'Accept-Ranges':'bytes'}};
 let a=m[1]===''?Math.max(0,buf.length-Number(m[2])):Number(m[1]),b=m[1]===''||m[2]===''?buf.length-1:Math.min(Number(m[2]),buf.length-1);
 if(a>b||a>=buf.length)return {status:416,body:Buffer.alloc(0),headers:{'Content-Range':`bytes */${buf.length}`}};
 return {status:206,body:buf.subarray(a,b+1),headers:{'Content-Range':`bytes ${a}-${b}/${buf.length}`,'Content-Length':String(b-a+1),'Accept-Ranges':'bytes'}};
}
