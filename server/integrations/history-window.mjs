export const HISTORY_MONTHS = 12;
/** Rolling calendar window, clamped for leap days and month ends. */
export function historyStart(now=new Date(),months=HISTORY_MONTHS){
 if(!Number.isInteger(months)||months<1||months>36)throw Error('Ungültiger Rückblick');
 const start=new Date(now),day=start.getUTCDate();start.setUTCDate(1);start.setUTCMonth(start.getUTCMonth()-months);
 const last=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)).getUTCDate();start.setUTCDate(Math.min(day,last));return start;
}
