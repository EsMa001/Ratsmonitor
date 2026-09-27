import type {StoredTopic} from '../types';
import {activeTopics} from '@/shared/topic-identity.mjs';
import 'server-only';
import {env} from 'cloudflare:workers';
import seed from '@/data/topics.json';
import regional from '@/data/regions.json';
import {nrwSnapshot as nrw,fallbackNrwTopics} from '../integrations/nrw-snapshot.mjs';
import {NRW_SOURCES as sources} from '@/server/integrations/source-catalog.mjs';
import {REGIONS,pendingCoverage} from '@/shared/regions';
import {relatedTopics,comparisonDistrict,storedFeatures} from '@/shared/similarity.mjs';
import type {TopicDetail} from '@/shared/types';
export async function getRegionCoverage(){
 let coverage:any[]=[{...seed.coverage,regionId:'muenster',method:'oparl',sourceUrl:'https://oparl.stadt-muenster.de/system'},...regional.coverage,...nrw.coverage];
 const counts=new Map<string,number>(Object.entries(nrw.counts));for(const t of activeTopics([...seed.topics.map(t=>({...t,regionId:'muenster'})),...regional.topics] as unknown as StoredTopic[])){const id=t.regionId||'muenster';counts.set(id,(counts.get(id)||0)+1);}
 try {if(env.DB){const r=await env.DB.prepare("SELECT c.payload,coalesce(t.article_count,0) AS article_count FROM source_coverage c LEFT JOIN (SELECT region_id,count(*) AS article_count FROM topics WHERE json_extract(payload,'$.identity.mergedInto') IS NULL GROUP BY region_id) t ON t.region_id=c.region_id").all<{payload:string;article_count:number}>();coverage=r.results.map(x=>{const c=JSON.parse(x.payload);counts.set(c.regionId,x.article_count);return c;});}}catch{}
 return REGIONS.map(r=>{const source=sources.find(s=>s.id===r.id);const c=coverage.find(c=>c.regionId===r.id)||(source?{...pendingCoverage(r.id),method:source.method,sourceUrl:'system' in source?source.system:source.base,issues:['Öffentliche Quelle konfiguriert; noch kein erfolgreicher Import.']}:pendingCoverage(r.id));return {...c,articleCount:counts.get(r.id)||0};});
}
export async function getRelated(topic:TopicDetail){
 let coverage:any[]=[];try{coverage=await getRegionCoverage();}catch{coverage=regional.coverage;}let candidates:any[]=[...regional.topics];let storageAvailable=true;
 try{if(!env.DB)throw Error();const rows=await env.DB.prepare("SELECT json_remove(payload,'$.sourceText','$.documentText','$.documents','$.longSummary') AS payload FROM topics WHERE source='district'").all<{payload:string}>();candidates=rows.results.map(r=>JSON.parse(r.payload));}catch{storageAvailable=false;candidates.push(...await fallbackNrwTopics(undefined,t=>t.source==='district'?t:null));}
 const ownDistrict=comparisonDistrict(topic,REGIONS);
 return {...relatedTopics(topic,candidates,{ownDistrict:ownDistrict||undefined,storedOnly:true}),analysisPending:!storedFeatures(topic),pendingComparisons:candidates.filter(t=>!storedFeatures(t)).length,coverage:coverage.filter((c:any)=>c.regionId!=='billerbeck'&&c.regionId!=='muenster'),storageAvailable};
}
