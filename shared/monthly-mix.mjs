import {LABELS} from './labels.mjs';
/** Compare the first and last populated months, retaining absolute bases and gaps. */
export function compareMonthlyMix(months){
 const populated=months.filter(m=>m.total>0),first=populated[0],last=populated.at(-1);
 if(populated.length<2)return {available:false,first:null,last:null,rows:[],changes:[],gaps:months.filter(m=>!m.total).length};
 const rows=LABELS.map(l=>{
  const a=first.distribution.find(x=>x.id===l.id),b=last.distribution.find(x=>x.id===l.id);
  return {...l,firstCount:a.count,lastCount:b.count,firstShare:a.share,lastShare:b.share,delta:b.share-a.share};
 });
 const changes=rows.filter(l=>!l.kind&&l.id!=='unklar'&&Math.abs(l.delta)>1e-9).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)||a.name.localeCompare(b.name,'de'));
 const meta=m=>({month:m.month,from:m.from,to:m.to,total:m.total,partial:m.partial});
 return {available:true,first:meta(first),last:meta(last),rows,changes,gaps:months.filter(m=>m.month>=first.month&&m.month<=last.month&&!m.total).length};
}
