import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'..');
const compile=(file)=>ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleUrl=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const pagination=await import(moduleUrl(compile('shared/pagination.ts').replace('./regions',moduleUrl("const REGIONS="+fs.readFileSync(path.join(root,'shared/nrw-regions.json'),'utf8')+";export const validRegion=id=>REGIONS.some(r=>r.id===id);"))));
const processUrl=moduleUrl(compile('shared/process.ts'));
const {toCard,toDetail}=await import(moduleUrl(compile('server/mappers/topics.ts').replace('../../shared/topic-identity.mjs',new URL('../shared/topic-identity.mjs',import.meta.url).href).replace('../../shared/process',processUrl).replace('../../shared/analysis-state.mjs',new URL('../shared/analysis-state.mjs',import.meta.url).href).replace('../../shared/labels.mjs',new URL('../shared/labels.mjs',import.meta.url).href)));
const {topics}=JSON.parse(fs.readFileSync(path.join(root,'data/topics.json'),'utf8'));

test('API pagination rejects invalid input and round-trips cursors',()=>{
 assert.equal(pagination.parsePage(new URLSearchParams()).limit,12);
 for(const q of ['limit=0','limit=51','limit=1.5','limit=abc','cursor=broken']) assert.throws(()=>pagination.parsePage(new URLSearchParams(q)),pagination.InvalidPage);
 const cursor=pagination.nextCursor(24,'db:revision');
 assert.deepEqual(pagination.parsePage(new URLSearchParams({cursor,limit:'20'})),{limit:20,offset:24,revision:'db:revision',region:'billerbeck',filter:'alle'});
});
test('card and detail contracts exclude raw texts and private importer fields',()=>{
 const stored={...topics[0],sourceText:'large raw text',documentText:'raw pdf',summaryIssue:'internal',unexpectedSecret:'hidden'};
 const card=toCard(stored),detail=toDetail(stored);
 for(const field of ['sourceText','documentText','summaryIssue','unexpectedSecret']){assert.equal(field in card,false);assert.equal(field in detail,false);}
 for(const field of ['events','documents','longSummary']){assert.equal(field in card,false);assert.deepEqual(detail[field],stored[field]);}
 assert.equal(card.processStage,detail.processStage);
});
test('all existing topics retain titles, status, detail history and original links',()=>{
 for(const topic of topics){
  const card=toCard(topic),detail=toDetail(topic);
  assert.equal(card.title,topic.title);assert.equal(card.status,topic.status);
  assert.deepEqual(detail.events,topic.events);assert.deepEqual(detail.documents,topic.documents);
  assert.ok(card.processStage>=-1&&card.processStage<=3);
 }
});
test('client components and shared modules cannot import server modules transitively',()=>{
 const visited=new Set();
 function walk(file){
  if(visited.has(file))return;visited.add(file);
  const relative=path.relative(root,file).replaceAll('\\','/');
  assert.ok(!relative.startsWith('server/')&&!relative.startsWith('db/')&&!relative.startsWith('data/'),relative+' imported by browser code');
  const source=fs.readFileSync(file,'utf8');
  for(const match of source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)){
   const spec=match[1];assert.notEqual(spec,'cloudflare:workers');assert.notEqual(spec,'server-only');
   if(!spec.startsWith('.')&&!spec.startsWith('@/'))continue;
   const base=spec.startsWith('@/')?path.join(root,spec.slice(2)):path.resolve(path.dirname(file),spec);
   const next=[base,...['.ts','.tsx','.mjs','.json','/index.ts'].map(ext=>base+ext)].find(f=>fs.existsSync(f)&&fs.statSync(f).isFile());
   if(next)walk(next);
  }
 }
 for(const dir of ['components','shared'])for(const entry of fs.readdirSync(path.join(root,dir),{recursive:true})){
  const file=path.join(root,dir,entry);if(/\.(tsx?|mjs)$/.test(file))walk(file);
 }
});

test('status filters distinguish decisions and reject cross-filter cursors',()=>{
 assert.equal(pagination.matchesFilter('recommended','entschieden'),false);
 assert.equal(pagination.matchesFilter('approved','entschieden'),true);
 assert.equal(pagination.matchesFilter('info','offen'),false);
 assert.equal(pagination.matchesFilter('announced','offen'),true);
 const cursor=pagination.nextCursor(12,'revision','offen');
 assert.throws(()=>pagination.parsePage(new URLSearchParams({cursor,filter:'entschieden'})),pagination.InvalidPage);
 assert.throws(()=>pagination.parsePage(new URLSearchParams({filter:'invalid'})),pagination.InvalidPage);
});

test('pagination binds a cursor to its selected region',()=>{
 const cursor=pagination.nextCursor(12,'revision','alle','steinfurt');
 assert.throws(()=>pagination.parsePage(new URLSearchParams({cursor,region:'coesfeld'})),pagination.InvalidPage);
 assert.equal(pagination.parsePage(new URLSearchParams({cursor,region:'steinfurt'})).region,'steinfurt');
});
