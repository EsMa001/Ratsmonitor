// Applies server/integrations/source-overrides.json to nrw-sources.json, exactly as scripts/build-nrw.py does
// after rebuilding the list from the OParl directory. Run after editing the overrides: node scripts/apply-source-overrides.mjs
import fs from 'node:fs';
const dir=new URL('../server/integrations/',import.meta.url);
const read=name=>JSON.parse(fs.readFileSync(new URL(name,dir),'utf8'));
const sources=read('nrw-sources.json'),overrides=read('source-overrides.json');
const unknown=Object.keys(overrides).filter(id=>!sources.some(s=>s.id===id));
if(unknown.length)throw Error('Override ohne Quelle: '+unknown.join(', '));
for(const source of sources)Object.assign(source,overrides[source.id]||{});
fs.writeFileSync(new URL('nrw-sources.json',dir),JSON.stringify(sources,null,2)+String.fromCharCode(10));
console.log(sources.length+' Quellen, '+Object.keys(overrides).length+' Korrekturen angewendet.');
