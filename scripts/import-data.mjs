import {mergeImport} from '../server/integrations/merge-import.mjs';
import {collectOparl,checkedUrl,hash,parallel,qualityCheck} from '../server/integrations/oparl.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
await mkdir('.oparl-cache',{recursive:true});
async function getJson(url){const path='.oparl-cache/'+await hash(url)+'.json';try{return JSON.parse(await readFile(path,'utf8'))}catch{}const r=await fetch(checkedUrl(url),{signal:AbortSignal.timeout(90000),redirect:'error'});if(!r.ok)throw Error('OParl HTTP '+r.status);const j=await r.json();await writeFile(path,JSON.stringify(j));return j}
let previous={topics:[],coverage:{}};try{previous=JSON.parse(await readFile('data/topics.json','utf8'));}catch{}
const data=mergeImport(previous,await collectOparl({now:new Date(),getJson,onProgress:console.log}));
await writeFile('data/topics.json',JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({topics:data.topics.length,coverage:data.coverage,statuses:data.topics.reduce((a,t)=>(a[t.status]=(a[t.status]||0)+1,a),{})}));
