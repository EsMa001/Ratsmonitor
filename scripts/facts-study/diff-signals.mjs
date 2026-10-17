// Vorher-nachher: gespeicherte Titel-Fakten der Signale gegen die heutigen Regeln, nur lesend (Server).
//   npx esbuild scripts/facts-study/diff-signals.mjs --bundle --platform=node --format=esm > tmp/fakten/diff.mjs
//   ssh ratsmonitor 'nice -n 19 node --input-type=module -' < tmp/fakten/diff.mjs
import {DatabaseSync} from 'node:sqlite';
import * as F from '../../shared/topic-facts.mjs';
const db=new DatabaseSync('/srv/ratsmonitor/data/ratsmonitor.sqlite',{readOnly:true});
const rules={wind_step:F.windStepOf,area_dev:F.areaDevOf,solar:F.solarOf,energy:F.energyOf,school_build:F.schoolBuildOf,care:F.careOf,retail:F.retailOf,tender:F.tenderOf,street:F.streetSignalOf,water:F.waterSignalOf,broadband:F.broadbandSignalOf,project:t=>{const r=F.projectsOf(t);return r.length?r:null;},road:F.roadWorkOf};
const kinds=Object.keys(rules);
const stored={};for(const k of kinds)stored[k]=new Set(db.prepare('SELECT DISTINCT topic_id id FROM topic_facts WHERE kind=?').all(k).map(r=>r.id));
const res={};for(const k of kinds)res[k]={bleibt:0,faelltWeg:0,neu:0,beispWeg:[],beispNeu:[]};
let n=0;
for(const r of db.prepare("SELECT id,json_extract(payload,'$.title') title FROM topics WHERE active=1 AND event_date>='2025-10-01'").iterate()){
 const t=r.title||'';n++;
 for(const k of kinds){
  let v=null;try{v=rules[k](t,'');}catch{}
  const now=v&&(Array.isArray(v)?v.length:true),was=stored[k].has(r.id);
  const o=res[k];
  if(now&&was)o.bleibt++;else if(was&&!now){o.faelltWeg++;if(o.beispWeg.length<12&&(o.faelltWeg%7===1))o.beispWeg.push(t.slice(0,95));}
  else if(now&&!was){o.neu++;if(o.beispNeu.length<12&&(o.neu%9===1))o.beispNeu.push(t.slice(0,95));}
 }
}
console.log(JSON.stringify({titel:n,res}));
