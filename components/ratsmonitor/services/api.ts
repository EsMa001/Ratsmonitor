import type {SavedSearch} from '../types';
const KEY='ratsmonitor:saved-searches:v2';
export function readSavedSearches():SavedSearch[]{
 try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v.filter(s=>s&&typeof s.id==='string'&&typeof s.name==='string'&&typeof s.q==='string'&&typeof s.area==='string').map(s=>({...s,notify:{on:false,freq:'daily'}})):[];}catch{return [];}
}
export function writeSavedSearches(list:SavedSearch[]){localStorage.setItem(KEY,JSON.stringify(list));}
