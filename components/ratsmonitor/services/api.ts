import type {SavedSearch} from '../types';
export const SAVED_SEARCHES_KEY='ratsmonitor:saved-searches:v2';
const KEY=SAVED_SEARCHES_KEY;
export function readSavedSearches():SavedSearch[]{
 try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v.filter(s=>s&&typeof s.id==='string'&&typeof s.name==='string'&&typeof s.q==='string'&&typeof s.area==='string').map(s=>({...s,notify:s.notify&&typeof s.notify==='object'?{on:!!s.notify.on,freq:['instant','daily','weekly'].includes(s.notify.freq)?s.notify.freq:'daily',mail:!!s.notify.mail,email:typeof s.notify.email==='string'?s.notify.email:''}:{on:false,freq:'daily'}})):[];}catch{return [];}
}
