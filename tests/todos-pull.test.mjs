import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const script=fileURLToPath(new URL('../scripts/pull-todos.mjs',import.meta.url));
const local=()=>({version:1,kategorien:[{id:'a',name:'A',items:[{id:'x',text:'Original',erledigt:false,faellig:null,erledigtAm:null}]}]});

async function fixture(changes){
 const directory=await mkdtemp(join(tmpdir(),'todos-pull-'));
 const file=join(directory,'docs','todo','todos.json');
 await mkdir(join(directory,'docs','todo'),{recursive:true});
 await writeFile(file,JSON.stringify(local())+'\n');
 await writeFile(join(directory,'server-response.json'),JSON.stringify({changes}));
 const preload='data:text/javascript,'+encodeURIComponent("import {readFile} from 'node:fs/promises';globalThis.fetch=async()=>new Response(await readFile('server-response.json','utf8'),{headers:{'content-type':'application/json'}});");
 const run=(...args)=>new Promise((resolve,reject)=>{
  const process=spawn(globalThis.process.execPath,['--import',preload,script,...args],{cwd:directory});
  let output='';process.stdout.on('data',chunk=>output+=chunk);process.stderr.on('data',chunk=>output+=chunk);
  process.on('error',reject);process.on('close',code=>resolve({code,output}));
 });
 return {file,run};
}

test('pull preserves planned intervals and checklist states without repeated changes',async()=>{
 const unteraufgaben=[{id:'sub',text:'Erster Schritt',erledigt:true}];
 const {file,run}=await fixture({format:2,changes:{x:{fields:{startDatum:'2026-10-15',faellig:'2026-10-20',unteraufgaben}}},creates:[]});
 const result=await run();
 assert.equal(result.code,0,result.output);
 const pulled=JSON.parse(await readFile(file,'utf8')).kategorien[0].items[0];
 assert.equal(pulled.startDatum,'2026-10-15');
 assert.equal(pulled.faellig,'2026-10-20');
 assert.deepEqual(pulled.unteraufgaben,unteraufgaben);
 assert.match((await run()).output,/0 uebernommen, 0 ausgelassen/);
});

test('pull imports assigned board tasks, content edits and newly created tasks',async()=>{
 const changes={format:2,changes:{x:{fields:{text:'Bearbeitet',status:'doing',bearbeiter:'max',wartetAuf:'Freigabe',reihenfolge:20}}},creates:[{kategorieId:'a',item:{id:'new',text:'Neu',status:'ready',bearbeiter:'nico',erledigt:false,faellig:'2026-11-01',erledigtAm:null}}]};
 const {file,run}=await fixture(changes);
 const result=await run();
 assert.equal(result.code,0,result.output);
 assert.match(result.output,/2 uebernommen, 0 ausgelassen/);
 const pulled=JSON.parse(await readFile(file,'utf8'));
 assert.deepEqual(pulled.kategorien[0].items.map(item=>item.id),['x','new']);
 assert.equal(pulled.kategorien[0].items[0].text,'Bearbeitet');
 assert.equal(pulled.kategorien[0].items[0].bearbeiter,'max');
 assert.equal(pulled.kategorien[0].items[1].bearbeiter,'nico');
 assert.equal(pulled.kategorien[0].items[0].prio,2);
 assert.equal(pulled.kategorien[0].items[1].prio,2);
 const repeated=await run();
 assert.match(repeated.output,/0 uebernommen, 0 ausgelassen/,'pulling twice does not duplicate or rewrite identical tasks');
});

test('pull preserves priority, closure reasons and completion dates across repeated imports',async()=>{
 const changes={format:2,changes:{x:{fields:{status:'done',erledigt:true,abschluss:'wont_do',erledigtAm:'2026-10-12',prio:3}}},creates:[{kategorieId:'a',item:{id:'duplicate',text:'Duplikat',status:'done',erledigt:true,abschluss:'duplicate',erledigtAm:'2026-10-11',prio:1,faellig:null}}]};
 const {file,run}=await fixture(changes),result=await run();
 assert.equal(result.code,0,result.output);
 assert.match(result.output,/Prioritaet niedrig, wird nicht umgesetzt/);
 const pulled=JSON.parse(await readFile(file,'utf8')).kategorien[0].items;
 assert.equal(pulled[0].abschluss,'wont_do');
 assert.equal(pulled[0].erledigtAm,'2026-10-12');
 assert.equal(pulled[0].prio,3);
 assert.equal(pulled[1].abschluss,'duplicate');
 assert.equal(pulled[1].prio,1);
 assert.equal(pulled[1].erledigtAm,'2026-10-11');
 const repeated=await run();
 assert.equal(repeated.code,0,repeated.output);
 assert.match(repeated.output,/0 uebernommen, 0 ausgelassen/);
});

test('pull probe reports legacy server changes while leaving the local file unchanged',async()=>{
 const {file,run}=await fixture({x:{erledigt:true,faellig:'2026-11-01',erledigtAm:'2026-10-12',base:{erledigt:false,faellig:null}}});
 const before=await readFile(file,'utf8');
 const result=await run('--probe');
 assert.equal(result.code,0,result.output);
 assert.match(result.output,/1 uebernommen, 0 ausgelassen \(nur angezeigt\)/);
 assert.equal(await readFile(file,'utf8'),before);
});
