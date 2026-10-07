import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../scripts/ai-job.mjs';
import {trends,parseTrends} from '../server/integrations/analytics-trends.mjs';

const catalog=[1,2,3,4,5].map(i=>({id:'r'+i,kind:'city',name:'Ort '+i,ags:'0555800'+i}));
const NOW=Date.parse('2026-06-15T12:00:00Z'),day=n=>new Date(NOW-n*86400000).toISOString().slice(0,10);
test('trends rejects unknown windows and short words',()=>{
 for(const q of ['window=7','window=x','q=ab'])assert.throws(()=>parseTrends(new URLSearchParams(q)));
 assert.equal(parseTrends(new URLSearchParams('')).window,90);
});
test('trends separates rising, new and falling terms between two equal windows',async()=>{
 const sql=new DatabaseSync(':memory:');
 for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8').replaceAll('--> statement-breakpoint',''));
 const db=sqliteAdapter(sql);let n=0;
 const put=(age,region,label,title)=>{n++;sql.prepare("INSERT INTO search_cards (id,region_id,date,status,label,title,teaser,gremium,search) VALUES (?,?,?,'info',?,?, '', '', ?)").run('c'+n,region,day(age),label,title,title.toLowerCase());};
 /* Zeitraum davor (Tage 100 bis 190 zurück): Radweg häufig, Solarpark mittel, Wasserstoff nie */
 for(let i=0;i<40;i++)put(100+(i%80),'r'+(1+i%5),'mobilitaet','Radweg Ausbau Hauptstraße '+i);
 for(let i=0;i<12;i++)put(100+(i%80),'r'+(1+i%5),'klima','Solarpark Planung '+i);
 for(let i=0;i<30;i++)put(100+(i%80),'r'+(1+i%5),'bauen','Bebauungsplan Gewerbegebiet '+i);
 /* Letzte 90 Tage: Wasserstoff neu in vier Gebieten, Solarpark deutlich mehr, Radweg weniger */
 for(let i=0;i<14;i++)put(i*5,'r'+(1+i%4),'klima','Wasserstoff Elektrolyseur Standort '+i);
 for(let i=0;i<36;i++)put(i*2,'r'+(1+i%5),'klima','Solarpark Freifläche '+i);
 for(let i=0;i<8;i++)put(i*9,'r'+(1+i%5),'mobilitaet','Radweg Ausbau Nebenstraße '+i);
 for(let i=0;i<30;i++)put(i*3,'r'+(1+i%5),'bauen','Bebauungsplan Gewerbegebiet '+(100+i));
 try{
  const t=await trends(db,catalog,new URLSearchParams(''),NOW);
  assert.equal(t.window,90);assert.equal(t.totals.recent,88);assert.equal(t.totals.prev,82);assert.equal(t.totals.capped,false);
  assert.ok(t.emerging.some(x=>x.term==='wasserstoff'&&x.np===0&&x.regions===4),'wasserstoff is new');
  assert.ok(t.rising.some(x=>x.term==='solarpark'&&x.ratio>1.4),'solarpark is rising');
  assert.ok(t.falling.some(x=>x.term==='radweg'),'radweg is falling');
  assert.ok(![...t.rising,...t.falling,...t.emerging].some(x=>x.term==='bebauungsplan'),'steady term is not a trend');
  assert.equal(t.rising[0].series.length,t.weeks);
  assert.ok(t.topics.find(x=>x.id==='klima').change>0);assert.ok(t.topics.find(x=>x.id==='mobilitaet').change<0);
  /* Filter wie die Suche: nur ein Gebiet */
  const one=await trends(db,catalog,new URLSearchParams('area=05558001&scope=only'),NOW);
  assert.ok(one.totals.recent<t.totals.recent);
 }finally{sql.close();}
});
