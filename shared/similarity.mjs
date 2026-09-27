import {activeTopics} from './topic-identity.mjs';
// Versioned, deterministic subject matching; never treats a shared category as a match.
export const MATCH_VERSION='subject-terms-v1';
const subjects=[
 ['Kita-Beiträge',/elternbeitr|kitabeitr|kita.beitr|kindergartenbeitr/i],
 ['Kindertagesbetreuung',/kindertages|kindergarten|\bkita\b|kita-bedarf/i],
 ['Nahverkehrsplan',/nahverkehrsplan/i],['ÖPNV',/\böpnv\b|busverkehr|regionalbus|deutschlandticket/i],
 ['Rettungsdienst',/rettungsdienst|rettungswache|rettungsmittel/i],['Pflegeplanung',/pflegebedarfs|pflegeplan|pflegebericht/i],
 ['Klimaanpassung',/klimaanpass|hitzeschutz|starkregen/i],['Klimaschutz',/klimaschutz/i],
 ['Wärmeplanung',/wärmeplan|waermeplan/i],['Windenergie',/windenergie|windkraft/i],
 ['Schulentwicklung',/schulentwickl|schulbedarfs/i],['Ganztagsbetreuung',/ganztag|\bogs\b/i],
 ['Radverkehr',/radverkehr|radweg|radschnell/i],['Deutschlandticket',/deutschlandticket/i],
 ['Abfallgebühren',/abfallgebühr|müllgebühr|abfallentsorgung/i],['Bevölkerungsschutz',/katastrophenschutz|bevölkerungsschutz/i],
 ['Wohnungsbau',/wohnungsbau|wohnbauland|baulandprogramm/i],['Integration',/integrationskonzept|integrationsbericht/i]
];
const stop=new Set('der die das den dem des und oder einer eine eines einem einen für zum zur vom von mit auf aus bei über unter durch nach vor sowie an am im in ist sind wird werden kreis stadt münster billerbeck coesfeld steinfurt borken warendorf recklinghausen antrag anfrage bericht beschluss beschlussfassung vorlage mitteilungen anfragen bekanntgaben verschiedenes öffentlich öffentliche sitzung sachstand fortschreibung änderung beschlussvorlage'.split(' '));
export function features(t){const text=t.officialTitle||t.title||'';return {subjects:subjects.filter(([,r])=>r.test(text)).map(([s])=>s),terms:[...new Set(text.toLowerCase().replace(/[^\p{L} ]/gu,' ').split(/\s+/).filter(w=>w.length>4&&!stop.has(w)).map(w=>w.replace(/(ungen|ern|en|es)$/,'')))]};}
export function storedFeatures(t){const f=t.analysisFeatures;return f?.version===MATCH_VERSION&&f.evidence===(t.officialTitle||t.title||'')&&Array.isArray(f.subjects)&&Array.isArray(f.terms)?f:null;}
export function matchStoredTopics(a,b){const x=storedFeatures(a),y=storedFeatures(b);return x&&y?matchFeatures(x,y):null;}
export function matchTopics(a,b){return matchFeatures(features(a),features(b));}
function matchFeatures(x,y){const common=x.subjects.filter(s=>y.subjects.includes(s));const words=x.terms.filter(w=>y.terms.includes(w));const overlap=words.length/Math.max(1,Math.min(x.terms.length,y.terms.length));if(common.length)return {score:Math.min(.96,.72+common.length*.08),reason:'Gemeinsames Sachthema: '+common.join(', ')};if(words.length>=2&&overlap>=.6)return {score:Math.min(.9,.6+overlap*.25),reason:'Gemeinsame Titelbegriffe: '+words.slice(0,5).join(', ')};return null;}
export function topicPeriod(t,now=new Date()) {
 const today=now.toISOString().slice(0,10),from=new Date(now),end=new Date(now);
 from.setUTCDate(from.getUTCDate()-90);end.setUTCDate(end.getUTCDate()+90);
 const dates=(t.events||[]).map(e=>e.date?.slice(0,10)).filter(Boolean);
 if(!dates.length&&t.eventDate)dates.push(t.eventDate.slice(0,10));
 const last=dates.sort().at(-1);if(!last)return 'unclear';
 if(last<=today&&['approved','rejected','info'].includes(t.status))return 'historical';
 if(last<from.toISOString().slice(0,10))return 'historical';
 if(['announced','consulting','recommended','postponed'].includes(t.status)&&last<=end.toISOString().slice(0,10))return 'current';
 return 'unclear';
}
/** @param {any} topic @param {any[]} candidates @param {{now?:Date,ownDistrict?:string}} options */
export function comparisonDistrict(topic,regions){const r=regions.find(r=>r.id===(topic.regionId||'muenster'));return r?.kind==='district'?r.id:r?.district||undefined;}
export function relatedTopics(topic,candidates,{now=new Date(),ownDistrict=undefined,storedOnly=false}={}){const matches=[];for(const t of activeTopics(candidates)){if(t.id===topic.id||t.source!=='district'||t.regionId===(topic.source==='district'?topic.regionId:ownDistrict))continue;const match=storedOnly?matchStoredTopics(topic,t):matchTopics(topic,t);if(match)matches.push({id:t.id,title:t.title,regionId:t.regionId,status:t.status,eventDate:t.eventDate,sourceUrl:t.sourceUrl,period:topicPeriod(t,now),...match});}matches.sort((a,b)=>b.score-a.score||b.eventDate.localeCompare(a.eventDate)||a.id.localeCompare(b.id));const unique=[...new Map(matches.map(m=>[m.id,m])).values()];return {method:MATCH_VERSION,currentDistricts:[...new Set(unique.filter(m=>m.period==='current').map(m=>m.regionId))],historicalDistricts:[...new Set(unique.filter(m=>m.period==='historical').map(m=>m.regionId))],totalDistricts:[...new Set(unique.map(m=>m.regionId))],matches:unique};}
