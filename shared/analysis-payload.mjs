// Client islands receive only the fields they actually use, never full query results.
export function analysisControlsData(d){
 const {region,topicId,label,level,from,to,today,topicOptions,regionAvailability}=d;
 return {region,topicId,label,level,from,to,today,topicOptions,regionAvailability};
}
export function mapPlaces(d){return d.geography.map(({matches,coverage,...p})=>({...p,coverage:coverage?{method:coverage.method}:null}));}
export function analysisListQuery(d){return {region:d.region,from:d.from,to:d.to,label:d.label,level:d.level,topic:d.topicId||''};}
export function analysisListPage(d,scope,target,offset,expectedRevision=''){
 const source=scope==='local'?d.articles:d.geography.find(p=>p.id===target)?.matches||[];
 const rows=[...source].sort((a,b)=>a.id.localeCompare(b.id));
 // Stable content fingerprint: detects changed list membership/order between pages.
 let hash=2166136261;
 for(const row of rows)for(const char of row.id+'\n'+row.title+'\n'){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}
 const revision=rows.length+':'+(hash>>>0).toString(16);
 if(expectedRevision&&expectedRevision!==revision)return {changed:true};
 const page=rows.slice(offset,offset+30);
 return {changed:false,items:page,total:rows.length,revision,nextOffset:offset+page.length<rows.length?offset+page.length:null,storageAvailable:d.storageAvailable};
}
