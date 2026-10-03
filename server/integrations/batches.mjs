// D1 führt einen Batch als Transaktion aus. Viele kleine Batches kosten je einen Roundtrip;
// hier werden Gruppen (die jeweils atomar bleiben müssen) zu Batches bis zur Höchstgröße gebündelt.
export const BATCH_LIMIT=80;
/** groups: Arrays von Statements; eine Gruppe wird nie auf zwei Batches verteilt. */
export function batches(groups,limit=BATCH_LIMIT){
 const out=[];let current=[];
 for(const group of groups){
  if(!group.length)continue;
  if(current.length&&current.length+group.length>limit){out.push(current);current=[];}
  current=current.concat(group);
 }
 if(current.length)out.push(current);
 return out;
}
