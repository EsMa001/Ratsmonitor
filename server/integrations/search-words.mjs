/*
 * Wortliste der Suche (Tabelle search_words, drizzle/0013): jedes Wort aus search_cards.search, ab 3 Zeichen.
 * Sie beantwortet vor dem Durchsuchen der Karten, ob ein Suchbegriff Treffer haben kann:
 *   ja      : der Begriff steckt in einem Wort der Liste, es gibt also sicher Karten dazu (nur ohne weitere Filter);
 *   nein    : kein Wort der Liste enthält ihn (und kein Gebietsname): es gibt keine Treffer. Gilt nur, solange die Liste
 *             zum Datenstand passt, sonst könnte ein neues Wort noch fehlen;
 *   unbekannt: alles andere, dann wird wie gewohnt gesucht.
 * Gepflegt wird sie schrittweise: refreshSearchWords liest nur Karten, die seit dem letzten Lauf neu oder geändert sind
 * (neue rowid; die Trigger schreiben search_cards mit INSERT OR REPLACE). Gelöschte oder geänderte Karten lassen Wörter
 * stehen, das schadet nur in der sicheren Richtung (ein Wort ohne Karte: „ja“ ohne Treffer). Ein voller Neuaufbau
 * (full:true) räumt das auf.
 */
const STATE_KEY='search-words';
const REVISION_SQL="SELECT coalesce((SELECT revision FROM data_revisions WHERE id='content'),0) revision";
/** Wörter eines Suchtexts (je Karte einmal): wie der Suchtext selbst gebildet, nur Buchstaben und Ziffern, ab 3 Zeichen, nicht nur Ziffern */
export function wordsOf(text){
 const found=new Set();
 for(const w of String(text).split(/[^a-z0-9]+/))if(w.length>=3&&!/^\d+$/.test(w))found.add(w);
 return found;
}
const readState=async db=>{try{const row=await db.prepare('SELECT value FROM system_state WHERE key=?').bind(STATE_KEY).first();return row?JSON.parse(row.value):null;}catch{return null;}};
const writeState=(db,state)=>db.prepare('INSERT OR REPLACE INTO system_state(key,value) VALUES(?,?)').bind(STATE_KEY,JSON.stringify(state)).run();

/**
 * Wortliste auf den Stand der Karten bringen. Ohne Angaben nur das Neue seit dem letzten Lauf.
 * @param {{prepare:Function,batch:Function}} db D1-Datenbank
 * @param {{full?:boolean,chunk?:number,onlyIfBuilt?:boolean,maxCards?:number}} options full: alles neu aufbauen;
 *   onlyIfBuilt: nur nachführen, nie den ersten Aufbau machen (für den Import im Worker); maxCards: höchstens so viele Karten
 *   je Lauf (der Rest folgt beim nächsten; bis dahin gilt die Liste als veraltet)
 */
export async function refreshSearchWords(db,{full=false,chunk=5000,onlyIfBuilt=false,maxCards=Infinity}={}){
 await db.prepare('CREATE TABLE IF NOT EXISTS search_words (word TEXT PRIMARY KEY NOT NULL) WITHOUT ROWID').run();
 /* Datenstand vor dem Lesen: ändert sich währenddessen etwas, passt die Liste danach noch nicht und gilt als veraltet */
 const revision=String((await db.prepare(REVISION_SQL).first())?.revision??0);
 let state=await readState(db);
 if(onlyIfBuilt&&!full&&!state?.complete)return {skipped:true};
 /* Steht an der zuletzt gelesenen rowid nicht mehr dieselbe Karte, wurden rowids frei und neu vergeben: neue Karten
    würden übersprungen, also alles neu */
 const same=state?.complete&&(state.rowid===0||(await db.prepare('SELECT id FROM search_cards WHERE rowid=?').bind(state.rowid).first())?.id===state.topId);
 if(full||!state||!state.complete||!same){
  state={rowid:0,revision:null,complete:false,words:0};
  await writeState(db,state);
  await db.prepare('DELETE FROM search_words').run();
 }
 let rowid=state.rowid,topId=state.topId??null,cards=0,reachedEnd=false;const seen=new Set();
 while(cards<maxCards){
  const {results}=await db.prepare('SELECT rowid r,id,search FROM search_cards WHERE rowid>? ORDER BY rowid LIMIT ?').bind(rowid,chunk).all();
  if(!results.length){reachedEnd=true;break;}
  const fresh=[];
  for(const row of results){
   rowid=row.r;topId=row.id;
   for(const w of wordsOf(row.search))if(!seen.has(w)){seen.add(w);fresh.push(w);}
  }
  cards+=results.length;
  /* D1 erlaubt höchstens 100 Parameter je Abfrage */
  const statements=[];
  for(let i=0;i<fresh.length;i+=99){const part=fresh.slice(i,i+99);statements.push(db.prepare('INSERT OR IGNORE INTO search_words(word) VALUES '+part.map(()=>'(?)').join(',')).bind(...part));}
  for(let i=0;i<statements.length;i+=50)await db.batch(statements.slice(i,i+50));
 }
 const words=(await db.prepare('SELECT count(*) n FROM search_words').first())?.n??0;
 await writeState(db,{rowid,topId,revision:reachedEnd?revision:null,complete:true,words,at:new Date().toISOString()});
 return {cards,words,revision,reachedEnd};
}

const SAFE=/^[a-z0-9]*[a-z][a-z0-9]*$/;
/**
 * Kann der Suchbegriff Treffer haben?
 * @param groups Alternativen (ODER) mit Wörtern (UND), wie parseMonitorSearch sie liefert
 * @param nameHit (term)=>boolean: steckt der Begriff in einem Gebietsnamen? (die Suche findet auch Gemeinden)
 * @param plain keine weiteren Filter (Gebiet, Thema, Status, Monat, Ort): nur dann ist „ja“ sicher
 * @returns {Promise<'yes'|'no'|'unknown'>}
 */
export async function knownWords(db,groups,{nameHit=()=>false,plain=false}={}){
 const terms=[...new Set(groups.flat())];
 /* Nur Begriffe, die sich so in der Wortliste wiederfinden würden: Buchstaben und Ziffern, ab 3 Zeichen, mit Buchstabe */
 if(!terms.length||terms.some(t=>t.length<3||!SAFE.test(t)))return 'unknown';
 try{
  const state=await readState(db);
  const revision=String((await db.prepare(REVISION_SQL).first())?.revision??0);
  const current=!!state?.complete&&state.revision===revision;
  const present=new Map();
  for(const t of terms){
   /* Wortanfang über den Index, sonst Teilwort durch Durchlesen der Liste */
   const next=t.slice(0,-1)+String.fromCharCode(t.charCodeAt(t.length-1)+1);
   const inList=!!(await db.prepare('SELECT 1 x FROM search_words WHERE word>=? AND word<? LIMIT 1').bind(t,next).first())
    ||!!(await db.prepare('SELECT 1 x FROM search_words WHERE instr(word,?)>0 LIMIT 1').bind(t).first());
   present.set(t,{inList,name:!!nameHit(t)});
  }
  if(current&&!groups.some(g=>g.every(t=>present.get(t).inList||present.get(t).name)))return 'no';
  if(plain&&groups.length===1&&groups[0].length===1&&present.get(groups[0][0]).inList)return 'yes';
 }catch{/* Tabelle fehlt oder nicht lesbar: gesucht wird wie gewohnt */}
 return 'unknown';
}
