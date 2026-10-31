/**
 * Tippfehler in der Suche: „wrmeplsnung“ → „Wärmeplanung“.
 *
 * Grundlage ist die Wortliste der Suche (search_words, search-words.mjs): jedes Wort aus Titel, Kurztext und Gremium mit seiner
 * Kartenzahl. Daneben steht ein Register der Wörter als Trigram-Index (search_suggest_words + FTS5 search_suggest_trg, dazu
 * fts5vocab für die Häufigkeit jedes Trigramms). Beides wird zur Laufzeit angelegt (keine Migration) und von syncSuggestIndex
 * in Stücken gefüllt bzw. nachgeführt: beim Start des Node-Servers (serve.mjs über /api/internal/search-suggest) und nachts im
 * Skript refresh-search-words.mjs. Fehlt das Register, gibt es keine Vorschläge, die Suche läuft wie gewohnt.
 *
 * Vorschlag: nur für Wörter aus Buchstaben ab 4 Zeichen, die in der Wortliste fehlen. Die seltensten Trigramme des Begriffs
 * (Budget TRIGRAM_BUDGET Register-Zeilen) liefern die Kandidaten, die Editierdistanz (Damerau-Levenshtein, Grenze nach Länge)
 * wählt aus, bei gleicher Distanz gewinnt die größere Kartenzahl. Die Schreibweise mit Umlauten und Großbuchstaben kommt aus
 * einer Suchkarte, die das Wort enthält (search_cards.title/teaser/gremium).
 *
 * Die Korrektur ändert nie die Suche selbst: die Oberfläche zeigt nur „Meinten Sie …?“ (ResultsPanel.tsx), der Nutzer entscheidet.
 */
import {norm} from './x-terms.mjs';

export const SUGGEST_VERSION='suggest-v1';
const STATE_KEY='search-suggest',LEASE_KEY='search-suggest-lease',LEASE_MS=10*60e3;
/** Wörter ab so vielen Karten kommen ins Register (Einzelfälle sind meist selbst Tippfehler) */
export const MIN_CARDS=2;
/** Wörter je Stück beim Füllen; zwischen den Stücken kommt der Server zu Wort */
export const CHUNK=20000;
/** Höchstens so viele Register-Zeilen lesen die gewählten Trigramme zusammen */
export const TRIGRAM_BUDGET=20000;
const TERM=/^[a-z]{4,}$/;

const SCHEMA=[
 'CREATE TABLE IF NOT EXISTS search_suggest_words (id INTEGER PRIMARY KEY, word TEXT NOT NULL UNIQUE)',
 "CREATE VIRTUAL TABLE IF NOT EXISTS search_suggest_trg USING fts5(word, content='search_suggest_words', content_rowid='id', tokenize='trigram')",
 "CREATE VIRTUAL TABLE IF NOT EXISTS search_suggest_vocab USING fts5vocab('search_suggest_trg','row')",
];
const readState=async db=>{try{const row=await db.prepare('SELECT value FROM system_state WHERE key=?').bind(STATE_KEY).first();return row?JSON.parse(row.value):null;}catch{return null;}};
const writeState=(db,state)=>db.prepare('INSERT OR REPLACE INTO system_state(key,value) VALUES(?,?)').bind(STATE_KEY,JSON.stringify(state)).run();

/** Gibt es die Wortliste? Ohne sie gibt es nichts zu registrieren und nichts vorzuschlagen */
async function hasWords(db){try{await db.prepare('SELECT cards FROM search_words LIMIT 0').all();return true;}catch{return false;}}
/** Gibt es das Register (angelegt, nicht unbedingt voll)? Vorhanden wird gemerkt, fehlend nur eine Minute */
const registers=new WeakMap();
async function hasRegister(db){
 const known=registers.get(db);
 if(known&&(known.present||Date.now()-known.at<60000))return known.present;
 let present=false;
 try{await db.prepare('SELECT term FROM search_suggest_vocab LIMIT 0').all();present=true;}catch{/* Register fehlt */}
 registers.set(db,{present,at:Date.now()});
 return present;
}

/**
 * Register anlegen und in Stücken aus der Wortliste füllen. Jeder Aufruf macht ab dem gemerkten Wort weiter und hört bei
 * deadline (Zeitstempel) auf; done:true, wenn die Wortliste einmal ganz durchlaufen ist (dann beginnt der nächste Lauf vorn).
 * Mehrfach aufrufbar: INSERT OR IGNORE, der Trigram-Index bekommt nur neue Zeilen. Unter einer Sperre in system_state.
 */
export async function syncSuggestIndex(db,{deadline=Infinity,chunk=CHUNK}={}){
 if(!await hasWords(db))return {skipped:true,reason:'keine Wortliste'};
 let state=await readState(db);
 /* Sperre: ein zweiter Lauf (Start und Nachtlauf zugleich) lässt aus */
 const now=Date.now(),lease=await db.prepare('SELECT value FROM system_state WHERE key=?').bind(LEASE_KEY).first().catch(()=>null);
 if(lease&&now-Number(lease.value)<LEASE_MS)return {skipped:true,busy:true};
 await db.prepare('INSERT OR REPLACE INTO system_state(key,value) VALUES(?,?)').bind(LEASE_KEY,String(now)).run();
 try{
  for(const sql of SCHEMA)await db.prepare(sql).run();
  registers.delete(db);
  let after=state?.version===SUGGEST_VERSION&&typeof state.after==='string'?state.after:'',added=0,words=0,done=false;
  while(true){
   const rows=(await db.prepare('SELECT word FROM search_words WHERE cards>=? AND word>? ORDER BY word LIMIT ?').bind(MIN_CARDS,after,chunk).all()).results;
   if(!rows.length){done=true;after='';break;}
   const last=rows[rows.length-1].word;
   const top=Number((await db.prepare('SELECT coalesce(max(id),0) m FROM search_suggest_words').first())?.m??0);
   await db.prepare('INSERT OR IGNORE INTO search_suggest_words(word) SELECT word FROM search_words WHERE cards>=? AND word>? AND word<=? ORDER BY word').bind(MIN_CARDS,after,last).run();
   await db.prepare('INSERT INTO search_suggest_trg(rowid,word) SELECT id,word FROM search_suggest_words WHERE id>? ORDER BY id').bind(top).run();
   const now2=Number((await db.prepare('SELECT coalesce(max(id),0) m FROM search_suggest_words').first())?.m??0);
   added+=now2-top;words+=rows.length;after=last;
   await writeState(db,{version:SUGGEST_VERSION,after,at:new Date().toISOString()});
   if(Date.now()>deadline)break;
  }
  await writeState(db,{version:SUGGEST_VERSION,after,at:new Date().toISOString(),...(done?{done:new Date().toISOString()}:{})});
  return {done,added,words};
 }
 finally{await db.prepare('DELETE FROM system_state WHERE key=?').bind(LEASE_KEY).run();}
}

/** Trigramme eines Worts, wie der FTS5-Tokenizer sie bildet (ohne Ränder) */
export function trigrams(word){const out=[];for(let i=0;i+3<=word.length;i++)out.push(word.slice(i,i+3));return [...new Set(out)];}

/** Damerau-Levenshtein (Vertauschung zählt einmal), bricht über max ab (Ergebnis dann max+1) */
export function editDistance(a,b,max){
 if(Math.abs(a.length-b.length)>max)return max+1;
 const d=[];for(let i=0;i<=a.length;i++)d[i]=[i];for(let j=0;j<=b.length;j++)d[0][j]=j;
 for(let i=1;i<=a.length;i++){
  let best=Infinity;
  for(let j=1;j<=b.length;j++){
   const c=a[i-1]===b[j-1]?0:1;let v=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+c);
   if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])v=Math.min(v,d[i-2][j-2]+1);
   d[i][j]=v;if(v<best)best=v;
  }
  if(best>max)return max+1;
 }
 return d[a.length][b.length];
}
/** Erlaubte Distanz nach Länge: kurze Wörter nur ein Fehler */
export const maxDistance=word=>word.length<=5?1:word.length<=9?2:3;

/**
 * Bestes Wort der Wortliste zu einem gefalteten Begriff (a–z), null wenn er vorkommt oder nichts nahe genug liegt.
 * Liefert {word,cards,distance} mit dem gefalteten Wort.
 */
export async function suggestWord(db,term){
 if(!TERM.test(term)||!await hasRegister(db))return null;
 const own=await db.prepare('SELECT cards FROM search_words WHERE word=?').bind(term).first();
 if(own&&own.cards>0)return null;
 /* Seltenste Trigramme zuerst, bis das Budget an Zeilen erreicht ist: so bleibt die Kandidatenliste klein */
 const grams=trigrams(term);
 if(!grams.length)return null;
 const counts=(await db.prepare(`SELECT term,doc FROM search_suggest_vocab WHERE term IN (${grams.map(()=>'?').join(',')})`).bind(...grams).all()).results;
 const known=new Map(counts.map(r=>[r.term,Number(r.doc)]));
 const sorted=grams.filter(g=>known.has(g)).sort((a,b)=>known.get(a)-known.get(b));
 const chosen=[];let budget=TRIGRAM_BUDGET;
 for(const g of sorted){if(chosen.length>=2&&known.get(g)>budget)break;chosen.push(g);budget-=known.get(g);if(chosen.length>=8)break;}
 if(!chosen.length)return null;
 const match=chosen.map(g=>`"${g}"`).join(' OR ');
 const rows=(await db.prepare('SELECT t.word word,w.cards cards FROM search_suggest_trg t JOIN search_words w ON w.word=t.word WHERE search_suggest_trg MATCH ? LIMIT ?').bind(match,TRIGRAM_BUDGET*2).all()).results;
 const max=maxDistance(term);
 let best=null;
 for(const r of rows){
  if(!(r.cards>=MIN_CARDS))continue;
  const d=editDistance(term,r.word,max);
  if(d>max)continue;
  if(!best||d<best.distance||(d===best.distance&&r.cards>best.cards))best={word:r.word,cards:Number(r.cards),distance:d};
 }
 return best;
}

const ftsTables=new WeakMap();
async function ftsTable(db){
 const known=ftsTables.get(db);
 if(known&&(known.present||Date.now()-known.at<60000))return known.present;
 let present=false;
 try{await db.prepare('SELECT rowid FROM search_fts LIMIT 0').all();present=true;}catch{/* kein Index */}
 ftsTables.set(db,{present,at:Date.now()});
 return present;
}
/** Schreibweise eines gefalteten Worts aus einer Suchkarte (häufigste Form in bis zu 20 Karten); sonst mit großem Anfangsbuchstaben */
export async function displayForm(db,word){
 const fallback=word.charAt(0).toUpperCase()+word.slice(1);
 let rows=[];
 try{
  rows=(await (await ftsTable(db)
   ?db.prepare('SELECT title,teaser,gremium FROM search_cards WHERE rowid IN (SELECT rowid FROM search_fts WHERE search LIKE ? LIMIT 20)').bind('%'+word+'%')
   :db.prepare('SELECT title,teaser,gremium FROM search_cards WHERE search LIKE ? LIMIT 20').bind('%'+word+'%')).all()).results;
 }catch{return fallback;}
 const forms=new Map();
 for(const r of rows)for(const field of [r.title,r.teaser,r.gremium])for(const raw of String(field??'').split(/[^\p{L}\p{N}]+/u)){
  if(raw.length<word.length||norm(raw)!==word)continue;
  forms.set(raw,(forms.get(raw)??0)+1);
 }
 if(!forms.size)return fallback;
 return [...forms.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0][0];
}

const FILLER=new Set(['und','oder','der','die','das','den','dem','des','ein','eine','einer','in','im','am','an','zu','zum','zur','von','vom','fur','mit','bei','auf','aus','nach']);
/**
 * Vorschläge für einen Suchtext: je unbekanntem Wort eine Ersetzung {from (wie getippt), to (Schreibweise aus den Karten)}.
 * Dieselbe Zerlegung wie parseMonitorSearch (Gruppen durch Komma, Semikolon, | und „oder“; Füllwörter ausgelassen).
 */
export async function suggestQuery(db,q,{max=3}={}){
 const out=[],seen=new Set();
 if(typeof q!=='string'||q.length>200)return out;
 for(const group of q.split(/[,;|]|\s+oder\s+/i))for(const raw of group.split(/\s+/)){
  const clean=raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'');
  if(!clean)continue;
  const term=norm(clean);
  if(seen.has(term)||FILLER.has(term)||!TERM.test(term))continue;
  seen.add(term);
  const best=await suggestWord(db,term);
  if(!best)continue;
  out.push({from:clean,to:await displayForm(db,best.word),cards:best.cards});
  if(out.length>=max)break;
 }
 return out;
}
