// Rückblick-Zeiträume für den Abruf amtlicher Daten. Ohne Serverabhängigkeit:
// Adminoberfläche, Worker, portable Skripte und Tests verwenden dieselben Werte.
export const HISTORY_MONTHS = 12;
/** Rolling calendar window, clamped for leap days and month ends. */
export function historyStart(now=new Date(),months=HISTORY_MONTHS){
 if(!Number.isInteger(months)||months<1||months>36)throw Error('Ungültiger Rückblick');
 const start=new Date(now),day=start.getUTCDate();start.setUTCDate(1);start.setUTCMonth(start.getUTCMonth()-months);
 const last=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)).getUTCDate();start.setUTCDate(Math.min(day,last));return start;
}
/** Selectable look-back windows, shortest first. Keys are stored with jobs and source status. */
export const HISTORY_WINDOWS=Object.freeze({
 '1w':Object.freeze({label:'1 Woche',days:7}),
 '1m':Object.freeze({label:'1 Monat',months:1}),
 '3m':Object.freeze({label:'3 Monate',months:3}),
 '12m':Object.freeze({label:'12 Monate',months:HISTORY_MONTHS}),
 '24m':Object.freeze({label:'24 Monate',months:2*HISTORY_MONTHS}),
});
/** Callers that do not choose a window keep the established twelve-month behaviour. */
export const DEFAULT_HISTORY_WINDOW='12m';
export function historyWindow(value){
 if(value===undefined||value===null||value==='')return DEFAULT_HISTORY_WINDOW;
 if(typeof value!=='string'||!Object.hasOwn(HISTORY_WINDOWS,value))throw Error('Ungültiger Rückblick');
 return value;
}
export const historyWindowLabel=value=>HISTORY_WINDOWS[historyWindow(value)].label;
/** First day (inclusive) of the selected window. */
export function windowStart(now=new Date(),value){
 const w=HISTORY_WINDOWS[historyWindow(value)];
 if('days' in w){const start=new Date(now);start.setUTCDate(start.getUTCDate()-w.days);return start;}
 return historyStart(now,w.months);
}
/** Approximate length in days; only used to compare which window is narrower. */
export function windowSpanDays(value){const w=HISTORY_WINDOWS[historyWindow(value)];return 'days' in w?w.days:w.months*31;}
/** How many years a window spans, at least one. Limits that were set for a year of data are multiplied by it. */
export const windowYears=value=>Math.max(1,Math.ceil(windowSpanDays(value)/windowSpanDays('12m')));
/** Calendar months between the window start and now, for sources with monthly calendars. */
export function calendarMonthsBack(now,from){return (now.getUTCFullYear()-from.getUTCFullYear())*12+now.getUTCMonth()-from.getUTCMonth();}
