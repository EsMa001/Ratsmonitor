import packed from '../../data/nrw-seed-gzip.json' with {type:'json'};
import {loadBackfill} from './load-backfill.mjs';
export const nrwSnapshot={revision:packed.revision,coverage:packed.coverage,counts:packed.counts};
// Keep the Worker bundle compact and decode at most one municipality at a time.
export function nrwImports(regionId){return loadBackfill({...packed,parts:regionId?packed.parts.filter(p=>p.regionId===regionId):packed.parts}).results;}
export async function fallbackNrwTopics(regionId,project=t=>t){
 const topics=[];
 for await(const part of nrwImports(regionId))for(const t of part.topics){const value=project(t);if(value)topics.push(value);}
 return topics;
}
