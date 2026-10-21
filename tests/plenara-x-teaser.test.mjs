import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {xTeaser,teaserParams,TEASERS} from '../server/integrations/plenara-x-teaser.mjs';

test('Auszug nur für freigegebene Signale, feste Parameter (6 Monate bis heute, mit Art)',()=>{
 assert.throws(()=>teaserParams('vergaben-alles'),/Unbekannter Auszug/);
 const p=teaserParams('planung',new Date('2026-10-16T12:00:00Z'));
 assert.deepEqual(Object.fromEntries(p),{signal:'vergaben',from:'2026-04-16',to:'2026-10-16',scope:'with',level:'city',noformal:'1',art:'Planungsleistungen'});
 assert.ok(Object.values(TEASERS).every(t=>t.signal||t.fakt||t.news||t.trend||t.netz||t.ausgang));
});

test('Auszug gibt nur die Zusammenfassung und die 3 neuesten Vorhaben weiter',async()=>{
 const items=[1,2,3,4,5].map(i=>({id:'t'+i,date:'2026-10-1'+i,status:'approved',title:'Vorhaben '+i,gemeinde:'Stadt '+i,phase:i===1?'Sonstiger Schritt':'Aufstellung',teaser:i===3?'Vorhaben 3. Ein Beschluss ist dokumentiert.':'Die Verwaltung schlägt vor, das Gebiet für 40 Wohnungen zu entwickeln, Nummer '+i,steps:[]}));
 const fake=async(db,catalog,params)=>({signal:{id:params.get('signal'),name:'Neue Wohnbaugebiete'},total:5,placeCount:2,firstCount:1,phases:[{key:'Aufstellung',name:'Aufstellung',count:5}],
  places:[{region:'r',name:'Stadt 1',ags:'05515000',count:3},{region:'v',name:'Verband',ags:'031510000',count:2,members:['03151001']}],items,offset:0,size:50,signals:[{id:'x'}]});
 const t=await xTeaser(null,[],'wohnbau',{signals:fake});
 assert.equal(t.items.length,3);
 assert.deepEqual(t.items.map(x=>x.id),['t2','t4','t5'],'erst echter Schritt und eigene Kurzfassung, Standardsätze und vage Schritte nach hinten');
 assert.deepEqual(Object.keys(t.items[0]).sort(),['date','id','phase','place','status','teaser','title']);
 assert.equal(t.signals,undefined,'keine Liste der übrigen Signale');
 assert.deepEqual(t.places[1],{ags:'031510000',count:2,members:['03151001']});
 assert.equal(t.total,5);
});

test('Wert-Auszug: Spanne und Median wie die Fakten-Seite, ohne Gebietsliste',async()=>{
 const map=[550,600,620,700,900].map((v,i)=>({key:'r'+i,n:1,v:{'Grundsteuer B':{n:1,median:v,unit:'%',last:v,...(i===4?{prev:800}:{})}}}));
 const fake=async(db,catalog,params)=>{assert.equal(params.get('view'),'fakten');return {builtAt:'x',regions:[{key:'r0'}],facts:[{kind:'hebesatz',name:'Hebesätze',map}]};};
 const t=await xTeaser(null,[],'grundsteuer',{query:fake});
 assert.deepEqual([t.count,t.median,t.q1,t.q3,t.up,t.down,t.unit],[5,620,600,700,1,0,'%']);
 assert.equal(t.regions,undefined);
});

test('Meldungs-Auszug: feste Abfrage (30 Tage), nur Überschrift, Ort, Gremium, Datum, Zitat',async()=>{
 const p=teaserParams('news-top');assert.deepEqual([p.get('q'),p.get('days'),p.get('n')],[null,'30','3']);
 const items=[1,2,3,4].map(i=>({id:'m'+i,headline:'Ort: Plan '+i,dateline:{place:'Ort',committee:'Rat',date:'2026-10-1'+i},lead:'x',quote:'Zitat '+i,body:['lang']}));
 const t=await xTeaser(null,[],'news-top',{newsFn:async()=>({items})});
 assert.equal(t.items.length,3);
 assert.deepEqual(t.items[0],{id:'m1',headline:'Ort: Plan 1',place:'Ort',committee:'Rat',date:'2026-10-11',quote:'Zitat 1'});
});

test('serve.mjs wärmt genau die freigegebenen Auszüge vor',()=>{
 const serve=fs.readFileSync(new URL('../server/node/serve.mjs',import.meta.url),'utf8');
 const block=serve.slice(serve.indexOf('const TEASER_IDS'),serve.indexOf('];',serve.indexOf('const TEASER_IDS')));
 assert.deepEqual([...block.matchAll(/"([^"]+)"/g)].map(m=>m[1]).sort(),Object.keys(TEASERS).sort());
});

test('Trends, Gremien, Ausgang: nur die Kurzfassung',async()=>{
 const tr=await xTeaser(null,[],'trend-umwelt',{trendsFn:async(db,c,p)=>{assert.equal(p.get('label'),'Umwelt, Klima & Energie');return {window:90,rising:[1,2,3,4,5,6].map(i=>({term:'b'+i,nr:10*i,ratio:2,regions:5,regionsPrev:1,series:[1]}))};}});
 assert.equal(tr.items.length,5);assert.deepEqual(tr.items[0],{term:'b1',count:10,ratio:2,regions:5,regionsPrev:1});
 const nz=await xTeaser(null,[],'netz',{networkFn:async()=>({paths:9,edges:[{a:'A',b:'R',n:3,days:8},{a:'B',b:'R',n:7,days:14}]})});
 assert.deepEqual(nz.items[0],{from:'B',to:'R',count:7,days:14});
 const au=await xTeaser(null,[],'ausgang',{decisionsFn:async()=>({totals:{decided:10},rates:{approval:90,postponement:6,rejection:4},duration:{median:14},votes:{all:{unanimous:70}}})});
 assert.deepEqual([au.approval,au.postponement,au.rejection,au.median,au.unanimous],[90,6,4,14,70]);
});

test('mit plenara.X-Worker rechnet der Auszug dort (Art wie x-registry.mjs), nicht im Hauptprozess',async()=>{
 const os=await import('node:os'),path=await import('node:path');
 const {xOffloadStop}=await import('../server/integrations/x-offload.mjs');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'x-teaser-')),worker=path.join(dir,'worker.mjs');
 fs.writeFileSync(worker,"import {parentPort} from 'node:worker_threads';\nparentPort.on('message',({id,kind,params})=>parentPort.postMessage(kind==='trends'?{id,ok:true,value:{window:new URLSearchParams(params).get('scope'),rising:[{term:'Wärmeplanung',nr:4,ratio:2,regions:3,regionsPrev:1}]}}:{id,unknown:true}));\n");
 process.env.RM_X_WORKER=worker;process.env.RM_X_WORKERS='1';
 try{
  // db null: rechnete der Hauptprozess, schlüge es fehl
  const r=await xTeaser(null,[],'trend-alle');
  assert.equal(r.window,'with');assert.deepEqual(r.items,[{term:'Wärmeplanung',count:4,ratio:2,regions:3,regionsPrev:1}]);
 }finally{await xOffloadStop();delete process.env.RM_X_WORKER;delete process.env.RM_X_WORKERS;fs.rmSync(dir,{recursive:true,force:true});}
});
