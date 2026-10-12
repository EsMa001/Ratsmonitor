/**
 * Admin-Reiter „Speicher & Sicherungen“: was auf der Festplatte des Servers wie viel Platz belegt, welche Sicherungen es gibt.
 * Gemessen wird auf dem Server (scripts/server-disk.mjs, von scripts/pdf-store/job.mjs höchstens stündlich und auf Wunsch,
 * Tabellen der Datenbank einmal am Tag); die Seite liest nur system_state:
 *  - 'server-disk'        letzte Messung
 *  - 'server-disk-count'  Wunsch „Neu messen“ ({requestedAt, tables}); job.mjs erledigt ihn beim nächsten Aufruf
 * Ob jemand misst, zeigt das Lebenszeichen der PDF-Aufträge ('pdf-store-heartbeat').
 */
import {HEARTBEAT_KEY,HEARTBEAT_STALE_MS} from './pdf-store-admin.mjs';
export const DISK_KEY='server-disk',DISK_COUNT_KEY='server-disk-count';
/** Messung so alt: job.mjs misst neu; Tabellen so alt: mit Tabellen */
export const DISK_EVERY_MS=3600000,TABLES_EVERY_MS=23*3600000;
const parse=v=>{try{return v?JSON.parse(v):null;}catch{return null;}};

/** Letzte Messung, offener Wunsch, ob ein Server-Dienst misst (nur lesen) */
export async function storageState(db,now=Date.now()){
 const {results}=await db.prepare('SELECT key,value FROM system_state WHERE key IN (?,?,?)').bind(DISK_KEY,DISK_COUNT_KEY,HEARTBEAT_KEY).all();
 const by=new Map(results.map(r=>[r.key,parse(r.value)]));
 const heartbeat=by.get(HEARTBEAT_KEY);
 return {disk:by.get(DISK_KEY)||null,count:by.get(DISK_COUNT_KEY)||null,worker:!!heartbeat&&now-Date.parse(heartbeat.at||0)<HEARTBEAT_STALE_MS};
}
/** Neu messen; tables: auch die Tabellen der Datenbank (liest die ganze Datenbank, einige Minuten) */
export async function requestDiskCount(db,tables=false,now=new Date()){
 const count={requestedAt:now.toISOString(),tables:!!tables};
 await db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(DISK_COUNT_KEY,JSON.stringify(count)).run();
 return {count};
}
/** Muss job.mjs messen? {run, tables} aus letzter Messung und Wunsch */
export function diskDue(disk,count,now=Date.now()){
 const asked=!!count?.requestedAt&&!count.startedAt;
 const tables=!disk?.tables||now-Date.parse(disk.tables.at||0)>TABLES_EVERY_MS||asked&&count.tables;
 return {run:asked||!disk||now-Date.parse(disk.at||0)>DISK_EVERY_MS,tables:!!tables,asked};
}
