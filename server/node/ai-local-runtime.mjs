import {existsSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {openD1} from './d1-sqlite.mjs';
import {createLocalSourceReader} from './ai-local-sources.mjs';
import {createAiLocalWork} from '../integrations/ai-local-work.mjs';

export function localDatabaseFile(file=process.env.DATABASE_FILE){
 if(file)return resolve(file);
 const dir=resolve(process.env.RM_DEV_STATE||'.wrangler/state','v3/d1/miniflare-D1DatabaseObject');
 const files=existsSync(dir)?readdirSync(dir).filter(f=>f.endsWith('.sqlite')&&f!=='metadata.sqlite'):[];
 if(files.length!==1)throw new Error('Lokale Datenbank nicht eindeutig gefunden. DATABASE_FILE auf eine vorhandene SQLite-Datei setzen.');
 return join(dir,files[0]);
}

export function openLocalAiWork({file,directory=process.env.RM_PDF_STORE||'tmp/pdf-store'}={}){
 const db=openD1(localDatabaseFile(file));
 const loadSources=createLocalSourceReader({directory});
 return {work:createAiLocalWork(db,{loadSources}),close:()=>db.close()};
}
