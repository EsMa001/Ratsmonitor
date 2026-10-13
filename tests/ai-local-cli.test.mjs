import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {runAiLocal} from '../scripts/ai-local.mjs';
import {applyMigrations} from '../scripts/node-migrate.mjs';

test('agent-neutral CLI reads local text and saves three results without export files',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ai-local-cli-')),file=path.join(dir,'test.sqlite');
 const text='Die Verwaltung plant eine barrierefreie Erneuerung des Eingangsbereichs. Die bestehende Rampe wird ersetzt und der Zugang verbreitert. Der Vorschlag soll zuerst im zuständigen Ausschuss beraten werden. Eine Entscheidung des Rates liegt noch nicht vor.';
 const raw=new DatabaseSync(file);applyMigrations(raw,fileURLToPath(new URL('../drizzle',import.meta.url)),{log:()=>{}});
 raw.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)').run('local-cli','billerbeck','city','2026-10-13','2026-10-13','consulting',JSON.stringify({title:'Barrierefreier Zugang',officialTitle:'Barrierefreier Zugang',documentText:text,events:[],documents:[]}));raw.close();
 const call=async(args,input)=>{let result;await runAiLocal([...args,'--database',file,'--store',path.join(dir,'missing-store')],{input:Readable.from(input?[JSON.stringify(input)]:[]),output:value=>{result=JSON.parse(value);}});return result;};
 try{
  const page=await call(['list','--regions','billerbeck']);assert.equal(page.items[0].id,'local-cli');
  const {claimed:[claim]}=await call(['claim','--ids','local-cli','--agent','test']);
  const manifest=await call(['read','--id',claim.id,'--token',claim.token]);
  for(const source of manifest.sources)for(const page of source.pages){let offset=0;do{const result=await call(['read','--id',claim.id,'--token',claim.token,'--source',source.id,'--page',String(page.number),'--offset',String(offset)]);offset=result.nextOffset??result.source.nextOffset;}while(offset!==null&&offset!==undefined);}
  const saved=await call(['submit'],{id:claim.id,token:claim.token,inputHash:claim.inputHash,result:{agent:'test',model:'unknown',shortSummary:'Die Verwaltung plant einen barrierefreien Zugang.',longSummary:[text],coveredSourceIds:manifest.sources.map(source=>source.id),evidence:[{sourceId:manifest.sources[0].id,page:1,quote:'Die bestehende Rampe wird ersetzt und der Zugang verbreitert.'}],aiLabel:{primary:manifest.labelCatalog[0].id,secondary:[],reason:'Testeinordnung.'},checks:['source_read','process','numbers','neutrality'].map(name=>({name,passed:true}))}});
  assert.ok(saved);
  assert.equal((await call(['list','--regions','billerbeck','--state','completed'])).items.length,1);
  assert.deepEqual(fs.readdirSync(dir).filter(name=>name.endsWith('.json')),[]);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('CLI helps without opening a database and rejects unknown actions',async()=>{
 let help;await runAiLocal(['--help'],{output:value=>{help=value;}});assert.match(help,/claim/);
 await assert.rejects(runAiLocal(['arbitrary-sql']),/gültige Aktion/);
});
