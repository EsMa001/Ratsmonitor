import test from 'node:test';
import assert from 'node:assert/strict';
import {configuredAtlasSources,atlasCategory} from '../server/integrations/atlas-sources.mjs';
import {NRW_SOURCES} from '../server/integrations/source-catalog.mjs';
import {SOURCES} from '../server/integrations/regions.mjs';
import {CATALOG} from '../shared/catalog.mjs';
import atlas from '../server/integrations/source-atlas.json' with {type:'json'};

test('catalog sources win over core fallbacks, with the latest catalog entry authoritative',()=>{
 const first={id:'a',method:'scraper',base:'https://old.example/'},latest={id:'a',method:'oparl',system:'https://new.example/system'};
 const catalog=Object.freeze([Object.freeze(first),Object.freeze(latest)]),core=Object.freeze([Object.freeze({id:'a',method:'scraper'}),Object.freeze({id:'b',method:'scraper'})]);
 const sources=configuredAtlasSources(catalog,core);
 assert.equal(sources.get('a'),latest);
 assert.equal(sources.get('b'),core[1]);
 assert.deepEqual([...sources.keys()],['a','b','muenster']);
 assert.deepEqual(catalog,[first,latest]);
 assert.notEqual(configuredAtlasSources(catalog,core),sources,'each caller receives a fresh map');
});

test('an explicit pending catalog entry stays off even when a core fallback exists',()=>{
 const sources=configuredAtlasSources([{id:'a',method:'scraper'},{id:'a',method:'pending'},{id:'b',method:'pending'}],[{id:'a',method:'scraper'},{id:'b',method:'oparl'},{id:'c',method:'pending'}]);
 assert.equal(sources.has('a'),false);
 assert.equal(sources.has('b'),false);
 assert.equal(sources.has('c'),false,'pending core entries are never active');
 assert.equal(atlasCategory('a',{c:'ok'},sources),'other');
});

test('active catalog sources survive a pending core fallback and can supersede a previous pending catalog entry',()=>{
 const active={id:'a',method:'scraper'};
 const sources=configuredAtlasSources([{id:'a',method:'pending'},active],[{id:'a',method:'pending'}]);
 assert.equal(sources.get('a'),active);
 assert.equal(atlasCategory('a',{c:'blocked'},sources),'ok');
});

test('Münster gets its OParl fallback only without an explicit catalog or core entry',()=>{
 assert.deepEqual(configuredAtlasSources([],[]).get('muenster'),{id:'muenster',method:'oparl',system:'https://oparl.stadt-muenster.de/system'});
 const catalog={id:'muenster',method:'oparl',system:'https://configured.example/system'},core={id:'muenster',method:'scraper'};
 assert.equal(configuredAtlasSources([catalog],[core]).get('muenster'),catalog);
 assert.equal(configuredAtlasSources([],[core]).get('muenster'),core);
 assert.equal(configuredAtlasSources([{id:'muenster',method:'pending'}],[core]).has('muenster'),false);
 assert.equal(configuredAtlasSources([],[{id:'muenster',method:'pending'}]).has('muenster'),false);
});

test('current active and unchecked sources override the atlas, while open categories survive without a source',()=>{
 const sources=configuredAtlasSources([{id:'a',method:'scraper'},{id:'b',method:'oparl',checkPending:'Live-Prüfung ausstehend'}],[]);
 assert.equal(atlasCategory('a',{c:'website'},sources),'ok');
 assert.equal(atlasCategory('a',undefined,sources),'ok');
 assert.equal(atlasCategory('b',{c:'ok'},sources),'ready');
 assert.equal(atlasCategory('missing',{c:'ok'},sources),'other');
 assert.equal(atlasCategory('missing',{c:'ready'},sources),'other');
 assert.equal(atlasCategory('missing',undefined,sources),'other');
 for(const c of ['website','blocked','nolink','shared','noreader','other'])assert.equal(atlasCategory('missing',{c},sources),c);
});

test('the current real source map and categories match the former admin semantics',()=>{
 const previous=new Map(NRW_SOURCES.filter(s=>s.method!=='pending').map(s=>[s.id,s]));
 for(const source of SOURCES)if(!previous.has(source.id))previous.set(source.id,source);
 if(!previous.has('muenster'))previous.set('muenster',{id:'muenster',method:'oparl',system:'https://oparl.stadt-muenster.de/system'});
 const current=configuredAtlasSources();
 assert.deepEqual(current,previous,'centralization alone must not change the current selection');
 const count={};
 for(const region of CATALOG){
  const source=previous.get(region.id),row=atlas.areas[region.id];
  const expected=source?(source.checkPending?'ready':'ok'):!row||row.c==='ok'||row.c==='ready'?'other':row.c;
  const actual=atlasCategory(region.id,row,current);
  assert.equal(actual,expected,region.id);
  count[actual]=(count[actual]||0)+1;
 }
 assert.equal(Object.values(count).reduce((sum,n)=>sum+n,0),CATALOG.length);
});
