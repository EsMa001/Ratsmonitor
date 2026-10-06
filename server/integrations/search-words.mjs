/*
 * Wortliste der Suche (Tabellen search_words und search_postings, drizzle/0013).
 *
 * search_words    jedes Wort aus search_cards.search (ab 3 Zeichen) mit der Zahl seiner Karten; TOO_COMMON (201) heißt
 *                 „mehr als 200 Karten“, dann gibt es keine Karten-IDs.
 * search_postings zu jedem Wort mit höchstens 200 Karten die IDs dieser Karten.
 *
 * Damit beantwortet die Suche vor dem Durchsuchen aller Karten:
 *   knownWords      kann der Begriff Treffer haben? ja / nein / unbekannt (siehe dort);
 *   candidateCards  welche Karten kommen für den Begriff in Frage? Für seltene Wörter ist das die vollständige Liste (die
 *                   Suche prüft sie mit denselben Bedingungen wie sonst nach), für häufige gibt es keine Liste.
 *
 * Gepflegt wird sie nach Importen: refreshSearchWords liest nur Karten, die seit dem letzten Lauf neu oder geändert sind (neue
 * rowid; die Trigger schreiben search_cards mit INSERT OR REPLACE). Gelöschte oder geänderte Karten lassen Wörter und IDs
 * stehen, das schadet nicht: die Suche prüft jede Karte aus der Liste erneut. Ein voller Neuaufbau (full:true) räumt auf.
 */
const STATE_KEY='search-words';
const REVISION_SQL="SELECT coalesce((SELECT revision FROM data_revisions WHERE id='content'),0) revision";
/** Wörter mit höchstens so vielen Karten bekommen Karten-IDs */
export const POSTING_MAX=200;
/** Zählstand für „zu häufig“ */
export const TOO_COMMON=POSTING_MAX+1;
/** Mehr Kandidaten als hier lohnen sich nicht: dann wird wie gewohnt gesucht */
export const CANDIDATE_MAX=3000;
const WORDS_PER_TERM_MAX=300;

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
 'CREATE TABLE IF NOT EXISTS search_words (word TEXT PRIMARY KEY NOT NULL, cards INTEGER NOT NULL DEFAULT 0) WITHOUT ROWID',
 'CREATE TABLE IF NOT EXISTS search_postings (word TEXT NOT NULL, card_id TEXT NOT NULL, PRIMARY KEY (word,card_id)) WITHOUT ROWID',
];
const ensureSchema=async db=>{for(const sql of SCHEMA)await db.prepare(sql).run();};
/** Ältere Fassung der Tabelle (ohne Zählspalte): dann muss neu aufgebaut werden */
const schemaOk=async db=>{try{await db.prepare('SELECT cards FROM search_words LIMIT 1').first();await db.prepare('SELECT card_id FROM search_postings LIMIT 1').first();return true;}catch{return false;}};
/** D1 erlaubt höchstens 100 Parameter und 100 KB je gebundenem Wert: Daten als JSON-Liste in einem Wert */
const runBatches=async(db,statements)=>{for(let i=0;i<statements.length;i+=20)await db.batch(statements.slice(i,i+20));};
const insertWords=(db,rows)=>{const out=[];for(let i=0;i<rows.length;i+=1500)out.push(db.prepare("INSERT OR REPLACE INTO search_words(word,cards) SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]') FROM json_each(?)").bind(JSON.stringify(rows.slice(i,i+1500))));return out;};
const insertPostings=(db,pairs)=>{const out=[];for(let i=0;i<pairs.length;i+=1500)out.push(db.prepare("INSERT OR IGNORE INTO search_postings(word,card_id) SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]') FROM json_each(?)").bind(JSON.stringify(pairs.slice(i,i+1500))));return out;};

/**
 * Wortliste auf den Stand der Karten bringen. Ohne Angaben nur das Neue seit dem letzten Lauf.
 * @param {{prepare:Function,batch:Function}} db D1-Datenbank
 * @param {{full?:boolean,chunk?:number,onlyIfBuilt?:boolean,maxCards?:number}} options full: alles neu aufbauen;
 *   onlyIfBuilt: nur nachführen, nie den ersten Aufbau machen (für den Import im Worker); maxCards: höchstens so viele Karten
 *   je Lauf (der Rest folgt beim nächsten; bis dahin gilt die Liste als veraltet)
 */
export async function refreshSearchWords(db,{full=false,chunk=5000,onlyIfBuilt=false,maxCards=Infinity}={}){
 await ensureSchema(db);
 const state=await readState(db);
 if(onlyIfBuilt&&!full&&!state?.complete)return {skipped:true};
 /* Datenstand vor dem Lesen: ändert sich währenddessen etwas, passt die Liste danach nicht mehr und gilt als veraltet */
 const revision=await currentRevision(db);
 /* Steht an der zuletzt gelesenen rowid nicht mehr dieselbe Karte, wurden rowids neu vergeben: neue Karten würden
    übersprungen, also alles neu */
 const same=state?.complete&&(state.rowid===0||(await db.prepare('SELECT id FROM search_cards WHERE rowid=?').bind(state.rowid).first())?.id===state.topId);
 if(full||!state?.complete||!same||!(await schemaOk(db)))return buildAll(db,revision,chunk);
 return refreshNew(db,state,revision,chunk,maxCards);
}

/** Voller Aufbau in einem Durchlauf: zählt alle Wörter, behält die IDs der seltenen */
async function buildAll(db,revision,chunk){
 await writeState(db,{rowid:0,topId:null,revision:null,complete:false,words:0});
 await db.prepare('DROP TABLE IF EXISTS search_postings').run();
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
    else if(ids!==null){if(ids.length>=POSTING_MAX)map.set(w,null);else ids.push(row.id);}
   }
  }
  cards+=results.length;
 }
 const words=[],pairs=[];
 for(const [w,ids] of map){words.push([w,ids?ids.length:TOO_COMMON]);if(ids)for(const id of ids)pairs.push([w,id]);}
 await runBatches(db,insertWords(db,words));
 await runBatches(db,insertPostings(db,pairs));
 await writeState(db,{rowid,topId,revision,complete:true,words:words.length,postings:pairs.length,at:new Date().toISOString()});
 return {cards,words:words.length,postings:pairs.length,revision,full:true,reachedEnd:true};
}

/** Nur Karten seit dem letzten Lauf: neue Wörter anlegen, IDs der seltenen ergänzen, Wörter über 200 Karten kappen */
async function refreshNew(db,state,revision,chunk,maxCards){
 let rowid=state.rowid,topId=state.topId??null,cards=0,reachedEnd=false;
 while(cards<maxCards){
  const {results}=await db.prepare('SELECT rowid r,id,search FROM search_cards WHERE rowid>? ORDER BY rowid LIMIT ?').bind(rowid,chunk).all();
  if(!results.length){reachedEnd=true;break;}
  const pending=new Map();
  for(const row of results){
   rowid=row.r;topId=row.id;
   for(const w of wordsOf(row.search)){const list=pending.get(w);if(list)list.push(row.id);else pending.set(w,[row.id]);}
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
   if(ids.length>POSTING_MAX){capped.push(w);continue;}
   touched.push(w);for(const id of ids)pairs.push([w,id]);
  }
  const statements=[...insertWordsIgnore(db,fresh),...insertPostings(db,pairs)];
  for(let i=0;i<touched.length;i+=1500){
   const json=JSON.stringify(touched.slice(i,i+1500));
   statements.push(db.prepare('UPDATE search_words SET cards=(SELECT count(*) FROM search_postings p WHERE p.word=search_words.word) WHERE word IN (SELECT value FROM json_each(?))').bind(json));
  }
  await runBatches(db,statements);
  /* Wörter, die jetzt über 200 Karten haben, verlieren ihre IDs */
  const over=[...capped];
  for(let i=0;i<touched.length;i+=1500){
   const {results:rows}=await db.prepare('SELECT word FROM search_words WHERE cards>? AND word IN (SELECT value FROM json_each(?))').bind(POSTING_MAX,JSON.stringify(touched.slice(i,i+1500))).all();
   for(const r of rows)over.push(r.word);
  }
  const cleanup=[];
  for(let i=0;i<over.length;i+=1500){
   const json=JSON.stringify(over.slice(i,i+1500));
   cleanup.push(db.prepare('DELETE FROM search_postings WHERE word IN (SELECT value FROM json_each(?))').bind(json));
   cleanup.push(db.prepare('UPDATE search_words SET cards=? WHERE word IN (SELECT value FROM json_each(?))').bind(TOO_COMMON,json));
  }
  await runBatches(db,cleanup);
 }
 const words=(await db.prepare('SELECT count(*) n FROM search_words').first())?.n??0;
 await writeState(db,{rowid,topId,revision:reachedEnd?revision:null,complete:true,words,at:new Date().toISOString()});
 return {cards,words,revision,reachedEnd};
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
 * zu allgemein, Gebietsname) und wie gewohnt gesucht wird.
 * Je Begriff die Vereinigung der Karten aller Wörter, die ihn enthalten; je UND-Gruppe genügt der Begriff mit den wenigsten
 * Karten; über die ODER-Gruppen die Vereinigung.
 */
export async function candidateCards(db,groups,{nameHit=()=>false}={}){
 const terms=[...new Set(groups.flat())];
 if(!groups.length||!searchable(terms))return null;
 try{
  if(!(await listCurrent(db)))return null;
  const byTerm=new Map();
  for(const t of terms){
   if(nameHit(t)){byTerm.set(t,null);continue;}
   const {results:words}=await db.prepare('SELECT word,cards FROM search_words WHERE instr(word,?)>0 LIMIT ?').bind(t,WORDS_PER_TERM_MAX+1).all();
   if(words.length>WORDS_PER_TERM_MAX||words.some(w=>w.cards>POSTING_MAX)){byTerm.set(t,null);continue;}
   if(!words.length){byTerm.set(t,[]);continue;}
   const ids=new Set();
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
