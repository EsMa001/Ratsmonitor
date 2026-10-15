// Gemeinsame Test-Datenbank (Code-Analyse D14): eine node:sqlite-Datenbank im Speicher mit allen Migrationen aus
// drizzle/ und dem D1-artigen Adapter aus scripts/ai-job.mjs. Statt eigener Adapter je Testdatei.
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../../scripts/ai-job.mjs';
const MIGRATIONS=new URL('../../drizzle/',import.meta.url);
/** {sql, db}: sql ist die node:sqlite-Datenbank, db der D1-artige Zugriff (prepare/bind/first/all/run, batch). */
export function memoryDb({migrations=true,skip=()=>false}={}){
 const sql=new DatabaseSync(':memory:');
 if(migrations)for(const file of fs.readdirSync(MIGRATIONS).filter(f=>f.endsWith('.sql')&&!skip(f)).sort())sql.exec(fs.readFileSync(new URL(file,MIGRATIONS),'utf8'));
 return {sql,db:sqliteAdapter(sql)};
}
export {sqliteAdapter};
const ACCOUNT_MIGRATIONS=new URL('../../drizzle-accounts/',import.meta.url);
/** Kontendatei im Speicher (drizzle-accounts/), wie auf dem Server getrennt von den Inhalten */
export function accountsMemoryDb(){
 const sql=new DatabaseSync(':memory:');
 sql.exec('PRAGMA foreign_keys=ON');
 for(const file of fs.readdirSync(ACCOUNT_MIGRATIONS).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL(file,ACCOUNT_MIGRATIONS),'utf8'));
 return {sql,db:sqliteAdapter(sql)};
}
