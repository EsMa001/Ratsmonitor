import {TRANSFER_FORMAT,TRANSFER_TABLES,transferTable,hashText,INITIALIZATION_KEYS} from '../../shared/database-transfer.mjs';
import {dataCompleteness} from './data-completeness.mjs';
import {SOURCES_REVISION_SQL} from './revision-cache.mjs';
// The export carries the source states as well (source_coverage): their changes count too (revision-cache.mjs).
const revisionSQL=SOURCES_REVISION_SQL;
export async function exportManifest(db){
 const [before,...rest]=await db.batch([db.prepare(revisionSQL),...Object.keys(TRANSFER_TABLES).map(t=>db.prepare(`SELECT count(*) AS count FROM ${t}`)),db.prepare("SELECT key,value FROM system_state WHERE key IN (?,?,?)").bind(...INITIALIZATION_KEYS),db.prepare(revisionSQL)]);
 const after=rest.pop().results[0].revision;
 if(before.results[0].revision!==after)throw Error('Datenstand wurde geändert');
 const initialization=rest.pop().results;
 const tables=Object.keys(TRANSFER_TABLES).map((name,i)=>({name,columns:TRANSFER_TABLES[name],count:Number(rest[i].results[0].count)}));
 return {format:TRANSFER_FORMAT,revision:Number(after),createdAt:new Date().toISOString(),tables,initialization,includes:'Artikel, frühere Fassungen, Analysen und Quellenstand',excludes:'Anmeldung, Geheimnisse, Push-Abonnements und Betriebssperren'};
}
export async function exportPage(db,{table,revision,after='',limit=100}){
 const columns=transferTable(table);if(!Number.isSafeInteger(revision)||revision<0||typeof after!=='string'||after.length>1000||!Number.isInteger(limit)||limit<1||limit>100)throw Error('Ungültige Exportauswahl');
 const key=columns[0];
 // D1 batch is one transaction; all rows share the requested database revision.
 const [before,data,afterRead]=await db.batch([db.prepare(revisionSQL),db.prepare(`SELECT ${columns.join(',')} FROM ${table} WHERE ${key}>? ORDER BY ${key} LIMIT ?`).bind(after,limit),db.prepare(revisionSQL)]);
 if(Number(before.results[0].revision)!==revision||Number(afterRead.results[0].revision)!==revision)return {status:409,data:{error:'Daten wurden während des Exports geändert. Export vollständig neu starten.'}};
 // Limit each response by bytes as well as rows. Remaining rows are requested by key.
 const rows=[];let size=0;for(const row of data.results){const bytes=new TextEncoder().encode(JSON.stringify(row)).length;if(size+bytes>4_000_000&&rows.length)break;rows.push(row);size+=bytes;}
 const next=rows.length?String(rows.at(-1)[key]):null;
 return {status:200,data:{format:TRANSFER_FORMAT,revision,table,rows,next,sha256:await hashText(JSON.stringify(rows))}};
}
export async function exportRequest(db,url){
 if(!db)return {status:503,data:{error:'Datenbank fehlt'}};
 const action=url.searchParams.get('action')||'manifest';
 if(action==='manifest')return {status:200,data:await exportManifest(db)};
 if(action==='audit')return {status:200,data:await dataCompleteness(db,url.searchParams.get('region')||'all')};
 if(action!=='page'||!url.searchParams.has('revision'))return {status:400,data:{error:'Unbekannte Exportaktion'}};
 try{return await exportPage(db,{table:url.searchParams.get('table'),revision:Number(url.searchParams.get('revision')),after:url.searchParams.get('after')||''});}catch{return {status:400,data:{error:'Ungültige Exportauswahl'}};}
}
