// Pure decisions for atlas evidence. A category is inferred only for a reason
// without a saved category; resolveEvidence never rewrites a saved record.
const LEGACY_CATEGORIES=[
 ['ready',/Prüflauf vom Rechner des Projektinhabers ausstehend/],
 ['special',/^Stadtstaat/],
 ['shared',/Mitbenutztes System|nicht eindeutig|mehreren Gebieten|Demo-Mandanten|Mehrere Körperschaften/],
 ['robots',/robots\.txt/],
 ['blocked',/HTTP 403|Web-Firewall|Zugriffsprüfung|Zugriffsschutz/],
 ['website',/Sitzungen nur als Webseite oder PDF|Vorlese-, Teilen-/],
 ['nolink',/kein Link|Keine offizielle Website|antwortet Programmen nicht|Link auf der Website gefunden, noch nicht geprüft/i],
 ['noreader',/^ALLRIS 3|Kein unterstütztes|^SessionNet 6$|^KIC-RIS$|komfa|ohne erreichbare OParl|noch kein Leser/],
 ['readfail',/lieferte keine|keine verwertbaren|zu viele Zugriffe|Wartungsarbeiten|erwähnt|nicht erreichbar|antwortet Programmen mit HTTP|Vorlagenliste|HTTP 404|abgebrochen/],
];
// These specific newer diagnoses take precedence over a generic legacy phrase
// in their explanation (for example "Gemeinsames System ... HTTP 403").
const NEW_CATEGORIES=[
 ['shared',/^Gemeinsames System\b/],
 ['website',/Sitzungsunterlagen nur auf der Gemeinde-Website|Sitzungstermine oder Unterlagen stehen nur als Webseite oder PDF|Sitzungsbekanntmachungen oder Unterlagen auf der Gemeinde-Website|Website der Gemeinde geprüft, keine Sitzungsseite|Website der Gemeinde zurzeit nicht abrufbar|Öffentliche Dokumentablage|Link gespeichert .*kein lesbares System erkannt|Ratsinformationsmodul der Website .*Protokolle als PDF|Sitzungsdienst erst nach Cookie-Einwilligung|Einladungen und Vorlagen als Download auf der Gemeinde-Website/i],
 ['nolink',/Website und Rathausseiten durchsucht .*kein öffentliches Ratsinformationssystem gefunden/i],
 ['noreader',/System öffentlich erreichbar, aber ohne passenden Leser|Eigenes Ratsinformationssystem .*kein Leser|^Nur über http erreichbar, https scheitert/i],
];
const NEW_BLOCK=/HTTP 401(?:\/|\b)|Anmeldepflicht|Nur für angemeldete Mitglieder|passwortgeschützt|Nur der Anmeldebereich|OParl-Schnittstelle unter Genehmigungsvorbehalt|Betreiber wies Programme .*wiederholt ab/i;

/** Infer a category for a new reason; callers must retain an existing saved c/category. */
export function categoryOf(reason){
 const value=String(reason??'');
 const newer=NEW_CATEGORIES.find(([,pattern])=>pattern.test(value));if(newer)return newer[0];
 // Existing ready/special/shared/robots precedence is retained even where a
 // legacy explanation also mentions a refusal.
 const leading=LEGACY_CATEGORIES.slice(0,4).find(([,pattern])=>pattern.test(value));if(leading)return leading[0];
 if(NEW_BLOCK.test(value))return 'blocked';
 return LEGACY_CATEGORIES.slice(4).find(([,pattern])=>pattern.test(value))?.[0]||'other';
}

const DATE=/\b(?:\d{1,2}\.\d{1,2}\.\d{4}|\d{4}-\d{2}-\d{2})\b/g;
const CHECK_MARKER=/\b(?:Recherche|(?:neu\s+|nach)?geprüft|überprüft|Prüfstand|Prüfstatus|Prüfergebnis|Prüfung|Prüflauf|Neuprüfung|Nachprüfung)(?:\s+(?:vom|am|zum))?\s*[:(]?\s*$/i;
const STATUS=/prüf|recherch|Quelle|Website|System|Leser|Schnittstelle|Abruf|HTTP|Link|Tagesordnung|Sitzungsunterlagen|Bekanntmachungen|Wartungsarbeiten/i;
// These dates describe an event, permission, rule or version rather than the
// source check. The last clause matters: an earlier licence mention does not
// disqualify a separately dated check at the end of the reason.
const NON_CHECK=/\b(?:Lizenz|Genehmigung|Freigabe|Zustimmung|Einwilligung|Sitzung(?:stag|stermin)?|Kalender|Termin|Beschluss|Entscheidung|Veröffentlichung|veröffentlicht|erstellt|erzeugt|gebaut|Umstellung|Version|(?:Daten|Berichts)?stand|seit)\b[^;:()]{0,80}\(?\s*$/i;
const DATED_STATUS=/(?:OParl[- ](?:Webservice|Schnittstelle)|OParl)[^;]{0,100}(?:nicht aktiviert|abgeschaltet|deaktiviert)\s*\(\s*$/i;

function isoDay(value){
 if(typeof value!=='string')return null;
 let year,month,day;
 let m=value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
 if(m)[,year,month,day]=m.map(Number);
 else if((m=value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)))[,day,month,year]=m.map(Number);
 else return null;
 if(year<1000||year>9999||month<1||month>12||day<1)return null;
 const leap=year%4===0&&(year%100!==0||year%400===0);
 if(day>[31,leap?29:28,31,30,31,30,31,31,30,31,30,31][month-1])return null;
 return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

/** A check date from the reason only, never from build/report/file timestamps. */
export function reasonDate(reason){
 const value=String(reason??''),found=new Set();
 for(const match of value.matchAll(DATE)){
  const day=isoDay(match[0]);if(!day)continue;
  const before=value.slice(0,match.index),after=value.slice(match.index+match[0].length);
  const clause=before.slice(Math.max(before.lastIndexOf(';')+1,before.lastIndexOf('\n')+1));
  const explicit=CHECK_MARKER.test(clause);
  const trailing=/\(\s*$/.test(before)&&/^\s*\)\s*[.]?\s*$/.test(after)&&STATUS.test(clause);
  const status=DATED_STATUS.test(clause)&&/^\s*\)\s*(?:[.;]|$)/.test(after);
  if((explicit||trailing||status)&&!NON_CHECK.test(clause))found.add(day);
 }
 const candidates=[...found].sort();
 return {checkedAt:candidates.length===1?candidates[0]:null,basis:candidates.length===1?'reason':'unknown',candidates};
}

const KIND_RANK={pending:4,atlas:3,work:2,report:1};
const compare=(a,b)=>a<b?-1:a>b?1:0;
const content=e=>JSON.stringify([e.reason??'',e.url??'',e.category??e.c??'',e.access??e.z??'']);
const same=(a,b)=>content(a)===content(b);
const explicitDay=e=>e.dateBasis==='unknown'?null:isoDay(e.checkedAt);
const rank=e=>KIND_RANK[e.origin?.kind]||0;
const stable=value=>{
 if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
 return JSON.stringify(value)??'null';
};
// Source priority and lexical provenance are deterministic tie breakers, not
// evidence of chronological freshness. No timestamp outside checkedAt is used.
const order=(a,b)=>rank(b)-rank(a)||compare(explicitDay(b)||'',explicitDay(a)||'')||compare(stable(a),stable(b));
const differentArea=(a,b)=>a.id&&b.id&&a.id!==b.id;

/**
 * Select evidence without mutating it. selected and alternatives are the exact
 * input objects. decision: keep-current | newer-evidence | fallback | none.
 * A saved current can change only with a strictly newer explicit check date.
 * Unknown dates and disagreeing same-day findings remain open conflicts.
 */
export function resolveEvidence(current,candidates=[]){
 const options=(Array.isArray(candidates)?candidates:[]).filter(e=>e&&typeof e==='object'&&e!==current);
 if(!current&&!options.length)return {selected:null,alternatives:[],conflict:false,decision:'none'};
 let selected=current||null,conflict=false,decision=current?'keep-current':'fallback';
 if(current){
  const day=explicitDay(current),different=options.filter(e=>!same(current,e)||differentArea(current,e));
  const unorderable=different.some(e=>differentArea(current,e)||!day||!explicitDay(e)||explicitDay(e)===day);
  if(unorderable)conflict=true;
  else{
   const newer=options.filter(e=>explicitDay(e)&&explicitDay(e)>day);
   if(newer.length){
    const latest=newer.map(explicitDay).sort().at(-1),atLatest=newer.filter(e=>explicitDay(e)===latest);
    if(new Set(atLatest.map(content)).size>1)conflict=true;
    else{selected=[...atLatest].sort(order)[0];decision='newer-evidence';}
   }
   // An older disagreement is superseded. A same-day disagreement with the
   // selected finding has no ordering and must stay visible.
   if(options.some(e=>explicitDay(e)===explicitDay(selected)&&!same(e,selected)))conflict=true;
  }
 }else{
  const differentContents=new Set(options.map(content)).size>1;
  const allDated=options.every(e=>explicitDay(e));
  if(allDated){
   const latest=options.map(explicitDay).sort().at(-1),atLatest=options.filter(e=>explicitDay(e)===latest);
   selected=[...atLatest].sort(order)[0];conflict=new Set(atLatest.map(content)).size>1;
  }else{
   selected=[...options].sort(order)[0];conflict=differentContents;
  }
  if(options.some(e=>differentArea(selected,e)))conflict=true;
 }
 const alternatives=[...(current&&selected!==current?[current]:[]),...options.filter(e=>e!==selected)].sort(order);
 return {selected,alternatives,conflict,decision};
}
