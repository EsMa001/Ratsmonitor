/**
 * Marks of meetings whose papers were read completely: what the agenda page said at that time.
 *
 * An import reads the agenda page of every meeting in its period. Only if the page says something else than at the
 * last complete reading does it also fetch the paper and attendance pages behind it — about one request instead of
 * six. Reports of an unchanged meeting stay in the database as they are.
 *
 * A mark is relied on only if all of this holds:
 * - the meeting is on the same side of today as when it was read (once it has taken place, results can appear);
 * - it did not take place within the last RECENT_DAYS (results and attendance are still being published), unless it
 *   was read within the last TRUST_HOURS — an import that ran out of time continues behind what it just read;
 * - the complete reading is not older than about two months (spread per meeting, so that they do not all fall
 *   due on the same day);
 * - its reports are still in the database.
 *
 * Marks are a cache, stored per area in system_state. Without them everything is read, as before.
 * MARKS_VERSION must be raised whenever the reading of agenda or paper pages changes: all marks then lose validity.
 */
import {HISTORY_WINDOWS,windowSpanDays} from './history-window.mjs';
export const MARKS_VERSION=1;
export const RECENT_DAYS=14,TRUST_HOURS=6,MIN_AGE_DAYS=45,AGE_SPREAD_DAYS=30;
// Marks are kept as long as the longest selectable import period reaches back, plus two months of slack.
// A mark that is dropped earlier makes every resumed import read the same old meetings again.
export const KEEP_DAYS=Math.max(...Object.keys(HISTORY_WINDOWS).map(windowSpanDays))+58;
const DAY=86400000;
const fnv=value=>{let h=0x811c9dc5;for(const c of new TextEncoder().encode(value)){h^=c;h=Math.imul(h,0x01000193);}return h>>>0;};
const day=time=>new Date(time).toISOString().slice(0,10);
export const marksKey=region=>'import-marks:'+region;
/**
 * The meeting list of an area, kept for the step that continues an import: {window, readAt, body, strategy, rows}.
 * Asking a large installation for two years of meetings can take most of the time of a step; without the kept list
 * every continuation would spend its time on the list again and read no meeting.
 */
export const listKey=region=>'import-list:'+region;
export function readList(text){try{const kept=JSON.parse(text||'null');return kept&&typeof kept.window==='string'&&Number.isFinite(kept.readAt)&&Array.isArray(kept.rows)?kept:null;}catch{return null;}}
/** A kept list is used for the same period and body, and only for TRUST_HOURS: after that the list is asked again. */
export const usableList=(kept,window,body,now)=>Boolean(kept&&kept.window===window&&kept.body===body&&now.getTime()-kept.readAt>=0&&now.getTime()-kept.readAt<TRUST_HOURS*3600000);
/** Stored value → {address: [date, fingerprint, readAt, phase, items]}; anything unreadable or of another version is empty. */
export function readMarks(text){
 try{const stored=JSON.parse(text||'null');return stored?.v===MARKS_VERSION&&stored.marks&&typeof stored.marks==='object'&&!Array.isArray(stored.marks)?stored.marks:{};}catch{return {};}
}
/** Marks of meetings older than the longest import period are dropped. */
export function writeMarks(marks,now){
 const from=day(now.getTime()-KEEP_DAYS*DAY);
 return JSON.stringify({v:MARKS_VERSION,marks:Object.fromEntries(Object.entries(marks).filter(([,m])=>Array.isArray(m)&&m[0]>=from))});
}
/** 'f' before the meeting, 'p' from its day on. */
export const phase=(date,now)=>date>day(now.getTime())?'f':'p';
export const newMark=(meeting,print,now,items)=>[meeting.date,print,now.getTime(),phase(meeting.date,now),items];
/**
 * marks: {known: stored marks, stock: Set of meeting addresses that have reports in the database}
 * Returns {print, trusted} if the mark of this meeting may be relied on, otherwise null.
 * trusted: read so recently that not even the agenda page needs to be fetched.
 */
export function usableMark(marks,meeting,now){
 const stored=marks?.known?.[meeting.url];if(!Array.isArray(stored))return null;
 const [,print,readAt,was,items]=stored,is=phase(meeting.date,now),age=now.getTime()-readAt;
 if(was!==is||!(age>=0))return null;
 if(items>0&&!marks.stock?.has(meeting.url))return null;
 if(age<TRUST_HOURS*3600000)return {print,trusted:true};
 if(is==='p'&&meeting.date>=day(now.getTime()-RECENT_DAYS*DAY))return null;
 if(age>(MIN_AGE_DAYS+fnv(meeting.url)%AGE_SPREAD_DAYS)*DAY)return null;
 return {print,trusted:false};
}
