/** Time series of stored reports for the administration. Pure functions, shared by server, page and tests. */
export const TIMELINE_BUCKETS=Object.freeze({day:'Tag',week:'Woche',month:'Monat'});
export const TIMELINE_RANGES=Object.freeze({'3m':Object.freeze({label:'Letzte 3 Monate',months:3}),'12m':Object.freeze({label:'Letzte 12 Monate',months:12}),'24m':Object.freeze({label:'Letzte 24 Monate',months:24}),all:Object.freeze({label:'Gesamter Bestand'})});
export const TIMELINE_BASES=Object.freeze({event:'Erste Beratung (Sitzungsdatum)',import:'Aufnahme in die Datenbank'});
const DAY=86400000;
const iso=time=>new Date(time).toISOString().slice(0,10);
const time=day=>Date.parse(day+'T00:00:00Z');
const validDay=day=>typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(time(day));
/** First day of the bucket a day belongs to. Weeks start on Monday. */
export function bucketStart(day,bucket){
 if(bucket==='month')return day.slice(0,7)+'-01';
 if(bucket==='week')return iso(time(day)-((new Date(time(day)).getUTCDay()+6)%7)*DAY);
 return day;
}
const nextBucket=(start,bucket)=>{
 if(bucket==='month'){const d=new Date(time(start));return iso(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1));}
 return iso(time(start)+(bucket==='week'?7:1)*DAY);
};
/**
 * Adds up the stored per-area counts for the chosen areas (null: all areas).
 * @param {{days:string[],areas:Record<string,[number,number][]>,undated?:Record<string,number>}} dataset
 * @param {Iterable<string>|null} [ids]
 */
export function mergeAreas(dataset,ids=null){
 const counts=new Map();let undated=dataset.undated&&!ids?Object.values(dataset.undated).reduce((a,b)=>a+b,0):0;
 const wanted=ids?[...ids]:Object.keys(dataset.areas||{});
 if(ids)for(const id of wanted)undated+=dataset.undated?.[id]||0;
 for(const id of wanted)for(const [index,count] of dataset.areas?.[id]||[]){const day=dataset.days[index];counts.set(day,(counts.get(day)||0)+count);}
 return {counts,undated,areas:wanted.filter(id=>(dataset.areas?.[id]?.length||0)+(dataset.undated?.[id]||0)>0).length};
}
/** Start of the displayed period: a number of calendar months back, or the first dated report. */
export function rangeStart(range,today,counts){
 const months=TIMELINE_RANGES[range]?.months;
 if(!months){const first=[...counts.keys()].filter(validDay).sort()[0];return first&&first<today?first:today;}
 const d=new Date(time(today)),target=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-months,1));
 target.setUTCDate(Math.min(d.getUTCDate(),new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate()));
 return iso(target.getTime()+DAY);
}
/**
 * One point per bucket between from and to (both inclusive), empty buckets included.
 * count: new reports in the bucket. total: all reports up to the end of the bucket, including those before the
 * period and those without a date. Reports dated after `to` (already scheduled meetings) are reported as `after`.
 */
export function timelineSeries(counts,{bucket='week',from,to,undated=0}){
 if(!TIMELINE_BUCKETS[bucket])throw Error('Ungültiges Zeitraster');
 if(!validDay(from)||!validDay(to)||from>to)throw Error('Ungültiger Zeitraum');
 let before=undated,after=0;const inside=new Map();
 for(const [day,count] of counts){
  if(!validDay(day)){before+=count;continue;}
  if(day<from)before+=count;else if(day>to)after+=count;else {const key=bucketStart(day,bucket);inside.set(key,(inside.get(key)||0)+count);}
 }
 const points=[];let total=before;
 for(let start=bucketStart(from,bucket);start<=to;start=nextBucket(start,bucket)){const count=inside.get(start)||0;total+=count;points.push({start,count,total});}
 return {points,before,after,total};
}
/** Figures for estimating the daily workload: averages over every calendar day of the period, and the peaks. */
export function timelineStats(counts,{from,to}){
 if(!validDay(from)||!validDay(to)||from>to)throw Error('Ungültiger Zeitraum');
 const days=Math.round((time(to)-time(from))/DAY)+1;let total=0,activeDays=0,peakDay=null;const weeks=new Map();
 for(const [day,count] of counts){
  if(!validDay(day)||day<from||day>to||!count)continue;
  total+=count;activeDays++;if(!peakDay||count>peakDay.count)peakDay={day,count};
  const week=bucketStart(day,'week');weeks.set(week,(weeks.get(week)||0)+count);
 }
 let peakWeek=null;for(const [start,count] of weeks)if(!peakWeek||count>peakWeek.count)peakWeek={start,count};
 const perDay=total/days;
 return {days,total,perDay,perWeek:perDay*7,perYear:perDay*365,activeDays,perActiveDay:activeDays?total/activeDays:0,peakDay,peakWeek};
}
