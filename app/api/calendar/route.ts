import {env} from 'cloudflare:workers';
import {REGIONS} from '@/shared/regions';

const DAY=/^\d{4}-\d{2}-\d{2}$/;

/** Sitzungstermine für den Kalender: je Gebiet, Tag und Gremium mit Anzahl der beratenen Vorgänge.
 *  ?ags=05558012,05558&from=YYYY-MM-DD&to=YYYY-MM-DD (höchstens 500 Gebiete, höchstens ~3 Monate) */
export async function GET(request:Request){
 const p=new URL(request.url).searchParams;
 const ags=(p.get('ags')||'').split(',').filter(a=>/^\d{2,9}$/.test(a)).slice(0,500);
 const from=p.get('from')||'',to=p.get('to')||'';
 if(!DAY.test(from)||!DAY.test(to)||to<from||(Date.parse(to)-Date.parse(from))>100*864e5)
  return Response.json({error:'Ungültiger Zeitraum.'},{status:400});
 if(!env.DB)return Response.json({error:'Datenbank fehlt'},{status:503});
 const set=new Set(ags),regions=REGIONS.filter(r=>set.has(r.ags)),byId=new Map(regions.map(r=>[r.id,r]));
 if(!regions.length)return Response.json({events:[]},{headers:{'Cache-Control':'no-store'}});
 const rows=await env.DB.prepare(`SELECT t.region_id rid,substr(json_extract(e.value,'$.date'),1,10) d,coalesce(json_extract(e.value,'$.committee'),'') c,count(*) n,
   json_group_array(json_object('id',t.id,'title',json_extract(t.payload,'$.title'))) items
  FROM topics t,json_each(t.payload,'$.events') e
  WHERE t.region_id IN (SELECT value FROM json_each(?)) AND json_extract(t.payload,'$.identity.mergedInto') IS NULL
   AND substr(json_extract(e.value,'$.date'),1,10) BETWEEN ? AND ?
  GROUP BY rid,d,c ORDER BY d,rid,c LIMIT 2000`).bind(JSON.stringify(regions.map(r=>r.id)),from,to).all<{rid:string;d:string;c:string;n:number;items:string}>();
 return Response.json({events:rows.results.map(r=>({date:r.d,ags:byId.get(r.rid)?.ags??'',place:byId.get(r.rid)?.name??'',committee:r.c,count:r.n,items:(JSON.parse(r.items) as {id:string;title:string}[]).slice(0,5)}))},{headers:{'Cache-Control':'no-store'}});
}
