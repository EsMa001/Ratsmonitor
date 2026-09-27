export const TRANSFER_FORMAT='ratsmonitor-data-v1';
// Only public subject matter and its processing history. No owners, credentials,
// subscriptions, private endpoints, transient locks, or runtime settings.
export const TRANSFER_TABLES={
 topics:['id','region_id','source','event_date','updated_at','status','payload'],
 article_versions:['id','topic_id','captured_at','payload'],
 article_analyses:['id','topic_id','kind','method','input_hash','created_at','payload'],
 source_coverage:['region_id','payload'],
};
export function transferTable(table){if(!Object.hasOwn(TRANSFER_TABLES,table))throw Error('Unzulässige Tabelle');return TRANSFER_TABLES[table];}
export async function hashText(text){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}

// Only these harmless initialization flags may cross installations.
export const INITIALIZATION_KEYS=['regional-v5-2026-09-26','nrw-e20c38018e3addf1','history-backfill-2026-09-26T22:33:07.868Z'];
