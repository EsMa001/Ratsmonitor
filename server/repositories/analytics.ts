import {regionAvailability} from '@/shared/region-availability.mjs';
import {resolveTopic} from '@/shared/topic-identity.mjs';
import 'server-only';
import {env} from 'cloudflare:workers';
import seed from '@/data/topics.json';
import regional from '@/data/regions.json';
import {fallbackNrwTopics} from '../integrations/nrw-snapshot.mjs';
import {getRegionCoverage} from './regions';
import {REGIONS,validRegion} from '@/shared/regions';
import {buildAnalytics,berlinToday} from '@/shared/analytics.mjs';
import {cachedRead,rememberRead} from '../services/read-cache.mjs';
import {loadAnalyticsTopics} from './analytics-input.mjs';
import {LABELS} from '@/shared/labels.mjs';
export class InvalidAnalysis extends Error{}
export function analysisQuery(params:URLSearchParams){
 const today=berlinToday(),date=new Date(today+'T12:00:00Z');date.setUTCMonth(date.getUTCMonth()-11,1);
 const region=params.get('region')||'billerbeck',from=params.get('from')||date.toISOString().slice(0,10),to=params.get('to')||today,label=params.get('label')||'bildung',topicId=params.get('topic')||'',level=params.get('level')||'all';
 const validDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
 if(!validRegion(region)||!LABELS.some(l=>l.id===label)||!['all','city','district'].includes(level)||!validDate(from)||!validDate(to)||from>to||to>today||Date.parse(to)-Date.parse(from)>366*3*86400000||topicId.length>120)throw new InvalidAnalysis('Bitte ein gültiges Gebiet und einen Zeitraum bis heute (höchstens drei Jahre) wählen.');
 return {region,from,to,label,topicId,level};
}
export async function getAnalytics(params:URLSearchParams){
 const query=analysisQuery(params);const cacheKey='analytics:'+JSON.stringify(query);const cached=cachedRead(cacheKey);if(cached)return cached;let topics:any[]=[...seed.topics,...regional.topics];let storageAvailable=true;
 try{if(!env.DB)throw Error('DB fehlt');topics=await loadAnalyticsTopics(env.DB);}catch{storageAvailable=false;topics.push(...await fallbackNrwTopics(undefined,t=>({id:t.id,regionId:t.regionId,title:t.title,officialTitle:t.officialTitle,sourceUrl:t.sourceUrl,eventDate:t.eventDate,updatedAt:t.updatedAt,events:t.events,identity:t.identity,classification:t.classification,analysisFeatures:t.analysisFeatures})));}
 if(query.topicId){const focus=resolveTopic(topics,query.topicId);if(!focus||(focus.regionId||'muenster')!==query.region)throw new InvalidAnalysis('Der gewählte Vergleichsartikel gehört nicht zu diesem Gebiet oder ist nicht verfügbar.');query.topicId=focus.id;}
 const coverage=await getRegionCoverage();const result={...buildAnalytics(topics,coverage,REGIONS as unknown as any[],query),regionAvailability:regionAvailability(coverage),storageAvailable};if(storageAvailable)rememberRead(cacheKey,result);return result;
}
