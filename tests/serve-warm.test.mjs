import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {THEMES} from '../shared/themes.mjs';

// server/node/serve.mjs rechnet die Startansicht des plenara.X Atlas je Thema vor; die Liste dort muss zu shared/themes.mjs passen
test('Vorrechnen im Node-Server kennt alle Themen des Atlas',()=>{
 const src=fs.readFileSync(path.resolve(import.meta.dirname,'../server/node/serve.mjs'),'utf8');
 const list=JSON.parse(src.match(/const THEMES = (\[[^\]]*\])/)[1].replaceAll("'",'"'));
 assert.deepEqual([...list].sort(),THEMES.map(t=>t.id).sort());
});
