import test from 'node:test';
import assert from 'node:assert/strict';
import {mapSelection} from '../shared/map-selection.mjs';
import {regionLink} from '../shared/navigation.mjs';
import ts from 'typescript';
import fs from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
const places=[{id:'billerbeck',kind:'city',total:0},{id:'muenster',kind:'city',total:20},{id:'coesfeld',kind:'district',total:10}];
test('map starts on the origin layer; changing layers keeps the inspector inside the visible set',()=>{
 const initial=mapSelection(places,'coesfeld','coesfeld',undefined);assert.equal(initial.activeLayer,'district');assert.equal(initial.current.id,'coesfeld');
 const cities=mapSelection(places,'coesfeld','coesfeld','city');assert.equal(cities.current.id,'muenster');assert.ok(cities.visible.every(p=>p.kind==='city'));
 const districts=mapSelection(places,'muenster','muenster','district');assert.equal(districts.current.id,'coesfeld');assert.ok(districts.visible.some(p=>p.id===districts.selectedId));
});
test('filtered map cannot select a hidden territory; intentional no-data selection remains available',()=>{
 const cities=places.filter(p=>p.kind==='city'),state=mapSelection(cities,'coesfeld','coesfeld','district');assert.equal(state.activeLayer,'city');assert.equal(state.current.id,'muenster');
 assert.equal(mapSelection(places,'muenster','billerbeck','city').current.id,'billerbeck');assert.equal(mapSelection([],'billerbeck','billerbeck','city').current,null);
});
const source=fs.readFileSync(new URL('../components/site-chrome.tsx',import.meta.url),'utf8');
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
 .replaceAll('"react/jsx-runtime"',JSON.stringify(import.meta.resolve('react/jsx-runtime')))
 .replaceAll("'@/shared/navigation.mjs'",JSON.stringify(new URL('../shared/navigation.mjs',import.meta.url).href))
 .replaceAll("'lucide-react'",JSON.stringify(import.meta.resolve('lucide-react')))
 .replaceAll("'@/shared/types'",JSON.stringify('data:text/javascript,export const formatDate=x=>x;'));
const {Header,Footer}=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
test('rendered three-item navigation and header keep the selected territory',()=>{
 const html=renderToStaticMarkup(createElement(Footer,{region:'muenster',active:'analysen'}));
 for(const path of ['/','/analysen','/quellen'])assert.ok(html.includes('href="'+regionLink(path,'muenster')+'"'));
 assert.equal((html.match(/class="tabbar__item"/g)||[]).length,3);assert.ok(!html.includes('/mitteilungen'));assert.equal((html.match(/aria-current="page"/g)||[]).length,1);
 const header=renderToStaticMarkup(createElement(Header,{region:'coesfeld'}));assert.ok(header.includes('href="/?region=coesfeld"'));assert.ok(!header.includes('/mitteilungen'));
});
