import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {RADAR_IDS} from '../shared/radars.mjs';

// server/node/serve.mjs rechnet die Startansichten jedes Radars vor; die Liste dort muss zu shared/radars.mjs passen
test('Vorrechnen im Node-Server kennt alle Radare',()=>{
 const src=fs.readFileSync(path.resolve(import.meta.dirname,'../server/node/serve.mjs'),'utf8');
 const list=JSON.parse(src.match(/const RADARS = (\[[^\]]*\])/)[1].replaceAll("'",'"'));
 assert.deepEqual([...list].sort(),[...RADAR_IDS].sort());
});
