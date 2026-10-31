/**
 * Werkzeuge für die Social-Videos prüfen und, soweit ohne Root möglich, selbst einrichten (Job „social-videos“, scripts/social-videos.mjs).
 * Ordner `dir` (RM_SOCIAL_VIDEOS): venv/ (Python mit Pillow und numpy), work/tts/bin/piper (Piper-Linux-Release),
 * work/tts/voice (Stimme de-thorsten-low), work/ ist SV_WORK der Skripte in scripts/social-video/.
 *
 * Systempakete (python3 mit venv, ffmpeg mit libx264, tar) kann der Job nicht installieren: er läuft ohne Root. Fehlen sie, steht
 * in `missing` genau, was zu tun ist (ein apt-Befehl). Python-Pakete, Piper und die Stimme holt er sich beim ersten Lauf selbst
 * (pip aus PyPI, Piper und Stimme von GitHub) und prüft sie bei jedem Lauf nur kurz. Eine Prüfliste ohne Netz: `node scripts/social-videos.mjs --check`.
 * Lizenzen von Piper und der Stimme vor einer Veröffentlichung der Videos prüfen (scripts/social-video/README.md).
 */
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
export const PIPER_URL='https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz';
export const VOICE_URL='https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-de-thorsten-low.tar.gz';
export const APT='sudo apt install python3 python3-venv ffmpeg tar';
const defaultRun=(cmd,args,o={})=>{const r=spawnSync(cmd,args,{encoding:'utf8',...o});return {code:r.status??(r.error?127:1),out:(r.stdout||'')+(r.stderr||'')};};
export const paths=dir=>({venv:path.join(dir,'venv'),python:path.join(dir,'venv','bin','python'),work:path.join(dir,'work'),
 piper:path.join(dir,'work','tts','bin','piper','piper'),voice:path.join(dir,'work','tts','voice','de-thorsten-low.onnx'),videos:path.join(dir,'videos')});
/** Systempakete: nur prüfen. Gibt die fehlenden zurück. */
export function systemCheck(run=defaultRun){
 const missing=[];
 if(run('python3',['--version']).code!==0)missing.push('python3');
 else if(run('python3',['-c','import venv,ensurepip']).code!==0)missing.push('python3-venv');
 const ff=run('ffmpeg',['-hide_banner','-encoders']);
 if(ff.code!==0)missing.push('ffmpeg');else if(!/libx264/.test(ff.out))missing.push('ffmpeg mit libx264');
 if(run('tar',['--version']).code!==0)missing.push('tar');
 return missing;
}
/**
 * @param {{dir:string,run?:Function,download?:(url:string,file:string)=>Promise<void>,log?:(s:string)=>void,check?:boolean}} o
 * check: nichts einrichten, nur berichten. Ergebnis {ok, missing:[…], todo:[…], env}; env ist für die Kindprozesse (PATH mit venv, SV_WORK).
 */
export async function ensureTools({dir,run=defaultRun,download=fetchTo,log=()=>{},check=false}){
 const p=paths(dir),missing=systemCheck(run),todo=[];
 const env={...process.env,SV_WORK:p.work,PATH:path.join(p.venv,'bin')+path.delimiter+(process.env.PATH||'')};
 if(missing.length)return {ok:false,missing,todo,hint:`Auf dem Server fehlt: ${missing.join(', ')}. Einmal als Administrator: ${APT}`,env,paths:p};
 const hasPy=fs.existsSync(p.python)&&run(p.python,['-c','import PIL,numpy']).code===0;
 if(!hasPy)todo.push('Python-Pakete (Pillow, numpy)');
 if(!fs.existsSync(p.piper))todo.push('Piper');
 if(!fs.existsSync(p.voice))todo.push('Stimme de-thorsten-low');
 if(check||!todo.length)return {ok:!todo.length,missing,todo,env,paths:p,hint:todo.length?'Wird beim ersten Lauf eingerichtet.':''};
 try{
  fs.mkdirSync(p.work,{recursive:true});fs.mkdirSync(p.videos,{recursive:true});
  if(!hasPy){
   if(!fs.existsSync(p.python)){log('Python-Umgebung anlegen');const r=run('python3',['-m','venv',p.venv]);if(r.code)throw Error('venv: '+r.out.slice(-300));}
   log('Pillow und numpy installieren');
   const r=run(path.join(p.venv,'bin','pip'),['install','--disable-pip-version-check','--quiet','pillow','numpy']);
   if(r.code)throw Error('pip: '+r.out.slice(-300));
  }
  if(!fs.existsSync(p.piper)){
   log('Piper laden');const tmp=path.join(dir,'piper.tgz');await download(PIPER_URL,tmp);
   fs.mkdirSync(path.join(p.work,'tts','bin'),{recursive:true});
   const r=run('tar',['-xzf',tmp,'-C',path.join(p.work,'tts','bin')]);fs.rmSync(tmp,{force:true});if(r.code)throw Error('Piper entpacken: '+r.out.slice(-300));
  }
  if(!fs.existsSync(p.voice)){
   log('Stimme laden');const tmp=path.join(dir,'voice.tgz');await download(VOICE_URL,tmp);
   fs.mkdirSync(path.dirname(p.voice),{recursive:true});
   const r=run('tar',['-xzf',tmp,'-C',path.dirname(p.voice)]);fs.rmSync(tmp,{force:true});if(r.code)throw Error('Stimme entpacken: '+r.out.slice(-300));
  }
  fs.chmodSync(p.piper,0o755);
 }catch(e){return {ok:false,missing,todo,hint:'Einrichtung gescheitert: '+(e instanceof Error?e.message:e)+' (Netzzugang zu pypi.org und github.com nötig)',env,paths:p};}
 // Probelauf: spricht Piper wirklich?
 const t=path.join(dir,'probe.wav');
 const r=run('bash',['-c',`echo "Test" | LD_LIBRARY_PATH='${path.dirname(p.piper)}' '${p.piper}' --model '${p.voice}' --output_file '${t}'`]);
 const worked=r.code===0&&fs.existsSync(t);fs.rmSync(t,{force:true});
 if(!worked)return {ok:false,missing,todo,hint:'Piper lässt sich nicht starten: '+r.out.slice(-300),env,paths:p};
 return {ok:true,missing,todo:[],env,paths:p,hint:''};
}
/** Laden: curl, wenn vorhanden (kennt Proxy-Einstellungen des Servers), sonst fetch */
async function fetchTo(url,file){
 const c=spawnSync('curl',['-fsSL','--retry','2','--max-time','900','-o',file,url],{encoding:'utf8'});
 if(c.status===0)return;
 if(c.error?.code!=='ENOENT')throw Error(`${url}: curl ${c.status} ${(c.stderr||'').trim().slice(-150)}`);
 await fetchViaNode(url,file);
}
async function fetchViaNode(url,file){
 const r=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(10*60000)});
 if(!r.ok||!r.body)throw Error(`${url}: HTTP ${r.status}`);
 const {Readable}=await import('node:stream'),{pipeline}=await import('node:stream/promises');
 await pipeline(Readable.fromWeb(r.body),fs.createWriteStream(file));
}
