import {TRANSFER_FORMAT,TRANSFER_TABLES,hashText} from './database-transfer.mjs';
// Read-only snapshot. Any intervening article change invalidates the entire download.
export async function downloadDatabase(request,onProgress=(done,total)=>{}){
 const manifest=await request({action:'manifest'});
 if(manifest.format!==TRANSFER_FORMAT||manifest.tables.length!==Object.keys(TRANSFER_TABLES).length)throw Error('Unbekanntes Datenformat');
 const parts=[JSON.stringify({manifest})+'\n'];let done=0;const total=manifest.tables.reduce((n,t)=>n+t.count,0);
 for(const table of manifest.tables){
  if(JSON.stringify(table.columns)!==JSON.stringify(TRANSFER_TABLES[table.name]))throw Error('Unbekannte Tabelle');
  let after='',count=0;
  while(count<table.count){
   const page=await request({action:'page',table:table.name,revision:String(manifest.revision),after});
   if(page.format!==TRANSFER_FORMAT||page.revision!==manifest.revision||page.table!==table.name||!page.rows.length||page.next<=after||await hashText(JSON.stringify(page.rows))!==page.sha256)throw Error('Exportprüfung fehlgeschlagen');
   count+=page.rows.length;done+=page.rows.length;if(count>table.count)throw Error('Artikelbestand wurde geändert');
   parts.push(JSON.stringify(page)+'\n');after=page.next;onProgress(done,total);
  }
 }
 const final=await request({action:'manifest'});
 if(final.revision!==manifest.revision||JSON.stringify(final.tables)!==JSON.stringify(manifest.tables)||JSON.stringify(final.initialization)!==JSON.stringify(manifest.initialization))throw Error('Daten wurden geändert. Bitte den Export neu starten.');
 return {parts,manifest};
}
