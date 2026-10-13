import {readFileSync,statSync,realpathSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {z} from 'zod';
import {openD1} from './d1-sqlite.mjs';
import {createLocalSourceReader} from './ai-local-sources.mjs';
import {createAiLocalWork} from '../integrations/ai-local-work.mjs';
import {createCustomerData} from '../integrations/mcp-customer-data.mjs';

const common = {
  databaseFile:z.string().trim().min(1).max(4096),
  identity:z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,79}$/),
  requestsPerMinute:z.number().int().min(1).max(300).default(60),
};
const schemas = {
  internal:z.object({...common,mode:z.literal('internal'),sourceDirectory:z.string().trim().min(1).max(4096)}).strict(),
  customer:z.object({...common,mode:z.literal('customer'),allowedRegionIds:z.array(z.string().min(1).max(200)).min(1).max(2000)}).strict(),
};

export class McpConfigurationError extends Error {}

/** Configuration belongs to the operator, never to a tool call or a customer request. */
export function loadMcpConfig(mode,file) {
  if (!Object.hasOwn(schemas,mode)) throw new McpConfigurationError('Unbekannter MCP-Zugang.');
  if (!file) throw new McpConfigurationError('Eine MCP-Konfiguration mit --config oder RM_MCP_CONFIG angeben.');
  let parsed,base;
  try {
    const configFile=realpathSync(file);
    const stat=statSync(configFile);
    if (!stat.isFile() || stat.size>64*1024) throw new Error();
    parsed=JSON.parse(readFileSync(configFile,'utf8').replace(/^\uFEFF/,''));
    base=dirname(configFile);
  } catch {
    throw new McpConfigurationError('MCP-Konfiguration fehlt oder ist kein gueltiges JSON-Objekt (maximal 64 KiB).');
  }
  const checked=schemas[mode].safeParse(parsed);
  if (!checked.success) throw new McpConfigurationError('MCP-Konfiguration passt nicht zum Zugang oder enthaelt ungueltige Felder.');
  const config=checked.data;
  try {
    config.databaseFile=realpathSync(resolve(base,config.databaseFile));
    if (!statSync(config.databaseFile).isFile()) throw new Error();
  } catch { throw new McpConfigurationError('Die konfigurierte Datenbankdatei muss bereits existieren.'); }
  if (mode==='internal') config.sourceDirectory=resolve(base,config.sourceDirectory);
  if (mode==='customer') config.allowedRegionIds=Object.freeze([...new Set(config.allowedRegionIds)]);
  return Object.freeze(config);
}

async function checkSchema(db,mode) {
  const required=mode==='internal' ? ['topics','ai_work_items','article_analyses','article_versions','ai_usage'] : ['topics','search_cards'];
  const {results}=await db.prepare('SELECT name FROM sqlite_master WHERE type=?').bind('table').all();
  if (required.some(name=>!results.some(row=>row.name===name))) throw new Error();
  await db.prepare('SELECT id,region_id,event_date,active,payload FROM topics LIMIT 0').all();
  if (mode==='customer') {
    await db.prepare('SELECT id,region_id,date,title,label,status,search,teaser,gremium FROM search_cards LIMIT 0').all();
    await db.prepare('SELECT id FROM topics INDEXED BY idx_topics_inactive WHERE active=0 LIMIT 0').all();
  }
}

export async function openMcpRuntime(mode,file) {
  const config=loadMcpConfig(mode,file);
  // Check compatibility without writing even SQLite journal settings to an old database.
  let db=openD1(config.databaseFile,{readOnly:true});
  try {
    await db.exec('PRAGMA query_only=ON');
    await checkSchema(db,mode);
    if (mode==='customer') {
      const customer=createCustomerData(db,{customerId:config.identity,allowedRegionIds:config.allowedRegionIds});
      return {config,customer,close:()=>db.close()};
    }
    db.close();
    db=openD1(config.databaseFile);
    const work=createAiLocalWork(db,{loadSources:createLocalSourceReader({directory:config.sourceDirectory})});
    return {config,work,close:()=>db.close()};
  } catch {
    db.close();
    throw new McpConfigurationError('Datenbank oder Gebietsfreigabe ist nicht kompatibel. Konfiguration und Migrationen pruefen; MCP migriert keine Datenbank.');
  }
}
