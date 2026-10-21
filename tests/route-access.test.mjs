// Jede Route unter app/api prüft ihren Zugang (CLAUDE.md, Konten): Daten über gated()/guard(), Administration über
// requireAdmin/adminRead, Konten über accountRoute(), interne Aufrufe über den Bearer (internalCall). Ändernde Admin-Routen
// prüfen zusätzlich die Herkunft (requireSameOrigin). Ausnahmen stehen mit Grund in OPEN bzw. ORIGIN_IN.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..'),api=path.join(root,'app/api');
const routes=fs.readdirSync(api,{recursive:true}).map(f=>String(f).split(path.sep).join('/')).filter(f=>f.endsWith('/route.ts')).map(f=>f.slice(0,-'/route.ts'.length));
const RULES={admin:/\brequireAdmin\b|\badminRead\(/,auth:/\baccountRoute\(/,me:/\baccountRoute\(/,dev:/\baccountRoute\(/,internal:/\binternalCall\(/};
const DATA=/\bgated\(|\bguard\(/;
/** Ohne Prüfung in der Route, mit Grund */
const OPEN={
 'calendar/feed/[token]':'Abo-Link für Kalender-Apps: das Token in der Adresse ist die Berechtigung (calendar_feeds)',
 'client-error':'Fehlermeldungen aus dem Browser, auch von Gästen: nur gleiche Herkunft, höchstens 4 KB, Mengenbegrenzung, schreibt nur ins Log (client-errors.mjs)',
 'admin/claim':'alter Admin-Weg über Kopfzeilen, entfällt mit C3 (requirements/cleanup-analyse-2026-10-20.md)',
};
/** Ändernde Admin-Routen, deren Herkunftsprüfung in einem Modul steht */
const ORIGIN_IN={'admin/ai-local':'server/integrations/ai-local-http.mjs'};
const source=route=>fs.readFileSync(path.join(api,route,'route.ts'),'utf8');

test('the route list is complete enough to mean something',()=>{
 assert.ok(routes.length>=60,String(routes.length));
 for(const area of ['admin','analytics','auth','me','internal','x'])assert.ok(routes.some(r=>r.split('/')[0]===area),area);
});

test('every route checks access the way its area requires; exceptions only with a reason',()=>{
 for(const route of routes){
  if(OPEN[route]){assert.ok(OPEN[route].length>20,route);continue;}
  const rule=RULES[route.split('/')[0]]||DATA;
  assert.match(source(route),rule,`${route}: Zugang wird nicht geprüft (${rule})`);
 }
});

test('admin routes that change data check the origin (same origin, JSON)',()=>{
 for(const route of routes.filter(r=>r.startsWith('admin/'))){
  const s=source(route);
  if(!/export (?:async )?function (?:POST|PUT|PATCH|DELETE)\b|export const (?:POST|PUT|PATCH|DELETE)\b/.test(s))continue;
  const where=ORIGIN_IN[route]?fs.readFileSync(path.join(root,ORIGIN_IN[route]),'utf8'):s;
  assert.match(where,/\brequireSameOrigin\(/,`${route}: ändernde Route ohne Herkunftsprüfung`);
 }
});
