// Shared source selection for the administration atlas, its generator and work lists.
// Catalog entries are authoritative, including sources explicitly switched off.
import {NRW_SOURCES} from './source-catalog.mjs';
import {SOURCES} from './regions.mjs';

/** Active catalog sources, then core fallbacks for ids absent from the catalog. Inputs stay unchanged. */
export function configuredAtlasSources(catalogSources=NRW_SOURCES,coreSources=SOURCES){
 const configured=new Map(catalogSources.map(s=>[s.id,s])),core=new Map(coreSources.map(s=>[s.id,s]));
 const sources=new Map([...configured].filter(([,s])=>s.method!=='pending'));
 for(const [id,s] of core)if(!configured.has(id)&&s.method!=='pending')sources.set(id,s);
 // Münster is read by its own OParl reader and need not have an entry in either catalog.
 // An explicit pending entry must also suppress this implicit fallback.
 if(!configured.has('muenster')&&!core.has('muenster'))sources.set('muenster',{id:'muenster',method:'oparl',system:'https://oparl.stadt-muenster.de/system'});
 return sources;
}

/** Current source status overrides stored atlas categories; obsolete connected categories become unchecked. */
export function atlasCategory(id,atlasRow,sources){
 const source=sources.get(id);
 if(source&&source.method!=='pending')return source.checkPending?'ready':'ok';
 if(!atlasRow||atlasRow.c==='ok'||atlasRow.c==='ready')return 'other';
 return atlasRow.c;
}
