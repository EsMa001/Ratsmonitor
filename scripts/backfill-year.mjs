import {gzipSync} from 'node:zlib';
// Reviewed snapshot for existing sources only; resumable per region with --resume.
import fs from 'node:fs/promises';
import {collectRegion} from '../server/integrations/collect-region.mjs';
import {DEFAULT_REGIONS} from './run-imports.mjs';
import {historyStart} from '../server/integrations/history-window.mjs';
const directory='tmp/year-backfill';await fs.mkdir(directory,{recursive:true});
const resume=process.argv.includes('--resume');let index=0;
await Promise.all(Array.from({length:3},async()=>{while(index<DEFAULT_REGIONS.length){
 const region=DEFAULT_REGIONS[index++],file=directory+'/'+region+'.json';
 if(resume){try{await fs.access(file);continue;}catch{}}
 const at=new Date().toISOString();let result;
 try{result=await collectRegion(region,{maxDurationMs:180000,oldestFirst:true,maxRequests:1200,maxPages:24});}
 catch(e){result={topics:[],coverage:{regionId:region,complete:false,issues:[e.message],importedAt:null}};}
 result.coverage={...result.coverage,regionId:region,requestedFrom:historyStart(new Date(at)).toISOString().slice(0,10),lastAttemptAt:at};
 await fs.writeFile(file+'.tmp',JSON.stringify(result));await fs.rename(file+'.tmp',file);
 console.log(JSON.stringify({region,topics:result.topics.length,complete:result.coverage.complete,issues:result.coverage.issues.slice(0,2)}));
}}));
const results=await Promise.all(DEFAULT_REGIONS.map(async id=>JSON.parse(await fs.readFile(directory+'/'+id+'.json','utf8'))));
const revision=new Date().toISOString();await fs.writeFile('data/history-backfill.json',JSON.stringify({revision,results}));
await fs.writeFile('data/history-backfill-gzip.json',JSON.stringify({revision,parts:results.map(result=>({regionId:result.coverage.regionId,data:gzipSync(JSON.stringify(result)).toString('base64')}))}));
console.log('Finished:',results.reduce((n,r)=>n+r.topics.length,0),'retrieved records');
