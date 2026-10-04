import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import compact from '../shared/de-regions.json' with {type:'json'};
import population from '../shared/de-population.json' with {type:'json'};
import map from '../public/geo/de-areas.json' with {type:'json'};
import recorded from '../server/integrations/source-servers.json' with {type:'json'};
import {CATALOG,LANDS,ALL_LANDS,expandRegions,landOf} from '../shared/catalog.mjs';
import {matchesBody} from '../server/integrations/body-identity.mjs';
import {serverGroups,serverOf,hostOf,MUENSTER} from '../server/integrations/source-servers.mjs';
import {NRW_SOURCES} from '../server/integrations/source-catalog.mjs';
import {SOURCES} from '../server/integrations/regions.mjs';
import {provider,PER_PROVIDER} from '../server/integrations/pipeline-jobs.mjs';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {searchMonitor} from '../server/integrations/monitor-search.mjs';
import {radiusParam,areaKeys} from '../shared/radius-areas.mjs';

const catalog=CATALOG.filter(r=>r.id.startsWith('de-'));
test('the other 14 states: districts, municipalities and associations with unique keys, parents, geometry and population',()=>{
 const cities=catalog.filter(r=>r.kind==='city'),districts=catalog.filter(r=>r.kind==='district'),shapes=new Map(map.regions.map(g=>[g.id,g]));
 assert.equal(districts.length,226);assert.equal(cities.length,4231);assert.equal(cities.filter(r=>r.members).length,819);
 assert.equal(new Set(CATALOG.map(r=>r.id)).size,CATALOG.length);assert.equal(new Set(catalog.map(r=>r.ags)).size,catalog.length);
 assert.equal(map.regions.length,catalog.length);
 const districtIds=new Set(districts.map(r=>r.id));
 for(const r of catalog){
  assert.match(r.id,/^de-\d{5}(\d{3,4})?$/);assert.equal(r.id,'de-'+r.ags);assert.ok(r.name&&r.shortName,r.id);
  const shape=shapes.get(r.id);assert.ok(shape&&shape.kind===r.kind&&shape.path.startsWith('M')&&shape.bounds.length===4,r.id);
  if(r.kind==='district'){assert.equal(r.ags.length,5);continue;}
  assert.equal(r.independent,r.district===null,r.id);if(r.district)assert.ok(districtIds.has(r.district),r.id);
  if(r.members){assert.equal(r.ags.length,9);assert.ok(r.members.length>=2,r.id);assert.ok(r.members.every(m=>/^\d{8}$/.test(m.ags)&&m.ags.startsWith(r.ags.slice(0,5))&&m.name),r.id);}else assert.equal(r.ags.length,8);
 }
 /* Jede Gemeinde gehört zu höchstens einem Gebiet */
 const members=cities.flatMap(r=>r.members?r.members.map(m=>m.ags):[r.ags]);assert.equal(new Set(members).size,members.length);
 /* Einwohner: bis auf wenige Gemeinden ohne Angabe in Wikidata */
 assert.ok(catalog.filter(r=>!(population[r.id]>0)).length<=10);
 /* Länder: 16 im Katalog, die Quellensuche ist für zwei gelaufen */
 assert.equal(new Set(ALL_LANDS.map(l=>l.id)).size,16);
 /* Die Quellensuche ist in allen Ländern gelaufen außer Berlin und Hamburg, deren Bezirke noch keine Gebiete sind */
 assert.equal(LANDS.length,14);assert.ok(!LANDS.some(l=>['11','02'].includes(l.id)));
 const lands=new Set(CATALOG.map(landOf));assert.deepEqual([...lands].sort(),ALL_LANDS.map(l=>l.id).sort());
 /* Baden-Württemberg: Mitgliedsgemeinden bleiben eigene Gebiete; Berlin und Hamburg sind je ein Gebiet */
 assert.equal(catalog.filter(r=>r.ags.startsWith('08')&&r.members).length,0);
 assert.deepEqual(catalog.filter(r=>/^(11|02)/.test(r.ags)).map(r=>r.name).sort(),['Stadt Berlin','Stadt Hamburg']);
 assert.equal(catalog.find(r=>r.ags==='10041').name,'Regionalverband Saarbrücken');assert.equal(catalog.find(r=>r.ags==='09162000').name,'Stadt München');
});
test('compact rows expand to catalog areas',()=>{
 const [district,town,free,association]=expandRegions({types:['Landkreis','Stadt','Amt'],districts:[['01051',0,'Dithmarschen']],areas:[['01051044',1,'Heide'],['01002000',1,'Kiel'],['010515163',2,'Büsum-Wesselburen',[['013','Büsum'],['113','Wesselburen']]]]});
 assert.deepEqual(district,{id:'de-01051',name:'Landkreis Dithmarschen',shortName:'Dithmarschen',kind:'district',district:'de-01051',ags:'01051'});
 assert.deepEqual(town,{id:'de-01051044',name:'Stadt Heide',shortName:'Heide',kind:'city',district:'de-01051',ags:'01051044',municipalityType:'Stadt',independent:false});
 assert.equal(free.district,null);assert.equal(free.independent,true);
 assert.deepEqual(association.members,[{ags:'01051013',name:'Büsum'},{ags:'01051113',name:'Wesselburen'}]);assert.equal(association.name,'Amt Büsum-Wesselburen');
 assert.equal(compact.areas.length+compact.districts.length,catalog.length);
});
test('OParl bodies of associations outside Lower Saxony are matched by their regional key or name',()=>{
 const association=catalog.find(r=>r.members&&r.municipalityType==='Verbandsgemeinde'),town=catalog.find(r=>r.ags==='09162000');
 assert.ok(matchesBody({name:association.name,ags:association.ags+'000'},association));
 assert.ok(!matchesBody({name:'Ortsgemeinde',ags:association.ags+'001'},association),'a member council is not the association');
 assert.ok(matchesBody({name:'Verbandsgemeinde '+association.shortName},association),'without key the name decides');
 assert.ok(matchesBody({name:'Landeshauptstadt München',ags:'09162000'},town));assert.ok(matchesBody({name:'München'},{id:'de-09162000',name:'Stadt München',kind:'city'}));
});
test('a member municipality finds the reports of its association; a radius names areas inside or outside',async()=>{
 const sql=new DatabaseSync(':memory:');try{
  for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
  const put=(id,region)=>sql.prepare('INSERT INTO topics VALUES(?,?,?,?,?,?,?)').run(id,'city','2026-09-20','2026-09-20','consulting',JSON.stringify({title:'Schulbau',shortSummary:'',committee:'Rat'}),region);
  const association=catalog.find(r=>r.members),member=association.members[0].ags;
  put('a',association.id);put('b',association.id);put('c','de-09162000');put('d','nds-03101000');
  const db=sqliteAdapter(sql),total=async q=>(await searchMonitor(db,CATALOG,new URLSearchParams(q))).total;
  assert.equal(await total('area='+member+'&scope=only'),2);
  assert.equal(await total('level=city'),4);
  /* Umkreis: Schlüssel der Gebiete (auch 9-stellig) oder ihrer Mitgliedsgemeinden */
  assert.equal(await total('within='+association.ags),2);assert.equal(await total('within='+member+',09162000'),3);assert.equal(await total('within='),0);
  /* without: alles außer den genannten Gebieten */
  assert.equal(await total('without='+association.ags),2);assert.equal(await total('without='+member+',03101000'),1);assert.equal(await total('without='),4);
  await assert.rejects(searchMonitor(db,CATALOG,new URLSearchParams('without=abc')),/Umkreis/);
  await assert.rejects(searchMonitor(db,CATALOG,new URLSearchParams('within=0123456789')),/Umkreis/);
 }finally{sql.close();}
});
test('the radius of the search names only areas with reports, as the shorter of the lists inside and outside',()=>{
 const town=(ags,extra={})=>({id:'x-'+ags,ags,kind:'city',...extra});
 const regions=[town('01001000'),town('01002000'),town('01003000'),town('010515163',{members:[{ags:'01051013'},{ags:'01051113'}]}),town('03153019',{formerAgs:['03153006','03153007']}),town('09162000')];
 const stocked=new Set(['01001000','01002000','01051013','01051113','03153006','03153007']);
 /* Zwei von vier Gebieten mit Berichten liegen im Umkreis: die Liste der Gebiete darin. München hat keine Berichte und wird nicht genannt */
 assert.deepEqual(radiusParam(regions,new Set(['01001000','01051113','09162000']),stocked),['within','01001000,010515163']);
 /* Alle vier liegen darin: kürzer ist die (leere) Liste der Gebiete außerhalb */
 const wide=new Set(['01001000','01002000','01051013','03153007','09162000']);
 assert.deepEqual(radiusParam(regions,wide,stocked),['without','']);
 /* Vier von fünf: das eine Gebiet außerhalb */
 assert.deepEqual(radiusParam(regions,wide,new Set([...stocked,'01003000'])),['without','01003000']);
 assert.deepEqual(radiusParam(regions,new Set(),stocked),['within','']);
 /* Solange unbekannt ist, wo es Berichte gibt, zählt jedes Gebiet */
 assert.deepEqual(radiusParam(regions,new Set(['09162000']),null),['within','09162000']);
 /* Kreise stehen mit ihrem eigenen Schlüssel auf der Karte */
 assert.deepEqual(areaKeys({kind:'district',ags:'01051'}),['01051']);assert.deepEqual(areaKeys(regions[4]),['03153006','03153007']);
 /* Ganz Deutschland mit Berichten in jedem Gebiet: höchstens die Hälfte der Gebiete wird genannt */
 const cities=CATALOG.filter(r=>r.kind==='city'),everywhere=new Set(cities.flatMap(areaKeys)),north=new Set([...everywhere].filter(key=>key<'07'));
 const [name,keys]=radiusParam(cities,north,everywhere);assert.ok(keys.split(',').length<=cities.length/2);assert.ok(['within','without'].includes(name));
});
test('every source of the other states belongs to exactly one catalog area, is verified and has its server recorded',async()=>{
 const {default:sources}=await import('../server/integrations/de-sources.json',{with:{type:'json'}});
 const byId=new Map(catalog.map(r=>[r.id,r])),addresses=new Set();
 for(const s of sources){
  const r=byId.get(s.id);assert.ok(r,s.id);assert.equal(s.name,r.name);assert.equal(s.kind,r.kind);
  /* Berlin und Hamburg: Die Bezirke führen die Vertretungen; ihre Systeme gehören nicht der ganzen Stadt */
  assert.ok(!['11000000','02000000'].includes(r.ags),s.id);
  assert.ok(['oparl','scraper','official-api'].includes(s.method),s.id);assert.match(s.verifiedAt,/^\d{4}-\d{2}-\d{2}$/);
  const key=(s.system||s.base)+'|'+(s.body||'');assert.ok(!addresses.has(key),'address used twice: '+key);addresses.add(key);
  assert.ok(hostOf(s) in recorded.hosts,'node scripts/source-discovery/servers.mjs ausführen: '+hostOf(s));
 }
 /* Keine Quelle der übrigen Länder steht zugleich in den Dateien von NRW oder Niedersachsen */
 const elsewhere=new Set(NRW_SOURCES.filter(s=>!s.id.startsWith('de-')).map(s=>s.id));assert.ok(sources.every(s=>!elsewhere.has(s.id)));
});
test('servers: hosts of one operator or on one address form a group; every source host is recorded',()=>{
 const groups=serverGroups(['a.rim.example','b.rim.example','rat.stadt-a.example','rat.stadt-b.example','c.rim.example','allein.example'],{'a.rim.example':'10.0.0.1','b.rim.example':'10.0.0.2','rat.stadt-a.example':'10.0.0.9','rat.stadt-b.example':'10.0.0.9','c.rim.example':null,'allein.example':null});
 assert.equal(groups.get('a.rim.example'),'rim.example');assert.equal(groups.get('b.rim.example'),'rim.example');assert.equal(groups.get('c.rim.example'),'rim.example','no address: the operator\'s domain');
 assert.equal(groups.get('rat.stadt-a.example'),'ip:10.0.0.9');assert.equal(groups.get('rat.stadt-b.example'),'ip:10.0.0.9');assert.equal(groups.get('allein.example'),'allein.example');
 /* Eine Gemeinde auf der Adresse eines Betreibers gehört zu dessen Gruppe, mit allen seinen Rechnern */
 const joined=serverGroups(['a.rim.example','b.rim.example','rat.stadt-a.example'],{'a.rim.example':'10.0.0.1','b.rim.example':'10.0.0.2','rat.stadt-a.example':'10.0.0.2'});
 assert.equal(new Set(joined.values()).size,1);assert.equal(joined.get('rat.stadt-a.example'),'ip:10.0.0.2');
 /* Katalog: jeder Rechnername einer Quelle hat einen Eintrag; nach einer Katalogänderung scripts/source-discovery/servers.mjs ausführen */
 const hosts=[...new Set([...SOURCES,...NRW_SOURCES,MUENSTER].map(hostOf).filter(Boolean))];
 const missing=hosts.filter(host=>!(host in recorded.hosts));assert.deepEqual(missing,[],'node scripts/source-discovery/servers.mjs ausführen');
 /* Gemeinsame Adressen fassen Gebiete zusammen, die der Domainname trennt */
 const connected=NRW_SOURCES.filter(s=>s.method!=='pending'),domains=new Set(connected.map(s=>hostOf(s).split('.').slice(-2).join('.'))),servers=new Set(connected.map(s=>provider(s.id)));
 assert.ok(servers.size<domains.size);assert.equal(PER_PROVIDER,2);
 /* Ein neuer Rechner eines Betreibers gehört zu dessen Gruppe, wie immer sie heißt */
 assert.equal(serverOf('https://neu.sitzung-online.de/public/'),serverOf('https://www.ahlen.sitzung-online.de/public/'));assert.equal(serverOf('https://ris.unbekannt.example/'),'unbekannt.example');assert.equal(serverOf('kein Verweis'),null);
 assert.equal(provider('nicht-im-katalog'),'area:nicht-im-katalog');
});

test('a shared system is recognised by the name in its address, also below a folder of the district',async()=>{
 const {foreignOwner}=await import('../scripts/source-discovery/areas.mjs');
 const area=id=>CATALOG.find(a=>a.id===id);
 // Fleischwangen links the system of its neighbour Altshausen: not its own.
 assert.equal(foreignOwner(area('de-08436032'),'https://sessionnet.owl-it.de/altshausen/bi/',CATALOG),'Gemeinde Altshausen');
 // Wettringen's own tenant lies in the folder of its district (named after the town of Steinfurt as well).
 assert.equal(foreignOwner(area('nrw-05566096'),'https://sessionnet.owl-it.de/kreis_steinfurt/wettringen/bi/',CATALOG),null);
 assert.equal(foreignOwner(area('de-08436005'),'https://sessionnet.owl-it.de/altshausen/bi/',CATALOG),null);
});
