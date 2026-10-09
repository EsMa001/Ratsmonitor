import {extrahiereMitRegel,AUSZUG_METHOD,AUSZUG_LABEL,AUSZUG_NOTICE} from '../../shared/ris-auszug.mjs';
import {excerptBasis} from '../../shared/article-record.mjs';
import {pickPdf} from './pdf-pick.mjs';
// Der PDF-Leser (unpdf) wird erst beim ersten echten Abruf geladen.
const readDocument=async url=>(await import('./documents.mjs')).readDocument(url);
import {invalidateReads} from '../services/read-cache.mjs';
export const EXCERPT_FETCHES=8,EXCERPT_SCAN=40,EXCERPT_BUDGET_MS=25000,EXCERPT_RETRY_MS=24*3600*1000;
const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(v=>v.toString(16).padStart(2,'0')).join('');
const words=s=>s.split(/\s+/).filter(Boolean);
/** Kurzfassung = der erste ausgewählte Satz (höchstens 65 Wörter wie bei den anderen Zusammenfassungen). */
export const excerptShort=sentence=>{const w=words(sentence);return w.length<=65?sentence:w.slice(0,65).join(' ')+' …';};
/** Bereits gespeicherter Auszug oder Fehlversuch, der nicht erneut versucht werden muss. */
export const excerptCurrent=(t,now=Date.now())=>{const e=t.ruleExcerpt;if(!e||e.method!==AUSZUG_METHOD||e.basis!==excerptBasis(t))return false;
 return e.status!=='failed'||now-Date.parse(e.generatedAt||0)<EXCERPT_RETRY_MS;};
/** Kein Auszug für Vorgänge mit KI-Zusammenfassung: diese bleiben unverändert. */
export const hasAiSummary=t=>/^KI-Zusammenfassung/.test(t.generatedBy||'')||t.contentAnalysis?.status==='completed';
/**
 * Berechnet den Auszug eines Vorgangs. reader liest den Text eines Dokuments (nur im Arbeitsspeicher).
 * Gibt {excerpt, fetched} zurück; excerpt.status: completed | no_sentences | no_text | failed.
 */
export async function buildExcerpt(t,at,reader=readDocument){
 const basis=excerptBasis(t),base={method:AUSZUG_METHOD,generatedAt:at,basis};
 let text='',source='',fetched=false;
 if(t.hasDocumentText&&t.sourceText){text=t.sourceText;source=t.documentSource||t.sourceUrl||'';}
 else{
  const d=pickPdf(t);if(!d)return {excerpt:{...base,status:'no_text',reason:'Kein PDF-Dokument vorhanden.'},fetched};
  try{fetched=true;text=await reader(d.url);source=d.url;}catch(e){return {excerpt:{...base,status:'failed',reason:String(e?.message||'Dokument nicht lesbar').slice(0,200),source:d.url},fetched};}
  if(text.trim().length<100)return {excerpt:{...base,status:'no_text',reason:'Das Dokument enthält keinen ausreichend lesbaren Text.',source},fetched};
 }
 const {typ,saetze}=extrahiereMitRegel(text);
 return {excerpt:{...base,status:saetze.length?'completed':'no_sentences',source,inputHash:await hash(text),typ,sentences:saetze,...(saetze.length?{}:{reason:'Keine Sätze nach den Regeln erkannt.'})},fetched};
}
/**
 * Ein Paket des Admin-Auftrags „Regelbasierter Auszug“: liest bei Vorgängen eines Gebiets ohne KI-Zusammenfassung die
 * Originalunterlage (nur im Arbeitsspeicher, nichts davon wird gespeichert) und legt bis zu fünf Originalsätze ab.
 * Gespeichert werden nur die Sätze mit Regel, Quelle und Prüfsumme; Kurz- und Langfassung des Vorgangs zeigen den Auszug
 * und den Hinweis, dass es keine KI-Zusammenfassung ist. KI-Zusammenfassungen werden nie überschrieben.
 * after: Cursor (letzte gelesene id). Nur der angemeldete Admin-POST ruft das auf; Import und Lesen starten es nie.
 */
export async function excerptPending(db,region,{after='',reader=readDocument,now=()=>Date.now()}={}){
 if(!db)return {status:503,data:{error:'Datenbank fehlt.'}};
 const started=new Date(now()).toISOString(),runId=crypto.randomUUID(),lease=String(now()+600000),begin=now();
 const lock=await db.prepare("INSERT INTO system_state(key,value) VALUES('import-lock',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(system_state.value AS INTEGER) < ? RETURNING value").bind(lease,now()).first();
 if(!lock)return {status:409,data:{error:'Ein Import oder eine Analyse läuft bereits. Bitte später erneut starten.'}};
 const counts={completed:0,noText:0,failed:0,skipped:0};let cursor=typeof after==='string'?after:'',fetches=0,more=false;
 try{
  await db.prepare('INSERT INTO import_runs(id,started_at,status,details) VALUES(?,?,?,?)').bind(runId,started,'running',JSON.stringify({mode:'rule-excerpt',region,trigger:'manual',...(cursor?{after:cursor}:{})})).run();
  // Vorauswahl im SQL: keine KI-Zusammenfassung, kein aktueller Auszug, ein PDF-Dokument. Genau geprüft wird danach.
  const rows=await db.prepare(`SELECT id,payload FROM topics WHERE region_id=? AND json_extract(payload,'$.identity.mergedInto') IS NULL AND coalesce(json_extract(payload,'$.generatedBy'),'') NOT LIKE 'KI-Zusammenfassung%' AND coalesce(json_extract(payload,'$.contentAnalysis.status'),'')<>'completed' AND (coalesce(json_extract(payload,'$.ruleExcerpt.method'),'')<>? OR json_extract(payload,'$.ruleExcerpt.status')='failed') AND payload LIKE '%application/pdf%' AND id>? ORDER BY id LIMIT ?`).bind(region,AUSZUG_METHOD,cursor,EXCERPT_SCAN+1).all();
  more=rows.results.length>EXCERPT_SCAN;
  const list=rows.results.slice(0,EXCERPT_SCAN);
  for(const row of list){
   if(fetches>=EXCERPT_FETCHES||now()-begin>EXCERPT_BUDGET_MS){more=true;break;}
   cursor=row.id;
   const t=JSON.parse(row.payload);
   if(hasAiSummary(t)||excerptCurrent(t,now())||!pickPdf(t)&&!(t.hasDocumentText&&t.sourceText)){counts.skipped++;continue;}
   const {excerpt,fetched}=await buildExcerpt(t,started,reader);
   if(fetched)fetches++;
   const ok=excerpt.status==='completed',replaced={shortSummary:t.shortSummary,longSummary:t.longSummary,generatedBy:t.generatedBy};
   const analysis={id:`rule-excerpt:${t.id}:${excerpt.basis.slice(0,16)}`,kind:'rule-excerpt',...(ok?{replaced}:{})};
   const set=ok
    ?db.prepare("UPDATE topics SET payload=json_set(payload,'$.ruleExcerpt',json(?),'$.shortSummary',?,'$.longSummary',json(?),'$.generatedBy',?,'$.summaryMethod',?) WHERE id=? AND coalesce(json_extract(payload,'$.generatedBy'),'') NOT LIKE 'KI-Zusammenfassung%'").bind(JSON.stringify(excerpt),excerptShort(excerpt.sentences[0].satz),JSON.stringify([...excerpt.sentences.map(s=>s.satz),AUSZUG_NOTICE]),AUSZUG_LABEL,AUSZUG_METHOD,t.id)
    :db.prepare("UPDATE topics SET payload=json_set(payload,'$.ruleExcerpt',json(?)) WHERE id=?").bind(JSON.stringify(excerpt),t.id);
   await db.batch([set,db.prepare('INSERT OR IGNORE INTO article_analyses(id,topic_id,kind,method,input_hash,created_at,payload) VALUES(?,?,?,?,?,?,?)').bind(analysis.id,t.id,'rule-excerpt',AUSZUG_METHOD,excerpt.inputHash||excerpt.basis,started,JSON.stringify({...excerpt,...(ok?{replaced}:{})}))]);
   if(ok)counts.completed++;else if(excerpt.status==='failed')counts.failed++;else counts.noText++;
  }
  if(!more&&list.length)cursor=list.at(-1).id;
  const data={...counts,more,cursor,limit:EXCERPT_FETCHES};
  await db.prepare('UPDATE import_runs SET finished_at=?,status=?,details=json_patch(details,?) WHERE id=?').bind(new Date(now()).toISOString(),'completed',JSON.stringify(data),runId).run();
  return {status:200,data};
 }catch(e){
  await db.prepare('UPDATE import_runs SET finished_at=?,status=?,details=json_patch(details,?) WHERE id=?').bind(new Date(now()).toISOString(),'failed',JSON.stringify({...counts,error:String(e?.message||e).slice(0,200)}),runId).run();
  return {status:503,data:{error:'Auszug nicht vollständig abgeschlossen. Gespeicherte Ergebnisse bleiben erhalten; ein erneuter Start setzt fort.',...counts}};
 }finally{invalidateReads();await db.prepare("DELETE FROM system_state WHERE key='import-lock' AND value=?").bind(lease).run();}
}
