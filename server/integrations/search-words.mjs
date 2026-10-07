/*
 * Wortliste der Suche (Tabellen search_words und search_postings, drizzle/0013).
 *
 * search_words    jedes Wort aus search_cards.search (ab 3 Zeichen) mit der Zahl seiner Karten; TOO_COMMON (501) heißt
 *                 „mehr als 500 Karten“, dann gibt es keine Karten-IDs.
 * search_postings zu jedem Wort mit höchstens 500 Karten die IDs dieser Karten.
 * hits_city/_district bei den häufigen Wörtern und bei seltenen, die in einem häufigen Wort stecken (z. B. „schwul“ in „schwulper“;
 *                 dort greifen die Karten-IDs nicht, weil ein häufiges Wort den Begriff enthält): die genaue Trefferzahl der Suche nach diesem Wort (mit Teilwörtern, je Karte
 *                 einmal), getrennt nach Ebene. Gilt nur ohne Filter und nur solange sich die Daten nicht ändern.
 * search_word_areas / search_word_facets  bei den häufigen Wörtern: die Zahlen je Gebiet bzw. je Ebene, Thema und Status
 *                 (ohne Filter), daraus entsteht die Antwort der Zählabfrage ohne Einträge durchzuzählen.
 *
 * Damit beantwortet die Suche vor dem Durchsuchen aller Karten:
 *   knownWords      kann der Begriff Treffer haben? ja / nein / unbekannt (siehe dort);
 *   candidateCards  welche Karten kommen für den Begriff in Frage? Für seltene Wörter ist das die vollständige Liste (die
 *                   Suche prüft sie mit denselben Bedingungen wie sonst nach), für häufige gibt es keine Liste.
 *
 * Gepflegt wird sie nach Importen: refreshSearchWords liest nur Karten, die seit dem letzten Lauf neu oder geändert sind (neue
 * rowid; die Trigger schreiben search_cards mit INSERT OR REPLACE). Ersetzte oder gelöschte Karten stehen im Protokoll
 * search_cards_gone (Trigger aus drizzle/0015, mit dem alten Suchtext): ihre IDs und ihr Beitrag zu den vorberechneten
 * Zahlen werden abgezogen, bevor Neues dazukommt. Fehlt zu einer Lücke der Eintrag (ältere Trigger, Bestand von Hand
 * geändert) oder sind es mehr als GONE_MAX, verfallen die vorberechneten Zahlen wie früher bis zum nächsten vollen Aufbau;
 * liegen gebliebene Wörter und IDs schaden nicht, die Suche prüft jede Karte aus der Liste erneut.
 */
const STATE_KEY='search-words';
const REVISION_SQL="SELECT coalesce((SELECT revision FROM data_revisions WHERE id='content'),0) revision";
/** Wörter mit höchstens so vielen Karten bekommen Karten-IDs */
export const POSTING_MAX=500;
/** Zählstand für „zu häufig“ */
export const TOO_COMMON=POSTING_MAX+1;
/** Seltene Wörter, die in einem häufigen stecken, werden nur ab dieser Länge vorberechnet: kürzere („ach“, „ber“) sucht niemand
    und sie machen den größten Teil der Zeilen aus */
export const BLOCKED_MIN_CARDS=6;
/** Mehr Kandidaten als hier lohnen sich nicht: dann wird wie gewohnt gesucht */
export const CANDIDATE_MAX=3000;
const WORDS_PER_TERM_MAX=300;
/** Mehr protokollierte Karten als hier je Lauf werden nicht abgezogen (zu viel für einen Worker-Aufruf): dann wie ohne Protokoll */
export const GONE_MAX=5000;

/** Wörter eines Suchtexts (je Karte einmal): nur Buchstaben und Ziffern, ab 3 Zeichen, nicht nur Ziffern */
export function wordsOf(text){
 const found=new Set();
 for(const w of String(text).split(/[^a-z0-9]+/))if(w.length>=3&&!/^\d+$/.test(w))found.add(w);
 return found;
}
const readState=async db=>{try{const row=await db.prepare('SELECT value FROM system_state WHERE key=?').bind(STATE_KEY).first();return row?JSON.parse(row.value):null;}catch{return null;}};
const writeState=(db,state)=>db.prepare('INSERT OR REPLACE INTO system_state(key,value) VALUES(?,?)').bind(STATE_KEY,JSON.stringify(state)).run();
const currentRevision=async db=>String((await db.prepare(REVISION_SQL).first())?.revision??0);
const SCHEMA=[
 'CREATE TABLE IF NOT EXISTS search_words (word TEXT PRIMARY KEY NOT NULL, cards INTEGER NOT NULL DEFAULT 0, hits_city INTEGER, hits_district INTEGER) WITHOUT ROWID',
 'CREATE TABLE IF NOT EXISTS search_postings (word TEXT NOT NULL, card_id TEXT NOT NULL, PRIMARY KEY (word,card_id)) WITHOUT ROWID',
 'CREATE TABLE IF NOT EXISTS search_word_areas (word TEXT NOT NULL, region_id TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (word,region_id)) WITHOUT ROWID',
 'CREATE TABLE IF NOT EXISTS search_word_facets (word TEXT NOT NULL, kind TEXT NOT NULL, label TEXT NOT NULL, status TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (word,kind,label,status)) WITHOUT ROWID',
 /* Protokoll ersetzter und gelöschter Karten; geschrieben von den Triggern aus drizzle/0015 (ohne sie bleibt es leer) */
 'CREATE TABLE IF NOT EXISTS search_cards_gone (card_rowid INTEGER NOT NULL, id TEXT NOT NULL, region_id TEXT NOT NULL, label TEXT NOT NULL, status TEXT NOT NULL, search TEXT NOT NULL)',
];
const ensureSchema=async db=>{for(const sql of SCHEMA)await db.prepare(sql).run();};
/** Ältere Fassung der Tabelle (ohne Zählspalte): dann muss neu aufgebaut werden */
const schemaOk=async db=>{try{await db.prepare('SELECT cards,hits_city,hits_district FROM search_words LIMIT 1').first();await db.prepare('SELECT card_id FROM search_postings LIMIT 1').first();await db.prepare('SELECT n FROM search_word_areas LIMIT 1').first();await db.prepare('SELECT n FROM search_word_facets LIMIT 1').first();return true;}catch{return false;}};
/** D1 erlaubt höchstens 100 Parameter und 100 KB je gebundenem Wert: Daten als JSON-Liste in einem Wert */
const runBatches=async(db,statements)=>{for(let i=0;i<statements.length;i+=20)await db.batch(statements.slice(i,i+20));};
const insertWords=(db,rows)=>{const out=[];for(let i=0;i<rows.length;i+=1500)out.push(db.prepare("INSERT OR REPLACE INTO search_words(word,cards,hits_city,hits_district) SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]'),json_extract(value,'$[2]'),json_extract(value,'$[3]') FROM json_each(?)").bind(JSON.stringify(rows.slice(i,i+1500))));return out;};
const insertRows=(db,table,columns,rows,upsert='')=>{const out=[];const get=columns.map((c,i)=>`json_extract(value,'$[${i}]')`).join(',');for(let i=0;i<rows.length;i+=1500)out.push(db.prepare(`INSERT INTO ${table}(${columns.join(',')}) SELECT ${get} FROM json_each(?) WHERE true ${upsert}`).bind(JSON.stringify(rows.slice(i,i+1500))));return out;};
const insertPostings=(db,pairs)=>{const out=[];for(let i=0;i<pairs.length;i+=1500)out.push(db.prepare("INSERT OR IGNORE INTO search_postings(word,card_id) SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]') FROM json_each(?)").bind(JSON.stringify(pairs.slice(i,i+1500))));return out;};

/**
 * Wortliste auf den Stand der Karten bringen. Ohne Angaben nur das Neue seit dem letzten Lauf.
 * @param {{prepare:Function,batch:Function}} db D1-Datenbank
 * @param {{full?:boolean,chunk?:number,onlyIfBuilt?:boolean,maxCards?:number,kinds?:Map<string,string>,names?:Map<string,string>,postingMax?:number,blockedMin?:number}} options
 *   full: alles neu aufbauen; onlyIfBuilt: nur nachführen, nie den ersten Aufbau machen (für den Import im Worker);
 *   maxCards: höchstens so viele Karten je Lauf (der Rest folgt beim nächsten; bis dahin gilt die Liste als veraltet);
 *   names: Gebiets-ID -> Name; Wörter, die in Gebietsnamen stecken, zählen die Karten dieser Gebiete mit (die Suche findet sie über den Namen)
 *   kinds: Gebiets-ID -> 'city'|'district' für die vorberechneten Trefferzahlen (ohne sie gibt es keine);
 *   blockedMin: ab wie vielen Karten ein seltenes Wort, das in einem häufigen steckt, vorberechnet wird (Standard 6)
 *   postingMax: ab wie vielen Karten ein Wort als häufig gilt (Standard 500; für Tests kleiner)
 */
export async function refreshSearchWords(db,{full=false,chunk=5000,onlyIfBuilt=false,maxCards=Infinity,kinds=null,names=null,postingMax=POSTING_MAX,blockedMin=BLOCKED_MIN_CARDS}={}){
 await ensureSchema(db);
 const state=await readState(db);
 if(onlyIfBuilt&&!full&&!state?.complete)return {skipped:true};
 /* Datenstand vor dem Lesen: ändert sich währenddessen etwas, passt die Liste danach nicht mehr und gilt als veraltet */
 const revision=await currentRevision(db);
 /* Steht an der zuletzt gelesenen rowid nicht mehr dieselbe Karte, wurden rowids neu vergeben: neue Karten würden
    übersprungen, also alles neu. Steht die Karte aber als ersetzt oder gelöscht im Protokoll, ist bekannt, was geschah:
    refreshNew liest die protokollierten rowids erneut. */
 const same=state?.complete&&(state.rowid===0||(await db.prepare('SELECT id FROM search_cards WHERE rowid=?').bind(state.rowid).first())?.id===state.topId
  ||!!(await db.prepare('SELECT 1 x FROM search_cards_gone WHERE card_rowid=? AND id=? LIMIT 1').bind(state.rowid,state.topId).first()));
 if(full||!state?.complete||!same||!(await schemaOk(db)))return buildAll(db,revision,chunk,kinds,postingMax,blockedMin,names);
 return refreshNew(db,state,revision,chunk,maxCards,kinds,postingMax);
}

/** Alle Teilstücke eines Worts (ab 3 Zeichen), die ein häufiger Begriff sind */
function commonTermsIn(word,commonSet,cache){
 let found=cache.get(word);
 if(found)return found;
 const terms=new Set();
 for(let i=0;i<word.length-2;i++)for(let j=i+3;j<=word.length;j++){const part=word.slice(i,j);if(commonSet.has(part))terms.add(part);}
 found=[...terms];cache.set(word,found);return found;
}

/** Voller Aufbau: zählt alle Wörter, behält die IDs der seltenen und rechnet die Trefferzahl der häufigen aus */
async function buildAll(db,revision,chunk,kinds,postingMax,blockedMin,names){
 await writeState(db,{rowid:0,topId:null,revision:null,complete:false,words:0});
 await db.prepare('DROP TABLE IF EXISTS search_postings').run();
 await db.prepare('DROP TABLE IF EXISTS search_word_areas').run();
 await db.prepare('DROP TABLE IF EXISTS search_word_facets').run();
 await db.prepare('DROP TABLE IF EXISTS search_words').run();
 await ensureSchema(db);
 /* Wort -> IDs; null heißt zu häufig */
 const map=new Map();let rowid=0,topId=null,cards=0;
 for(;;){
  const {results}=await db.prepare('SELECT rowid r,id,search FROM search_cards WHERE rowid>? ORDER BY rowid LIMIT ?').bind(rowid,Math.max(chunk,20000)).all();
  if(!results.length)break;
  for(const row of results){
   rowid=row.r;topId=row.id;
   for(const w of wordsOf(row.search)){
    const ids=map.get(w);
    if(ids===undefined)map.set(w,[row.id]);
    else if(ids!==null){if(ids.length>=postingMax)map.set(w,null);else ids.push(row.id);}
   }
  }
  cards+=results.length;
 }
 /* Trefferzahl der Suche nach einem häufigen Wort (mit Teilwörtern, je Karte einmal), getrennt nach Ebene: zweiter Durchlauf,
    je Karte die häufigen Begriffe, die in einem ihrer Wörter stecken */
 const hits=new Map(),areas=new Map(),facets=new Map();
 const common=new Set([...map].filter(([,ids])=>ids===null).map(([w])=>w));
 /* Seltene Wörter, die in einem häufigen stecken: für sie gibt es keine Karten-IDs-Abkürzung, also auch vorberechnen */
 const blocked=new Set();
 for(const c of common)for(let i=0;i<c.length-2;i++)for(let j=i+3;j<=c.length;j++){const part=c.slice(i,j),ids=map.get(part);if(ids&&ids.length>=blockedMin)blocked.add(part);}
 /* Seltene Wörter, die in sehr vielen oder zusammen sehr kartenreichen Wörtern stecken (z. B. wolf, kur, bach): die Karten-IDs würden
    zu viele (über WORDS_PER_TERM_MAX Wörter oder CANDIDATE_MAX Karten), also auch vorberechnen */
 {
  const wordCount=new Map(),cardSum=new Map();
  for(const [w,ids] of map){
   const c=ids?ids.length:TOO_COMMON,seen=new Set();
   for(let i=0;i<w.length-2;i++)for(let j=i+3;j<=w.length;j++){const part=w.slice(i,j);if(map.has(part))seen.add(part);}
   for(const part of seen){wordCount.set(part,(wordCount.get(part)||0)+1);cardSum.set(part,(cardSum.get(part)||0)+c);}
  }
  /* Karten der Gebiete, in deren Namen ein Wort steckt (die Suche nimmt sie über den Namen dazu) */
  const nameCards=new Map();
  if(names){
   const {results:perRegion}=await db.prepare('SELECT region_id,count(*) n FROM search_cards GROUP BY region_id').all();
   const counts=new Map(perRegion.map(r=>[r.region_id,r.n]));
   for(const [id,name] of names){
    const n=counts.get(id);if(!n)continue;
    const norm=String(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replaceAll('ß','ss'),seen=new Set();
    for(let i=0;i<norm.length-2;i++)for(let j=i+3;j<=norm.length;j++){const part=norm.slice(i,j);if(map.has(part))seen.add(part);}
    for(const part of seen)nameCards.set(part,(nameCards.get(part)||0)+n);
   }
  }
  for(const [w,ids] of map)if(ids&&ids.length>=blockedMin&&(wordCount.get(w)>WORDS_PER_TERM_MAX||cardSum.get(w)+(nameCards.get(w)||0)>CANDIDATE_MAX))blocked.add(w);
 }
 const target=new Set([...common,...blocked]);
 if(kinds&&target.size){
  const cache=new Map();let at=0;
  for(;;){
   const {results}=await db.prepare('SELECT rowid r,region_id,label,status,search FROM search_cards WHERE rowid>? ORDER BY rowid LIMIT ?').bind(at,20000).all();
   if(!results.length)break;
   for(const row of results){
    at=row.r;const kind=kinds.get(row.region_id);if(kind!=='city'&&kind!=='district')continue;
    const terms=new Set();
    for(const w of wordsOf(row.search))for(const t of commonTermsIn(w,target,cache))terms.add(t);
    for(const t of terms){
     let h=hits.get(t);if(!h){h={city:0,district:0};hits.set(t,h);}h[kind]++;
     const a=areas.get(t)||areas.set(t,new Map()).get(t);a.set(row.region_id,(a.get(row.region_id)||0)+1);
     const k=kind+'|'+row.label+'|'+row.status,fa=facets.get(t)||facets.set(t,new Map()).get(t);fa.set(k,(fa.get(k)||0)+1);
    }
   }
  }
 }
 const words=[],pairs=[];
 for(const [w,ids] of map){
  const h=hits.get(w);
  const pre=!ids||blocked.has(w);
  words.push([w,ids?ids.length:TOO_COMMON,pre&&kinds?h?.city??0:null,pre&&kinds?h?.district??0:null]);
  if(ids)for(const id of ids)pairs.push([w,id]);
 }
 await runBatches(db,insertWords(db,words));
 await runBatches(db,insertPostings(db,pairs));
 const areaRows=[],facetRows=[];
 for(const [t,m] of areas)for(const [region,n] of m)areaRows.push([t,region,n]);
 for(const [t,m] of facets)for(const [k,n] of m){const [kind,label,status]=k.split('|');facetRows.push([t,kind,label,status,n]);}
 await runBatches(db,insertRows(db,'search_word_areas',['word','region_id','n'],areaRows));
 await runBatches(db,insertRows(db,'search_word_facets',['word','kind','label','status','n'],facetRows));
 await writeState(db,{rowid,topId,revision,complete:true,counted:cards,hasHits:!!kinds,words:words.length,postings:pairs.length,at:new Date().toISOString()});
 return {cards,words:words.length,postings:pairs.length,hitsWords:hits.size,blocked:blocked.size,areaRows:areaRows.length,facetRows:facetRows.length,revision,full:true,reachedEnd:true};
}

/**
 * Ersetzte oder gelöschte Karten seit dem letzten Lauf (search_cards_gone): je rowid bis zur zuletzt gelesenen die zuerst
 * protokollierte Fassung, denn die war gezählt; spätere Fassungen derselben rowid und Karten hinter der letzten rowid wurden
 * nie gezählt. tooMany: mehr als GONE_MAX Einträge, dann wird nichts abgezogen (wie ohne Protokoll).
 */
async function readGone(db,lastRowid){
 const n=(await db.prepare('SELECT count(*) n FROM search_cards_gone').first())?.n??0;
 if(!n)return {rows:[],max:0,tooMany:false};
 const max=(await db.prepare('SELECT max(rowid) m FROM search_cards_gone').first())?.m??0;
 if(n>GONE_MAX)return {rows:[],max,tooMany:true};
 const {results}=await db.prepare('SELECT rowid g,card_rowid,id,region_id,label,status,search FROM search_cards_gone ORDER BY rowid').all();
 const counted=new Map();
 for(const r of results)if(r.card_rowid<=lastRowid&&!counted.has(r.card_rowid))counted.set(r.card_rowid,r);
 return {rows:[...counted.values()],max,tooMany:false};
}

/** Zieht protokollierte Karten ab: ihre IDs bei den seltenen Wörtern (häufige ohne IDs bleiben häufig bis zum nächsten vollen
 *  Aufbau), ihren Beitrag zu Trefferzahl, Gebiets- und Themenzahlen der häufigen Begriffe */
async function subtractCards(db,rows,kinds,termsOf){
 const pairs=[],touched=new Set(),hits=new Map(),areas=new Map(),facets=new Map();
 for(const row of rows){
  for(const w of wordsOf(row.search)){pairs.push([w,row.id]);touched.add(w);}
  const kind=kinds?.get(row.region_id);
  for(const t of termsOf(row,kind)){
   let h=hits.get(t);if(!h){h={city:0,district:0};hits.set(t,h);}h[kind]++;
   const ka=t+'|'+row.region_id;areas.set(ka,(areas.get(ka)||0)+1);
   const kf=t+'|'+kind+'|'+row.label+'|'+row.status;facets.set(kf,(facets.get(kf)||0)+1);
  }
 }
 const statements=[];
 for(let i=0;i<pairs.length;i+=1500)statements.push(db.prepare("DELETE FROM search_postings WHERE (word,card_id) IN (SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]') FROM json_each(?))").bind(JSON.stringify(pairs.slice(i,i+1500))));
 const words=[...touched];
 for(let i=0;i<words.length;i+=1500){
  const json=JSON.stringify(words.slice(i,i+1500));
  statements.push(db.prepare('UPDATE search_words SET cards=(SELECT count(*) FROM search_postings p WHERE p.word=search_words.word) WHERE cards<? AND word IN (SELECT value FROM json_each(?))').bind(TOO_COMMON,json));
  statements.push(db.prepare('DELETE FROM search_words WHERE cards=0 AND hits_city IS NULL AND word IN (SELECT value FROM json_each(?))').bind(json));
 }
 for(const [t,h] of hits)statements.push(db.prepare('UPDATE search_words SET hits_city=max(hits_city-?,0),hits_district=max(hits_district-?,0) WHERE word=? AND hits_city IS NOT NULL').bind(h.city,h.district,t));
 const downA=[...areas].map(([k,n])=>{const [t,region]=k.split('|');return [t,region,n];});
 const downF=[...facets].map(([k,n])=>{const [t,kind,label,status]=k.split('|');return [t,kind,label,status,n];});
 for(let i=0;i<downA.length;i+=1500){
  const json=JSON.stringify(downA.slice(i,i+1500));
  statements.push(db.prepare("UPDATE search_word_areas SET n=n-(SELECT json_extract(j.value,'$[2]') FROM json_each(?) j WHERE json_extract(j.value,'$[0]')=search_word_areas.word AND json_extract(j.value,'$[1]')=search_word_areas.region_id) WHERE (word,region_id) IN (SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]') FROM json_each(?))").bind(json,json));
  statements.push(db.prepare("DELETE FROM search_word_areas WHERE n<=0 AND (word,region_id) IN (SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]') FROM json_each(?))").bind(json));
 }
 for(let i=0;i<downF.length;i+=1500){
  const json=JSON.stringify(downF.slice(i,i+1500));
  statements.push(db.prepare("UPDATE search_word_facets SET n=n-(SELECT json_extract(j.value,'$[4]') FROM json_each(?) j WHERE json_extract(j.value,'$[0]')=search_word_facets.word AND json_extract(j.value,'$[1]')=search_word_facets.kind AND json_extract(j.value,'$[2]')=search_word_facets.label AND json_extract(j.value,'$[3]')=search_word_facets.status) WHERE (word,kind,label,status) IN (SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]'),json_extract(value,'$[2]'),json_extract(value,'$[3]') FROM json_each(?))").bind(json,json));
  statements.push(db.prepare("DELETE FROM search_word_facets WHERE n<=0 AND (word,kind,label,status) IN (SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]'),json_extract(value,'$[2]'),json_extract(value,'$[3]') FROM json_each(?))").bind(json));
 }
 await runBatches(db,statements);
}

/** Nur Karten seit dem letzten Lauf: protokollierte Karten abziehen, neue Wörter anlegen, IDs der seltenen ergänzen, Wörter über
 *  500 Karten kappen, die vorberechneten Zahlen der häufigen Begriffe fortschreiben */
async function refreshNew(db,state,revision,chunk,maxCards,kinds,postingMax){
 let rowid=state.rowid,topId=state.topId??null,cards=0,reachedEnd=false;
 const gone=await readGone(db,state.rowid);
 /* Die vorberechneten Trefferzahlen lassen sich nur fortschreiben, wenn jede Lücke bis zur letzten rowid im Protokoll steht:
    dann sind die Karten bis dahin genau die gezählten ohne die protokollierten. Sonst verfallen sie bis zum nächsten vollen Aufbau. */
 let hitsOk=!!state.hasHits&&!!kinds&&!gone.tooMany;
 if(hitsOk){
  const old=(await db.prepare('SELECT count(*) n FROM search_cards WHERE rowid<=?').bind(state.rowid).first())?.n;
  /* Protokollierte rowids, an denen keine Karte mehr steht (eine ersetzte Spitze behält ihre rowid und zählt im Bestand weiter) */
  const freed=gone.rows.length?(await db.prepare('SELECT count(*) n FROM json_each(?) j WHERE NOT EXISTS (SELECT 1 FROM search_cards c WHERE c.rowid=j.value)').bind(JSON.stringify(gone.rows.map(r=>r.card_rowid))).first())?.n:0;
  hitsOk=old+freed===state.counted;
 }
 const common=new Set();
 if(hitsOk){const {results}=await db.prepare('SELECT word FROM search_words WHERE cards>? OR hits_city IS NOT NULL').bind(POSTING_MAX).all();for(const r of results)common.add(r.word);}
 const termCache=new Map();
 /* Beitrag einer Karte zu den vorberechneten Zahlen: die häufigen Begriffe, die in ihren Wörtern stecken */
 const termsOf=(row,kind)=>{const terms=new Set();if(hitsOk&&(kind==='city'||kind==='district'))for(const w of wordsOf(row.search))for(const t of commonTermsIn(w,common,termCache))terms.add(t);return terms;};
 if(gone.rows.length)await subtractCards(db,gone.rows,kinds,termsOf);
 const addChunk=async results=>{
  const pending=new Map(),bump=new Map(),bumpAreas=new Map(),bumpFacets=new Map();
  for(const row of results){
   if(row.r>=rowid){rowid=row.r;topId=row.id;}
   const kind=kinds?.get(row.region_id),terms=termsOf(row,kind);
   for(const w of wordsOf(row.search)){const list=pending.get(w);if(list)list.push(row.id);else pending.set(w,[row.id]);}
   for(const t of terms){
    let b=bump.get(t);if(!b){b={city:0,district:0};bump.set(t,b);}b[kind]++;
    const ka=t+'|'+row.region_id;bumpAreas.set(ka,(bumpAreas.get(ka)||0)+1);
    const kf=t+'|'+kind+'|'+row.label+'|'+row.status;bumpFacets.set(kf,(bumpFacets.get(kf)||0)+1);
   }
  }
  cards+=results.length;
  /* Bekannte Zählstände der betroffenen Wörter */
  const current=new Map(),all=[...pending.keys()];
  for(let i=0;i<all.length;i+=1500){
   const {results:rows}=await db.prepare('SELECT word,cards FROM search_words WHERE word IN (SELECT value FROM json_each(?))').bind(JSON.stringify(all.slice(i,i+1500))).all();
   for(const r of rows)current.set(r.word,r.cards);
  }
  const fresh=[],touched=[],pairs=[],capped=[];
  for(const [w,ids] of pending){
   const had=current.get(w);
   if(had>=TOO_COMMON)continue;
   if(had===undefined)fresh.push([w,0]);
   if(ids.length>postingMax){capped.push(w);continue;}
   touched.push(w);for(const id of ids)pairs.push([w,id]);
  }
  const statements=[...insertWordsIgnore(db,fresh),...insertPostings(db,pairs)];
  for(let i=0;i<touched.length;i+=1500){
   const json=JSON.stringify(touched.slice(i,i+1500));
   statements.push(db.prepare('UPDATE search_words SET cards=(SELECT count(*) FROM search_postings p WHERE p.word=search_words.word) WHERE word IN (SELECT value FROM json_each(?))').bind(json));
  }
  const upA=[...bumpAreas].map(([k,n])=>{const [t,region]=k.split('|');return [t,region,n];});
  const upF=[...bumpFacets].map(([k,n])=>{const [t,kind,label,status]=k.split('|');return [t,kind,label,status,n];});
  statements.push(...insertRows(db,'search_word_areas',['word','region_id','n'],upA,'ON CONFLICT(word,region_id) DO UPDATE SET n=n+excluded.n'));
  statements.push(...insertRows(db,'search_word_facets',['word','kind','label','status','n'],upF,'ON CONFLICT(word,kind,label,status) DO UPDATE SET n=n+excluded.n'));
  for(const [t,b] of bump)statements.push(db.prepare('UPDATE search_words SET hits_city=hits_city+?,hits_district=hits_district+? WHERE word=? AND hits_city IS NOT NULL').bind(b.city,b.district,t));
  await runBatches(db,statements);
  /* Wörter, die jetzt über 500 Karten haben, verlieren ihre IDs (ihre Trefferzahl gibt es erst nach dem nächsten vollen Aufbau) */
  const over=[...capped];
  for(let i=0;i<touched.length;i+=1500){
   const {results:rows}=await db.prepare('SELECT word FROM search_words WHERE cards>? AND word IN (SELECT value FROM json_each(?))').bind(postingMax,JSON.stringify(touched.slice(i,i+1500))).all();
   for(const r of rows)over.push(r.word);
  }
  const cleanup=[];
  for(let i=0;i<over.length;i+=1500){
   const json=JSON.stringify(over.slice(i,i+1500));
   cleanup.push(db.prepare('DELETE FROM search_postings WHERE word IN (SELECT value FROM json_each(?))').bind(json));
   cleanup.push(db.prepare('UPDATE search_words SET cards=? WHERE word IN (SELECT value FROM json_each(?))').bind(TOO_COMMON,json));
  }
  await runBatches(db,cleanup);
 };
 /* Karten an den protokollierten rowids: eine ersetzte Spitze bekommt ihre rowid wieder, freie rowids werden neu vergeben;
    sie stehen nicht hinter der letzten rowid und werden hier wie neue gelesen */
 if(gone.rows.length){
  const ids=gone.rows.map(r=>r.card_rowid);
  for(let i=0;i<ids.length;i+=1500){
   const {results}=await db.prepare('SELECT rowid r,id,region_id,label,status,search FROM search_cards WHERE rowid IN (SELECT value FROM json_each(?)) ORDER BY rowid').bind(JSON.stringify(ids.slice(i,i+1500))).all();
   if(results.length)await addChunk(results);
  }
 }
 while(cards<maxCards){
  const {results}=await db.prepare('SELECT rowid r,id,region_id,label,status,search FROM search_cards WHERE rowid>? ORDER BY rowid LIMIT ?').bind(rowid,chunk).all();
  if(!results.length){reachedEnd=true;break;}
  await addChunk(results);
 }
 /* Das Protokoll bis zum gelesenen Stand ist verarbeitet; was seither dazukam, bleibt für den nächsten Lauf */
 if(gone.max)await db.prepare('DELETE FROM search_cards_gone WHERE rowid<=?').bind(gone.max).run();
 if(state.hasHits&&!hitsOk){
  await db.prepare('UPDATE search_words SET hits_city=NULL,hits_district=NULL').run();
  await db.prepare('DELETE FROM search_word_areas').run();
  await db.prepare('DELETE FROM search_word_facets').run();
 }
 const words=(await db.prepare('SELECT count(*) n FROM search_words').first())?.n??0;
 await writeState(db,{rowid,topId,revision:reachedEnd?revision:null,complete:true,counted:(state.counted??0)-gone.rows.length+cards,hasHits:hitsOk,words,at:new Date().toISOString()});
 return {cards,gone:gone.rows.length,words,revision,reachedEnd};
}
const insertWordsIgnore=(db,rows)=>{const out=[];for(let i=0;i<rows.length;i+=1500)out.push(db.prepare("INSERT OR IGNORE INTO search_words(word,cards) SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]') FROM json_each(?)").bind(JSON.stringify(rows.slice(i,i+1500))));return out;};

const SAFE=/^[a-z0-9]*[a-z][a-z0-9]*$/;
/** Begriffe, die sich so in der Wortliste wiederfinden würden: Buchstaben und Ziffern, ab 3 Zeichen, mit mindestens einem Buchstaben */
const searchable=terms=>terms.length>0&&terms.every(t=>t.length>=3&&SAFE.test(t));
const nextKey=t=>t.slice(0,-1)+String.fromCharCode(t.charCodeAt(t.length-1)+1);
const listCurrent=async db=>{const state=await readState(db);return !!state?.complete&&state.revision===await currentRevision(db);};

/**
 * Kann der Suchbegriff Treffer haben?
 * @param groups Alternativen (ODER) mit Wörtern (UND), wie parseMonitorSearch sie liefert
 * @param nameHit (term)=>boolean: steckt der Begriff in einem Gebietsnamen? (die Suche findet auch Gemeinden)
 * @param plain keine weiteren Filter (Gebiet, Thema, Status, Monat, Ort): nur dann ist „ja“ sicher
 * @returns {Promise<'yes'|'no'|'unknown'>} nein gilt nur, solange die Liste zum Datenstand passt
 */
export async function knownWords(db,groups,{nameHit=()=>false,plain=false}={}){
 const terms=[...new Set(groups.flat())];
 if(!searchable(terms))return 'unknown';
 try{
  const current=await listCurrent(db);
  const present=new Map();
  for(const t of terms){
   /* Wortanfang über den Index, sonst Teilwort durch Durchlesen der Liste */
   const inList=!!(await db.prepare('SELECT 1 x FROM search_words WHERE word>=? AND word<? LIMIT 1').bind(t,nextKey(t)).first())
    ||!!(await db.prepare('SELECT 1 x FROM search_words WHERE instr(word,?)>0 LIMIT 1').bind(t).first());
   present.set(t,{inList,name:!!nameHit(t)});
  }
  if(current&&!groups.some(g=>g.every(t=>present.get(t).inList||present.get(t).name)))return 'no';
  if(plain&&groups.length===1&&groups[0].length===1&&present.get(groups[0][0]).inList)return 'yes';
 }catch{/* Tabelle fehlt oder nicht lesbar: gesucht wird wie gewohnt */}
 return 'unknown';
}

/**
 * Karten-IDs, unter denen alle Treffer des Suchbegriffs liegen (ein Obermengen-Ergebnis: die Suche prüft sie mit den
 * üblichen Bedingungen nach), oder null, wenn die Liste dafür nicht reicht (Liste veraltet, Begriff zu häufig oder
 * zu allgemein, Gebiete des Namens zu groß) und wie gewohnt gesucht wird.
 * Je Begriff die Vereinigung der Karten aller Wörter, die ihn enthalten; je UND-Gruppe genügt der Begriff mit den wenigsten
 * Karten; über die ODER-Gruppen die Vereinigung.
 */
export async function candidateCards(db,groups,{nameIds=()=>[],exact=false}={}){
 const terms=[...new Set(groups.flat())];
 if(!groups.length||!searchable(terms))return null;
 try{
  if(!(await listCurrent(db)))return null;
  const byTerm=new Map();
  for(const t of terms){
   /* Exakter Begriff: nur das Wort selbst, nicht die Wörter, in denen er steckt */
   const {results:words}=exact?await db.prepare('SELECT word,cards FROM search_words WHERE word=?').bind(t).all():await db.prepare('SELECT word,cards FROM search_words WHERE instr(word,?)>0 LIMIT ?').bind(t,WORDS_PER_TERM_MAX+1).all();
   if(words.length>WORDS_PER_TERM_MAX||words.some(w=>w.cards>POSTING_MAX)){byTerm.set(t,null);continue;}
   const ids=new Set();
   /* Steckt der Begriff in einem Gebietsnamen, gehören auch alle Karten dieser Gebiete dazu (zu viele: wie gewohnt über alle suchen) */
   const named=nameIds(t);
   if(named.length){
    const {results:rows}=await db.prepare('SELECT id FROM search_cards WHERE region_id IN (SELECT value FROM json_each(?)) LIMIT ?').bind(JSON.stringify(named),CANDIDATE_MAX+1).all();
    if(rows.length>CANDIDATE_MAX){byTerm.set(t,null);continue;}
    for(const r of rows)ids.add(r.id);
   }
   if(!words.length){byTerm.set(t,[...ids]);continue;}
   for(let i=0;i<words.length;i+=1500){
    const {results:rows}=await db.prepare('SELECT card_id FROM search_postings WHERE word IN (SELECT value FROM json_each(?))').bind(JSON.stringify(words.slice(i,i+1500).map(w=>w.word))).all();
    for(const r of rows)ids.add(r.card_id);
   }
   byTerm.set(t,[...ids]);
  }
  const union=new Set();
  for(const g of groups){
   const lists=g.map(t=>byTerm.get(t)).filter(l=>l!==null);
   if(!lists.length)return null;
   for(const id of lists.reduce((a,b)=>b.length<a.length?b:a))union.add(id);
   if(union.size>CANDIDATE_MAX)return null;
  }
  return [...union];
 }catch{return null;}
}

/** Karten in Gebieten, deren Name den Begriff enthält, aber nicht den Begriff im Text: die Suche findet sie über den Gebietsnamen,
 *  die vorberechneten Zahlen (nur Text) kennen sie nicht. Je Gebiet, Thema und Status gezählt, nur Datum bis `to`. */
async function nameOnly(db,term,ids,to){
 if(!ids.length)return [];
 const {results}=await db.prepare('SELECT region_id,label,status,count(*) n FROM search_cards WHERE region_id IN (SELECT value FROM json_each(?))'+(to?' AND date<=?':'')+' AND instr(search,?)=0 GROUP BY region_id,label,status').bind(...[JSON.stringify(ids),...(to?[to]:[]),term]).all();
 return results;
}

/**
 * Genaue Trefferzahl der Suche nach genau einem häufigen Wort, sofort aus der Wortliste (sonst null: dann wird gezählt).
 * Gilt nur ohne weitere Filter, bei aktueller Liste und wenn der Begriff keinen Gebietsnamen trifft. Karten mit Datum nach
 * `to` (die Oberfläche setzt das heutige Datum) zählen nicht mit und werden abgezogen.
 * @param term der einzige Suchbegriff
 * @param level 'city' | 'district'; levelIds: Gebiets-IDs dieser Ebene; to: 'JJJJ-MM-TT' oder ''
 */
export async function precomputedTotal(db,term,{level='city',to='',levelIds=[],nameIds=()=>[]}={}){
 if(!searchable([term]))return null;
 try{
  const state=await readState(db);
  if(!state?.complete||!state.hasHits||state.revision!==await currentRevision(db))return null;
  const row=await db.prepare('SELECT hits_city,hits_district FROM search_words WHERE word=?').bind(term).first();
  const n=level==='district'?row?.hits_district:row?.hits_city;
  if(n==null)return null;
  const inLevel=new Set(levelIds),extra=(await nameOnly(db,term,nameIds(term).filter(id=>inLevel.has(id)),to)).reduce((a,r)=>a+r.n,0);
  if(!to)return n+extra;
  const later=(await db.prepare('SELECT count(*) n FROM search_cards INDEXED BY idx_search_cards_date WHERE date>? AND region_id IN (SELECT value FROM json_each(?)) AND instr(search,?)>0').bind(to,JSON.stringify(levelIds),term).first())?.n??0;
  return n-later+extra;
 }catch{return null;}
}

/**
 * Die Zahlen der Zählabfrage für genau ein häufiges Wort ohne weitere Filter, vorberechnet (sonst null: dann wird gezählt):
 * Trefferzahl je Gebiet (`regions`) und je Thema und Status (`facets`) auf der gewählten Ebene. Gilt nur bei aktueller Liste
 * und wenn der Begriff keinen Gebietsnamen trifft. Karten mit Datum nach `to` werden abgezogen.
 * @returns {Promise<{regions:Map<string,number>,facets:{label:string,status:string,n:number}[]}|null>}
 */
export async function precomputedFacets(db,term,{level='city',to='',levelIds=[],nameIds=()=>[]}={}){
 if(!searchable([term]))return null;
 try{
  const state=await readState(db);
  if(!state?.complete||!state.hasHits||state.revision!==await currentRevision(db))return null;
  const inLevel=new Set(levelIds);
  const {results:areaRows}=await db.prepare('SELECT region_id,n FROM search_word_areas WHERE word=?').bind(term).all();
  if(!areaRows.length)return null;
  const {results:facetRows}=await db.prepare('SELECT label,status,n FROM search_word_facets WHERE word=? AND kind=?').bind(term,level).all();
  const regions=new Map(areaRows.filter(r=>inLevel.has(r.region_id)).map(r=>[r.region_id,r.n]));
  const facets=new Map(facetRows.map(r=>[r.label+'|'+r.status,{label:r.label,status:r.status,n:r.n}]));
  if(to){
   const {results:later}=await db.prepare('SELECT region_id,label,status,count(*) n FROM search_cards INDEXED BY idx_search_cards_date WHERE date>? AND region_id IN (SELECT value FROM json_each(?)) AND instr(search,?)>0 GROUP BY region_id,label,status').bind(to,JSON.stringify(levelIds),term).all();
   for(const r of later){
    regions.set(r.region_id,(regions.get(r.region_id)||0)-r.n);
    const f=facets.get(r.label+'|'+r.status);if(f)f.n-=r.n;
   }
  }
  for(const r of await nameOnly(db,term,nameIds(term).filter(id=>inLevel.has(id)),to)){
   regions.set(r.region_id,(regions.get(r.region_id)||0)+r.n);
   const k=r.label+'|'+r.status,f=facets.get(k);if(f)f.n+=r.n;else facets.set(k,{label:r.label,status:r.status,n:r.n});
  }
  for(const [id,n] of regions)if(n<=0)regions.delete(id);
  return {regions,facets:[...facets.values()].filter(f=>f.n>0)};
 }catch{return null;}
}
