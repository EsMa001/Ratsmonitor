// Portable job: node scripts/import-nrw.mjs [region-id ...]. Independent of hosting.
import fs from 'node:fs/promises';
import {mergeImport} from '../server/integrations/merge-import.mjs';
import {collectRegion} from '../server/integrations/collect-region.mjs';
import {NRW_SOURCES as sources} from '../server/integrations/source-catalog.mjs';
const filter=process.argv.slice(2),selected=filter.length?sources.filter(s=>filter.includes(s.id)):sources;
for(const id of filter)if(!sources.some(s=>s.id===id))throw Error('Keine konfigurierte NRW-Quelle: '+id);
await fs.mkdir('data/nrw',{recursive:true});let index=0;
await Promise.all(Array.from({length:3},async()=>{while(index<selected.length){const source=selected[index++];let result;try{result=await collectRegion(source.id,{onProgress:console.log});}catch(e){result={topics:[],coverage:{regionId:source.id,method:source.method,from:null,to:null,importedAt:null,lastAttemptAt:new Date().toISOString(),meetings:0,sourceCount:1,complete:false,issues:[e.message],sourceUrl:source.system||source.base}};console.log(source.name+': '+e.message);}
 const file='data/nrw/'+source.id+'.json';try{const previous=JSON.parse(await fs.readFile(file,'utf8'));result=mergeImport(previous,result);}catch{}
 await fs.writeFile(file+'.tmp',JSON.stringify(result));await fs.rename(file+'.tmp',file);}}));
const result=[];for(const file of await fs.readdir('data/nrw'))if(file.endsWith('.json'))result.push(JSON.parse(await fs.readFile('data/nrw/'+file,'utf8')));
await fs.writeFile('data/nrw.json',JSON.stringify({topics:result.flatMap(r=>r.topics),coverage:result.map(r=>r.coverage)}));console.log('NRW total',result.reduce((n,r)=>n+r.topics.length,0),'articles in',result.filter(r=>r.topics.length).length,'sources');
