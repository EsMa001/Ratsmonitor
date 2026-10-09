// Admin page 4: which keywords the stored reports carry, by the way they were found.
//
// - Rule words: the label rules (shared/labels.mjs) search the official title for fixed word patterns. When a pattern
//   decides the label, the rule stores the words it found in the reason of the label ("Erkannte Sachbegriffe: …").
//   Hits of other subject areas in the same title are not stored and therefore not counted here.
// - Title terms and subjects: what the second rule (shared/similarity.mjs) derives from the title for comparing
//   topics between areas.
// - AI keywords: the weighted keywords an AI agent assigned to a report (ten per report, weights add up to 100).
//
// Reads only. Nothing is analysed or written when the page is opened; it counts what earlier steps stored.
const ACTIVE="json_extract(topics.payload,'$.identity.mergedInto') IS NULL";
const PREFIX='Erkannte Sachbegriffe: ';
/** Longest list delivered per kind; the page says so when a list is cut. */
export const KEYWORD_LIST_LIMIT=2000;
// Spellings of one AI keyword are merged below; this many spellings are read at most.
const AI_ROWS=20000;
const key=term=>term.toLocaleLowerCase('de-DE');
/**
 * Merges spellings that differ only in upper and lower case and shows the most frequent one.
 * rows: [{term, group?, ...numbers}] → one row per (group, lower-case term), numbers added up.
 */
function merge(rows,fields){
 const merged=new Map();
 for(const row of rows){
  const id=(row.group||'')+'|'+key(row.term);let m=merged.get(id);
  if(!m){m={term:row.term,best:0,...(row.group?{group:row.group}:{}),...Object.fromEntries(fields.map(f=>[f,0]))};merged.set(id,m);}
  if(row[fields[0]]>m.best){m.best=row[fields[0]];m.term=row.term;}
  for(const f of fields)m[f]+=Number(row[f]||0);
 }
 return [...merged.values()].map(({best,...row})=>row);
}
/** @param {any} db @param {{now?:Date,limit?:number}} [options] */
export async function adminKeywords(db,{now=new Date(),limit=KEYWORD_LIST_LIMIT}={}){
 const [counts,reasons,terms,subjects,ai]=await Promise.all([
  db.prepare(`SELECT count(*) articles,
    coalesce(sum(json_extract(payload,'$.classification.primary') IS NOT NULL),0) labelled,
    coalesce(sum(json_type(payload,'$.analysisFeatures.terms')='array'),0) analysed,
    coalesce(sum(json_extract(payload,'$.weightedKeywords.status')='completed'),0) profiles,
    coalesce(sum(json_extract(payload,'$.weightedKeywords.status')='completed' AND json_extract(payload,'$.weightedKeywords.inputBasis')='content'),0) content,
    coalesce(sum(json_extract(payload,'$.weightedKeywords.status')='stale'),0) stale
   FROM topics WHERE ${ACTIVE}`).first(),
  // One row per label and reason: few rows however many reports there are.
  db.prepare(`SELECT json_extract(payload,'$.classification.primary') label,json_extract(payload,'$.classification.reason') reason,count(*) n FROM topics WHERE ${ACTIVE} AND json_extract(payload,'$.classification.primary') IS NOT NULL GROUP BY 1,2`).all(),
  db.prepare(`SELECT term,n,count(*) OVER() distinctTerms,sum(n=1) OVER() once FROM (SELECT j.value term,count(*) n FROM topics,json_each(topics.payload,'$.analysisFeatures.terms') j WHERE ${ACTIVE} AND j.value IS NOT NULL GROUP BY 1) ORDER BY n DESC,term LIMIT ?`).bind(limit).all(),
  db.prepare(`SELECT j.value term,count(*) n FROM topics,json_each(topics.payload,'$.analysisFeatures.subjects') j WHERE ${ACTIVE} AND j.value IS NOT NULL GROUP BY 1 ORDER BY n DESC,term`).all(),
  // Only current profiles. A profile whose title changed since (status "stale") no longer describes the report.
  db.prepare(`SELECT term,n,weight,contentN,contentWeight,count(*) OVER() spellings FROM (
    SELECT trim(json_extract(j.value,'$.term')) term,count(*) n,coalesce(sum(json_extract(j.value,'$.weight')),0) weight,
     coalesce(sum(json_extract(topics.payload,'$.weightedKeywords.inputBasis')='content'),0) contentN,
     coalesce(sum(CASE WHEN json_extract(topics.payload,'$.weightedKeywords.inputBasis')='content' THEN json_extract(j.value,'$.weight') ELSE 0 END),0) contentWeight
    FROM topics,json_each(topics.payload,'$.weightedKeywords.items') j
    WHERE ${ACTIVE} AND json_extract(topics.payload,'$.weightedKeywords.status')='completed' AND coalesce(trim(json_extract(j.value,'$.term')),'')!='' GROUP BY 1)
   ORDER BY n DESC,weight DESC,term LIMIT ?`).bind(AI_ROWS).all(),
 ]);
 // Rule words: a reason lists the words of one title; each word counts once per report.
 const outcome={withWords:0,formal:0,general:0,several:0,none:0,other:0},found=[];
 for(const row of reasons.results){
  const reason=String(row.reason||''),n=Number(row.n);
  if(reason.startsWith(PREFIX)){
   outcome.withWords+=n;
   const words=new Map(reason.slice(PREFIX.length).split(', ').map(w=>w.trim()).filter(Boolean).map(w=>[key(w),w]));
   for(const term of words.values())found.push({term,group:row.label,articles:n});
  }else if(row.label==='sitzung')outcome.formal+=n;
  else if(row.label==='allgemein')outcome.general+=n;
  else if(reason.startsWith('Mehrere mögliche Sachgebiete'))outcome.several+=n;
  else if(row.label==='unklar')outcome.none+=n;
  else outcome.other+=n;
 }
 const words=merge(found,['articles']).map(({group,...w})=>({...w,label:group})).sort((a,b)=>b.articles-a.articles||a.term.localeCompare(b.term,'de'));
 const aiRows=ai.results,cut=aiRows.length>=AI_ROWS;
 const items=merge(aiRows.map(r=>({term:String(r.term),articles:Number(r.n),weight:Number(r.weight),contentArticles:Number(r.contentN),contentWeight:Number(r.contentWeight)})),['articles','weight','contentArticles','contentWeight'])
  .sort((a,b)=>b.articles-a.articles||b.weight-a.weight||a.term.localeCompare(b.term,'de'));
 return {
  asOf:now.toISOString(),articles:Number(counts.articles),listLimit:limit,
  rule:{labelled:Number(counts.labelled),...outcome,distinct:words.length,words:words.slice(0,limit)},
  titleTerms:{analysed:Number(counts.analysed),distinct:Number(terms.results[0]?.distinctTerms||0),once:Number(terms.results[0]?.once||0),terms:terms.results.map(r=>({term:String(r.term),articles:Number(r.n)})),subjects:subjects.results.map(r=>({term:String(r.term),articles:Number(r.n)}))},
  // Beyond AI_ROWS spellings the count of distinct keywords is the count of spellings (an upper bound).
  ai:{profiles:Number(counts.profiles),content:Number(counts.content),stale:Number(counts.stale),distinct:cut?Number(aiRows[0].spellings):items.length,once:cut?null:items.filter(i=>i.articles===1).length,cut,items:items.slice(0,limit)},
 };
}

// --- Built in steps (admin-builds.mjs): the same counts, one chunk of areas at a time ---
// Each chunk adds its counts to admin_agg (terms, subjects, AI keywords, rule words) and to the partial sums of the build
// state; finish reads admin_agg and gives the same result as adminKeywords. Every write carries the guard of the build
// (its id and expected cursor), so a chunk sent twice changes nothing the second time.
const IN_CHUNK=' AND topics.region_id IN (SELECT value FROM json_each(?))';
const MAX_JSON=90000;
const packs=rows=>{const out=[];let pack=[],size=2;for(const row of rows){const n=JSON.stringify(row).length+1;if(pack.length&&size+n>MAX_JSON){out.push(JSON.stringify(pack));pack=[];size=2;}pack.push(row);size+=n;}if(pack.length)out.push(JSON.stringify(pack));return out;};
const COUNTS=['articles','labelled','analysed','profiles','content','stale'],OUTCOMES=['withWords','formal','general','several','none','other'];
/**
 * Reads one chunk (ids: JSON list of area ids) and returns the sums to add to the build state and the guarded writes.
 * @param {any} db
 * @param {string} ids
 * @param {{build:string,guard:string,guardArgs:unknown[]}} options guard: SQL condition that holds while the build is at the expected cursor
 */
export async function keywordChunk(db,ids,{build,guard,guardArgs}){
 const [counts,reasons]=await Promise.all([
  db.prepare(`SELECT count(*) articles,
    coalesce(sum(json_extract(payload,'$.classification.primary') IS NOT NULL),0) labelled,
    coalesce(sum(json_type(payload,'$.analysisFeatures.terms')='array'),0) analysed,
    coalesce(sum(json_extract(payload,'$.weightedKeywords.status')='completed'),0) profiles,
    coalesce(sum(json_extract(payload,'$.weightedKeywords.status')='completed' AND json_extract(payload,'$.weightedKeywords.inputBasis')='content'),0) content,
    coalesce(sum(json_extract(payload,'$.weightedKeywords.status')='stale'),0) stale
   FROM topics WHERE ${ACTIVE}${IN_CHUNK}`).bind(ids).first(),
  db.prepare(`SELECT json_extract(payload,'$.classification.primary') label,json_extract(payload,'$.classification.reason') reason,count(*) n FROM topics WHERE ${ACTIVE}${IN_CHUNK} AND json_extract(payload,'$.classification.primary') IS NOT NULL GROUP BY 1,2`).bind(ids).all(),
 ]);
 const outcome=Object.fromEntries(OUTCOMES.map(k=>[k,0])),rule=new Map();
 for(const row of reasons.results){
  const reason=String(row.reason||''),n=Number(row.n);
  if(reason.startsWith(PREFIX)){
   outcome.withWords+=n;
   const words=new Map(reason.slice(PREFIX.length).split(', ').map(w=>w.trim()).filter(Boolean).map(w=>[key(w),w]));
   for(const term of words.values()){const id=JSON.stringify([row.label,term]);rule.set(id,(rule.get(id)||0)+n);}
  }else if(row.label==='sitzung')outcome.formal+=n;
  else if(row.label==='allgemein')outcome.general+=n;
  else if(reason.startsWith('Mehrere mögliche Sachgebiete'))outcome.several+=n;
  else if(row.label==='unklar')outcome.none+=n;
  else outcome.other+=n;
 }
 const statements=[];
 for(const pack of packs([...rule].map(([id,n])=>[...JSON.parse(id),n])))
  statements.push(db.prepare(`INSERT INTO admin_agg(build,list,g,k,n) SELECT ?,'rule',json_extract(value,'$[0]'),json_extract(value,'$[1]'),json_extract(value,'$[2]') FROM json_each(?) WHERE ${guard} ON CONFLICT(build,list,g,k) DO UPDATE SET n=n+excluded.n`).bind(build,pack,...guardArgs));
 for(const [list,path] of [['terms','$.analysisFeatures.terms'],['subjects','$.analysisFeatures.subjects']])
  statements.push(db.prepare(`INSERT INTO admin_agg(build,list,g,k,n) SELECT ?,'${list}','',j.value,count(*) FROM topics,json_each(topics.payload,'${path}') j WHERE ${ACTIVE}${IN_CHUNK} AND j.value IS NOT NULL AND ${guard} GROUP BY j.value ON CONFLICT(build,list,g,k) DO UPDATE SET n=n+excluded.n`).bind(build,ids,...guardArgs));
 statements.push(db.prepare(`INSERT INTO admin_agg(build,list,g,k,n,a,b,c) SELECT ?,'ai','',trim(json_extract(j.value,'$.term')),count(*),coalesce(sum(json_extract(j.value,'$.weight')),0),
    coalesce(sum(json_extract(topics.payload,'$.weightedKeywords.inputBasis')='content'),0),
    coalesce(sum(CASE WHEN json_extract(topics.payload,'$.weightedKeywords.inputBasis')='content' THEN json_extract(j.value,'$.weight') ELSE 0 END),0)
   FROM topics,json_each(topics.payload,'$.weightedKeywords.items') j
   WHERE ${ACTIVE}${IN_CHUNK} AND json_extract(topics.payload,'$.weightedKeywords.status')='completed' AND coalesce(trim(json_extract(j.value,'$.term')),'')!='' AND ${guard}
   GROUP BY trim(json_extract(j.value,'$.term')) ON CONFLICT(build,list,g,k) DO UPDATE SET n=n+excluded.n,a=a+excluded.a,b=b+excluded.b,c=c+excluded.c`).bind(build,ids,...guardArgs));
 return {sums:{...Object.fromEntries(COUNTS.map(k=>[k,Number(counts?.[k]||0)])),...outcome},statements};
}
/**
 * The result of a finished build from admin_agg and the summed counts, in the form of adminKeywords. Rule words: the
 * spelling with the most reports over all areas stands for a word (adminKeywords takes the most frequent per reason).
 * @param {any} db
 * @param {{build:string,sums:Record<string,number>,now?:Date,limit?:number}} options
 */
export async function keywordFinish(db,{build,sums,now=new Date(),limit=KEYWORD_LIST_LIMIT}){
 const [rule,terms,subjects,ai]=await db.batch([
  db.prepare("SELECT g label,k term,n FROM admin_agg WHERE build=? AND list='rule' ORDER BY g,n DESC,k").bind(build),
  db.prepare("SELECT k term,n,count(*) OVER() distinctTerms,sum(n=1) OVER() once FROM admin_agg WHERE build=? AND list='terms' ORDER BY n DESC,k LIMIT ?").bind(build,limit),
  db.prepare("SELECT k term,n FROM admin_agg WHERE build=? AND list='subjects' ORDER BY n DESC,k").bind(build),
  db.prepare("SELECT k term,n,a weight,b contentN,c contentWeight,count(*) OVER() spellings FROM admin_agg WHERE build=? AND list='ai' ORDER BY n DESC,a DESC,k LIMIT ?").bind(build,AI_ROWS),
 ]);
 const words=merge(rule.results.map(r=>({term:String(r.term),group:r.label,articles:Number(r.n)})),['articles']).map(({group,...w})=>({...w,label:group})).sort((a,b)=>b.articles-a.articles||a.term.localeCompare(b.term,'de'));
 const aiRows=ai.results,cut=aiRows.length>=AI_ROWS;
 const items=merge(aiRows.map(r=>({term:String(r.term),articles:Number(r.n),weight:Number(r.weight),contentArticles:Number(r.contentN),contentWeight:Number(r.contentWeight)})),['articles','weight','contentArticles','contentWeight'])
  .sort((a,b)=>b.articles-a.articles||b.weight-a.weight||a.term.localeCompare(b.term,'de'));
 const outcome=Object.fromEntries(OUTCOMES.map(k=>[k,Number(sums[k]||0)]));
 return {
  asOf:now.toISOString(),articles:Number(sums.articles||0),listLimit:limit,
  rule:{labelled:Number(sums.labelled||0),...outcome,distinct:words.length,words:words.slice(0,limit)},
  titleTerms:{analysed:Number(sums.analysed||0),distinct:Number(terms.results[0]?.distinctTerms||0),once:Number(terms.results[0]?.once||0),terms:terms.results.map(r=>({term:String(r.term),articles:Number(r.n)})),subjects:subjects.results.map(r=>({term:String(r.term),articles:Number(r.n)}))},
  ai:{profiles:Number(sums.profiles||0),content:Number(sums.content||0),stale:Number(sums.stale||0),distinct:cut?Number(aiRows[0].spellings):items.length,once:cut?null:items.filter(i=>i.articles===1).length,cut,items:items.slice(0,limit)},
 };
}
