import {mergeImport} from '../server/integrations/merge-import.mjs';
import fs from 'node:fs/promises';
import {collectRegion} from '../server/integrations/collect-region.mjs';
import {SOURCES} from '../server/integrations/regions.mjs';
const results=[];
for(const source of SOURCES){
 let prior={topics:[],coverage:{}};
 try{prior=JSON.parse(await fs.readFile('data/'+source.id+'.json','utf8'));}catch{}
 let result;
 try{
  result=await collectRegion(source.id,{onProgress:console.log});
  result=mergeImport(prior,result);
 }catch(e){result={...prior,coverage:{...prior.coverage,regionId:source.id,complete:false,issues:['Letzter Import fehlgeschlagen: '+e.message],lastAttemptAt:new Date().toISOString()}};}
 console.log(source.id,result.topics.length,result.coverage.issues.length);
 await fs.writeFile('data/'+source.id+'.json',JSON.stringify(result,null,2));results.push(result);
}
await fs.writeFile('data/regions.json',JSON.stringify({topics:results.flatMap(r=>r.topics),coverage:results.map(r=>r.coverage)},null,2));
