// Social-Videos je Vorschlag (server/integrations/social-videos.mjs, scripts/social-video/tools.mjs): was gebaut, behalten und
// gelöscht wird, Freigabe nur für die gesehene Fassung, Dateiabruf mit Bereich, Werkzeugprüfung ohne Root.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {sheetKey,planVideos,videoFile,videoDir,saveVideo,listVideos,removeVideo,setRelease,videoInfo,readVideo} from '../server/integrations/social-videos.mjs';
import {ensureTools,systemCheck,APT,paths} from '../scripts/social-video/tools.mjs';
import {memoryDb} from './helpers/d1.mjs';

const row=(id,key,state='ready')=>({topic_id:id,sheet_key:key,state});

test('Prüfsumme: ändert sich mit dem Datenblatt, nicht mit den Tagen bis zur nächsten Sitzung',()=>{
 const a={titel:'X',naechste:{committee:'Rat',datum:'2026-11-12',tage:12}};
 assert.equal(sheetKey(a),sheetKey({...a,naechste:{...a.naechste,tage:11}}));
 assert.notEqual(sheetKey(a),sheetKey({...a,titel:'Y'}));
 assert.notEqual(sheetKey(a),sheetKey({...a,naechste:{...a.naechste,datum:'2026-11-13'}}));
});

test('Plan: neu und geändert bauen, passende behalten, verschwundene löschen, Gescheitertes erneut versuchen',()=>{
 const rows=[row('a','k1'),row('b','k1'),row('c','k1','failed'),row('d','k1','blocked'),row('gone','k9')];
 const p=planVideos([{id:'a',key:'k1'},{id:'b',key:'k2'},{id:'c',key:'k1'},{id:'d',key:'k1'},{id:'e',key:'k3'}],rows);
 assert.deepEqual(p.keep.sort(),['a','d'],'a passt; d bleibt unvollständig, solange das Datenblatt gleich ist');
 assert.deepEqual(p.build.sort(),['b','c','e']);
 assert.deepEqual(p.remove,['gone']);
});

test('Dateiname aus der ID ohne Sonderzeichen; Ordner aus RM_SOCIAL_VIDEOS oder neben der Datenbank',()=>{
 assert.match(videoFile('../../etc/passwd'),/^[0-9a-f]{20}\.mp4$/);
 assert.equal(videoFile('x'),videoFile('x'));
 assert.equal(videoDir({RM_SOCIAL_VIDEOS:'/a/b'}),'/a/b');
 assert.equal(videoDir({DATABASE_FILE:'/srv/r/data/db.sqlite'}),'/srv/r/data/social-videos');
 assert.equal(videoDir({}),null);
});

test('Freigabe: nur für ein fertiges Video und nur für die gesehene Fassung; neue Fassung nimmt sie zurück',async()=>{
 const {db}=memoryDb();
 const base={topic_id:'t1',region_id:'r',title:'T',sheet_key:'k1',state:'ready',file:'f.mp4',seconds:48,made_at:'2026-10-31T10:00:00Z'};
 assert.equal((await setRelease(db,'t1',{on:true,by:'u'})).ok,false,'ohne Video');
 await saveVideo(db,base);
 assert.equal((await setRelease(db,'t1',{on:true,by:'u1',key:'alt'})).ok,false,'andere Fassung');
 assert.equal((await setRelease(db,'t1',{on:true,by:'u1',key:'k1'})).ok,true);
 let r=(await listVideos(db))[0];assert.ok(r.released_at);assert.equal(r.released_by,'u1');
 await saveVideo(db,{...base,sheet_key:'k2'});
 r=(await listVideos(db))[0];assert.equal(r.released_at,null,'neu gebaut: Freigabe entfällt');
 await saveVideo(db,{...base,state:'blocked',file:null,note:'kein Zitat'});
 assert.equal((await setRelease(db,'t1',{on:true,by:'u1'})).ok,false,'unvollständig nie freigeben');
 assert.equal((await setRelease(db,'t1',{on:false})).ok,true);
 assert.deepEqual(Object.keys(await videoInfo(db)),['t1']);assert.equal((await videoInfo(db)).t1.file,undefined,'keine Dateinamen nach außen');
 await removeVideo(db,'t1');assert.equal((await listVideos(db)).length,0);
});

test('Videoabruf: nur fertige Videos aus der Tabelle, mit Bereichsanfrage',async()=>{
 const {db}=memoryDb(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'sv-'));
 try{
  fs.mkdirSync(path.join(dir,'videos'));fs.writeFileSync(path.join(dir,'videos','f.mp4'),Buffer.from('0123456789'));
  const env={RM_SOCIAL_VIDEOS:dir};
  await saveVideo(db,{topic_id:'t',region_id:'r',title:'T',sheet_key:'k',state:'ready',file:'f.mp4',made_at:'x'});
  assert.equal((await readVideo(db,'t',null,env)).body.length,10);
  const part=await readVideo(db,'t','bytes=2-4',env);
  assert.equal(part.status,206);assert.equal(String(part.body),'234');assert.equal(part.headers['Content-Range'],'bytes 2-4/10');
  assert.equal(String((await readVideo(db,'t','bytes=-3',env)).body),'789');
  assert.equal((await readVideo(db,'t','bytes=50-60',env)).status,416);
  assert.equal(await readVideo(db,'unbekannt',null,env),null);
  await saveVideo(db,{topic_id:'u',region_id:'r',title:'T',sheet_key:'k',state:'blocked',made_at:'x'});
  assert.equal(await readVideo(db,'u',null,env),null,'unvollständig: nichts auszuliefern');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('Werkzeuge: Systempakete werden nur gemeldet, nie installiert; ohne sie keine Einrichtung',async()=>{
 const run=(cmd,args)=>cmd==='ffmpeg'?{code:127,out:''}:{code:0,out:''};
 assert.deepEqual(systemCheck(run),['ffmpeg']);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'svt-'));
 try{
  const calls=[];
  const r=await ensureTools({dir,run:(c,a)=>{calls.push(c);return run(c,a);},download:async()=>{throw Error('darf nicht laden');}});
  assert.equal(r.ok,false);assert.deepEqual(r.missing,['ffmpeg']);assert.ok(r.hint.includes(APT));
  assert.ok(!fs.existsSync(path.join(dir,'venv')),'nichts eingerichtet');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
 const x=systemCheck((c,a)=>c==='ffmpeg'?{code:0,out:'--- encoders: libopenh264'}:{code:0,out:''});
 assert.deepEqual(x,['ffmpeg mit libx264']);
});

test('Werkzeuge: fehlende Pakete, Piper und Stimme richtet der Job selbst ein; ein zweiter Lauf lädt nichts',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'svt-')),p=paths(dir),loaded=[],ran=[];
 const run=(cmd,args,o)=>{
  ran.push(cmd+' '+args.join(' '));
  if(cmd==='ffmpeg')return {code:0,out:'libx264'};
  if(cmd==='python3'&&args[0]==='-m'){fs.mkdirSync(path.dirname(p.python),{recursive:true});fs.writeFileSync(p.python,'');return {code:0,out:''};}
  if(cmd===p.python&&args[0]==='-c')return {code:fs.existsSync(path.join(dir,'pkgs-ok'))?0:1,out:''};
  if(/pip$/.test(cmd)){fs.writeFileSync(path.join(dir,'pkgs-ok'),'');return {code:0,out:''};}
  if(cmd==='tar'&&args[0]==='-xzf'){ // Archive nachstellen
   const target=args[args.indexOf('-C')+1];
   if(/piper\.tgz/.test(args.join(' '))){fs.mkdirSync(path.join(target,'piper'),{recursive:true});fs.writeFileSync(path.join(target,'piper','piper'),'');}
   else fs.writeFileSync(path.join(target,'de-thorsten-low.onnx'),'');
   return {code:0,out:''};
  }
  if(cmd==='bash'){fs.writeFileSync(args[1].match(/--output_file '([^']+)'/)[1],'RIFF');return {code:0,out:''};}
  return {code:0,out:''};
 };
 const download=async(url,file)=>{loaded.push(url);fs.writeFileSync(file,'x');};
 try{
  const a=await ensureTools({dir,run,download});
  assert.equal(a.ok,true,a.hint);assert.equal(loaded.length,2);
  assert.ok(ran.some(c=>/-m venv/.test(c)));assert.ok(ran.some(c=>/pip install .*pillow numpy/.test(c)));
  assert.ok(a.env.PATH.startsWith(path.join(p.venv,'bin')),'Kindprozesse nutzen die eigene Python-Umgebung');assert.equal(a.env.SV_WORK,p.work);
  const b=await ensureTools({dir,run,download});
  assert.equal(b.ok,true);assert.equal(loaded.length,2,'nichts erneut geladen');
  const c=await ensureTools({dir:fs.mkdtempSync(path.join(os.tmpdir(),'svt-')),run,download,check:true});
  assert.equal(c.ok,false);assert.equal(c.todo.length,3,'--check richtet nichts ein, sagt nur, was fehlt');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
