// Run the real OCR entry point with only its I/O dependencies replaced.
import {mock} from 'node:test';
import {EventEmitter} from 'node:events';
import {fileURLToPath} from 'node:url';

const options=JSON.parse(process.argv[2]);
// keine Hauptdatenbank: der Fehlerspeicher bleibt aus (failures.mjs öffnet nur vorhandene Dateien)
process.env.DATABASE_FILE='/virtual/no-database.sqlite';
const script=new URL('../../scripts/pdf-store/text.mjs',import.meta.url);
const memoryFiles=new Map(),children=[],read=[],logs=[];
const queue=[{sha:'first',main:true},{sha:'second',main:false},{sha:'third',main:false}];
let summary,closed=0,schedulers=0,terminated=0,rss=options.rssBeforeFile??500;
const store={dir:'/virtual/ocr-fixture',ocrQueue:()=>queue.map(row=>({...row})),close:()=>{closed++;}};
const notFound=()=>Object.assign(Error('fixture file missing'),{code:'ENOENT'});
const fs={
 writeFileSync(file,value,{flag}={}){
  if(flag==='wx'&&memoryFiles.has(file))throw Object.assign(Error('fixture file exists'),{code:'EEXIST'});
  memoryFiles.set(file,String(value));
 },
 readFileSync(file){if(!memoryFiles.has(file))throw notFound();return memoryFiles.get(file);},
 unlinkSync(file){if(!memoryFiles.delete(file))throw notFound();},
};
const childSummaries=[
 {files:2,primary:1,pages:4,failed:0,changed:0,fetched:1,skipped:0,dropped:1,slow:0,open:1},
 {files:1,primary:0,pages:2,failed:0,changed:0,fetched:0,skipped:0,dropped:0,slow:0,open:0},
 {files:0,primary:0,pages:0,failed:0,changed:0,fetched:0,skipped:0,dropped:0,slow:0,open:0},
];
function spawn(command,args,config){
 const index=children.length;
 if(index>=childSummaries.length)throw Error('driver restarted after an empty batch');
 children.push({command,args,noProgress:config.env.RM_NO_PROGRESS});
 const child=new EventEmitter();
 queueMicrotask(()=>{
  const next=childSummaries[index];
  queue.splice(0,next.files);
  memoryFiles.set(config.env.RM_STEP_SUMMARY,JSON.stringify(next));
  child.emit('exit',0,null);
 });
 return child;
}

mock.module('node:fs',{defaultExport:fs});
mock.module('node:child_process',{namedExports:{spawn}});
// ohne Hauptdatenbank: kein Fehlerspeicher
mock.module(new URL('../../scripts/pdf-store/failures.mjs',import.meta.url),{namedExports:{openFailures:async()=>null,seedFromStore:async()=>null,originOf:()=>'daily'}});
mock.module(new URL('../../server/node/pdf-store.mjs',import.meta.url),{
 namedExports:{openPdfStore:()=>store,DEFAULT_PDF_STORE:store.dir},
});
mock.module(new URL('../../scripts/pdf-store/store-lib.mjs',import.meta.url),{namedExports:{
 TEXT_VERSION:1,
 readTextLayer:()=>{throw Error('unexpected text extraction');},
 ocrScheduler:async workers=>{schedulers++;return {workers,terminate:async()=>{terminated++;}};},
 ocrFile:async(_store,sha)=>{
  read.push(sha);
  const index=queue.findIndex(row=>row.sha===sha);
  if(index<0)throw Error('file processed twice');
  queue.splice(index,1);
  rss=options.rssAfterFile??3000;
  return 2;
 },
 ocrWithRefetch:async(_store,sha,{read})=>({pages:await read(sha),fetched:false,result:'ok'}),
 downloader:()=>async()=>{throw Error('unexpected network access');},
 dropIfTooBig:()=>false,
 ocrRange:()=>true,
}});
mock.module(new URL('../../scripts/pdf-store/state.mjs',import.meta.url),{namedExports:{
 progress:()=>{},onStop:()=>{},stepSummary:value=>{summary=value;},lane:value=>value,
}});

// Nothing from the surrounding server/test environment may select a real store or progress channel.
process.env.RM_PDF_STORE=store.dir;
delete process.env.RM_PROGRESS_BASE;
delete process.env.RM_NO_PROGRESS;
process.argv=[process.execPath,fileURLToPath(script),'--ocr',
 ...(options.mode==='child'?['--child','--workers','1']:[]),...(options.args||[])];
const realExit=process.exit,realRss=process.memoryUsage.rss,realNow=Date.now;
const originalLog=console.log,originalError=console.error;
const finished=Symbol('script exit');
process.exit=code=>{if(code!==0)throw Error('unexpected script exit: '+code);throw finished;};
process.memoryUsage.rss=()=>rss*1048576;
Date.now=()=>1791892800000;
console.log=(...values)=>logs.push(values.join(' '));
console.error=(...values)=>logs.push(values.join(' '));
const exitListeners=new Set(process.listeners('exit'));
try{
 try{await import(script.href);}catch(error){if(error!==finished)throw error;}
 // The driver releases its lock in its exit hook; exercise that hook without exiting this fixture.
 for(const listener of process.listeners('exit'))if(!exitListeners.has(listener)){
  process.off('exit',listener);listener();
 }
}finally{
 process.exit=realExit;process.memoryUsage.rss=realRss;Date.now=realNow;
 console.log=originalLog;console.error=originalError;
}
console.log(JSON.stringify({children,read,logs,summary,closed,schedulers,terminated,
 remaining:queue.map(row=>row.sha),lockReleased:![...memoryFiles.keys()].some(file=>file.endsWith('ocr.lock'))}));
