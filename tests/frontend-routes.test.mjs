// Paket 4 (C1): App.tsx kennt die Adressen der nachgeladenen Seiten aus lib/routes.ts. Die Listen dort müssen genau die
// Seiten nennen, die InfoPages und AnalyticsPages bedienen; sonst zeigte eine Seite die 404 oder eine Adresse nichts.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=file=>fs.readFileSync(new URL('../components/ratsmonitor/'+file,import.meta.url),'utf8');
const pagesOf=source=>[...source.match(/const PAGES[^=]*=\s*\{([\s\S]*?)\};/)[1].matchAll(/"(\/[^"]*)"\s*:/g)].map(m=>m[1]).sort();
const listOf=(source,name)=>[...source.match(new RegExp(`export const ${name} = \\[([^\\]]*)\\]`))[1].matchAll(/"(\/[^"]*)"/g)].map(m=>m[1]).sort();

test('the route lists name exactly the pages the info and analytics modules serve',()=>{
 const routes=read('lib/routes.ts');
 assert.deepEqual(listOf(routes,'INFO_PATHS'),pagesOf(read('info/InfoPages.tsx')));
 assert.deepEqual(listOf(routes,'ANALYTICS_PATHS'),pagesOf(read('pages/analytics/AnalyticsPages.tsx')));
});

test('pages that may be loaded later are not imported statically by the app shell',()=>{
 const app=read('App.tsx');
 for(const page of ['DetailPage','PersonalPage','LegalPage','InfoPages','AnalyticsPages'])assert.doesNotMatch(app,new RegExp(`^import \\{[^}]*\\b${page}\\b`,'m'),page);
 // The catalog is loaded on demand in the search state (lib/catalog.ts), never imported statically there.
 assert.doesNotMatch(read('state/search.tsx'),/from '@\/shared\/regions'/);
 assert.doesNotMatch(read('pages/DetailPage.tsx'),/from '@\/shared\/regions'/);
});
