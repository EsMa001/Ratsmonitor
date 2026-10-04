// Records the IP address of every source host in server/integrations/source-servers.json.
// The import scheduler limits simultaneous imports per server (source-servers.mjs); many council systems run under the
// municipality's own domain on one shared machine, which only the address reveals. DNS lookups only, no page requests.
// Run after the catalog changed: node scripts/source-discovery/servers.mjs
import fs from 'node:fs';
import dns from 'node:dns/promises';
import {NRW_SOURCES} from '../../server/integrations/source-catalog.mjs';
import {SOURCES} from '../../server/integrations/regions.mjs';
import {hostOf,MUENSTER} from '../../server/integrations/source-servers.mjs';
const file='server/integrations/source-servers.json';
const previous=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')).hosts:{};
const hosts=[...new Set([...SOURCES,...NRW_SOURCES,MUENSTER].map(hostOf).filter(Boolean))].sort();
const found={},queue=[...hosts];
// The lowest address of a host with several keeps the file stable between runs.
await Promise.all(Array.from({length:16},async()=>{for(let host;(host=queue.shift());){try{found[host]=(await dns.resolve4(host)).sort()[0];}catch{found[host]=previous[host]??null;}}}));
fs.writeFileSync(file,JSON.stringify({builtAt:new Date().toISOString().slice(0,10),hosts:Object.fromEntries(hosts.map(host=>[host,found[host]]))},null,1)+'\n');
const addresses=new Set(Object.values(found).filter(Boolean));
console.log(`${hosts.length} Rechnernamen, ${addresses.size} Adressen, ${hosts.filter(h=>!found[h]).length} ohne Antwort; geändert gegenüber vorher: ${hosts.filter(h=>previous[h]!==undefined&&previous[h]!==found[h]).length}`);
