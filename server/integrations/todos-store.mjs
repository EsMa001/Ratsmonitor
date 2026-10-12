import {AdminError} from './admin-access.mjs';

// The deployed list supplies categories and source tasks. Board changes and new tasks live in system_state.
const KEY='admin-todos-v1';
const STATUSES=new Set(['backlog','ready','doing','review','done']);
const PEOPLE=new Set(['max','nico']);
const RESOLUTIONS=new Set(['done','wont_do','duplicate']);
const FIELDS=['text','hinweis','prio','art','status','abschluss','bearbeiter','wartetAuf','reihenfolge','faellig','startDatum','unteraufgaben','erledigt','erledigtAm'];
const INPUT_FIELDS=new Set(['id','kategorieId',...FIELDS]);
const MAX_UPDATES=1000;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const own=(value,key)=>Object.hasOwn(value,key);
const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const isDate=value=>typeof value==='string'&&DATE.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const statusOf=item=>STATUSES.has(item.status)?item.status:item.erledigt?'done':'backlog';
const conflict=()=>new AdminError(409,'Die Aufgaben wurden zwischenzeitlich geaendert. Bitte den aktuellen Stand laden und die Aenderung erneut speichern.');
export const berlinToday=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Berlin'});

function normalize(item){
 const status=statusOf(item);
 const next={...item,status,prio:[1,2,3].includes(item.prio)?item.prio:2,
  abschluss:status==='done'?(RESOLUTIONS.has(item.abschluss)?item.abschluss:'done'):null,
  bearbeiter:PEOPLE.has(item.bearbeiter)?item.bearbeiter:null,wartetAuf:item.wartetAuf||null,
  reihenfolge:Number.isFinite(item.reihenfolge)?item.reihenfolge:0,faellig:item.faellig??null,
  startDatum:item.startDatum??null,unteraufgaben:(item.unteraufgaben??[]).map(subtask=>({...subtask})),
  erledigt:status==='done',erledigtAm:status==='done'?item.erledigtAm??null:null};
 for(const key of ['hinweis','art'])if(next[key]===null)delete next[key];
 return next;
}
export function normalizeTodos(data){
 return {...data,kategorien:data.kategorien.map(category=>({...category,items:category.items.map(normalize)}))};
}

function validateInput(update,creating=false){
 if(!isObject(update)||typeof update.id!=='string'||!update.id.length||update.id.length>160||!Object.keys(update).every(key=>INPUT_FIELDS.has(key)))throw new AdminError(400,'Ungueltige Anfrage.');
 if(Object.keys(update).every(key=>key==='id'))throw new AdminError(400,'Eine Aenderung ist erforderlich.');
 const next={...update};
 if(own(next,'kategorieId')&&(typeof next.kategorieId!=='string'||!next.kategorieId.length))throw new AdminError(400,'Ungueltige Kategorie.');
 if(creating&&(!own(next,'kategorieId')||!own(next,'text')))throw new AdminError(400,'Kategorie und Titel sind erforderlich.');
 if(own(next,'text')){
  if(typeof next.text!=='string'||!next.text.trim()||next.text.length>1000)throw new AdminError(400,'Ungueltiger Titel.');
  next.text=next.text.trim();
 }
 for(const key of ['hinweis','wartetAuf'])if(own(next,key)){
  if(next[key]!==null&&(typeof next[key]!=='string'||next[key].length>(key==='hinweis'?10000:1000)))throw new AdminError(400,'Ungueltiger Hinweis.');
  next[key]=next[key]?.trim()||null;
 }
 if(own(next,'prio')&&![1,2,3].includes(next.prio))throw new AdminError(400,'Ungueltige Prioritaet.');
 if(own(next,'art')&&next.art!==null&&!['code','extern'].includes(next.art))throw new AdminError(400,'Ungueltige Aufgabenart.');
 if(own(next,'status')&&!STATUSES.has(next.status))throw new AdminError(400,'Ungueltiger Status.');
 if(own(next,'abschluss')&&next.abschluss!==null&&!RESOLUTIONS.has(next.abschluss))throw new AdminError(400,'Ungueltiger Abschlussgrund.');
 if(own(next,'bearbeiter')&&next.bearbeiter!==null&&!PEOPLE.has(next.bearbeiter))throw new AdminError(400,'Ungueltiger Bearbeiter.');
 if(own(next,'reihenfolge')&&(!Number.isFinite(next.reihenfolge)||Math.abs(next.reihenfolge)>1e12))throw new AdminError(400,'Ungueltige Reihenfolge.');
 if(own(next,'erledigt')&&typeof next.erledigt!=='boolean')throw new AdminError(400,'Ungueltige Anfrage.');
 for(const key of ['faellig','startDatum','erledigtAm'])if(own(next,key)){
  next[key]=next[key]===''?null:next[key];
  if(next[key]!==null&&!isDate(next[key]))throw new AdminError(400,'Ungueltiges Datum.');
 }
 if(own(next,'unteraufgaben')){
  if(!Array.isArray(next.unteraufgaben)||next.unteraufgaben.length>100)throw new AdminError(400,'Hoechstens 100 Unteraufgaben sind erlaubt.');
  const ids=new Set();
  next.unteraufgaben=next.unteraufgaben.map(subtask=>{
   if(!isObject(subtask)||!Object.keys(subtask).every(key=>['id','text','erledigt'].includes(key))||typeof subtask.id!=='string'||!subtask.id.trim()||subtask.id.length>160||ids.has(subtask.id)||typeof subtask.text!=='string'||!subtask.text.trim()||subtask.text.length>500||typeof subtask.erledigt!=='boolean')throw new AdminError(400,'Ungueltige Unteraufgabe.');
   ids.add(subtask.id);
   return {id:subtask.id,text:subtask.text.trim(),erledigt:subtask.erledigt};
  });
 }
 if(own(next,'status')&&own(next,'erledigt')&&(next.status==='done')!==next.erledigt)throw new AdminError(400,'Status und Erledigung widersprechen sich.');
 if(own(next,'abschluss')){
  const closed=next.abschluss!==null;
  if((own(next,'status')&&(next.status==='done')!==closed)||(own(next,'erledigt')&&next.erledigt!==closed))throw new AdminError(400,'Status und Abschlussgrund widersprechen sich.');
 }
 return next;
}

function applyChange(item,change,today){
 const fields={...change};delete fields.id;delete fields.kategorieId;
 const previousStatus=statusOf(item);
 const status=own(change,'status')?change.status:own(change,'erledigt')?(change.erledigt?'done':previousStatus==='done'?'backlog':previousStatus):own(change,'abschluss')?(change.abschluss!==null?'done':previousStatus==='done'?'backlog':previousStatus):previousStatus;
 const next=normalize({...item,...fields,status});
 if(next.startDatum&&next.faellig&&next.startDatum>next.faellig)throw new AdminError(400,'Das geplante Enddatum darf nicht vor dem Startdatum liegen.');
 next.erledigtAm=status==='done'?(own(change,'erledigtAm')?change.erledigtAm:statusOf(item)==='done'?item.erledigtAm??null:today):null;
 for(const key of ['hinweis','art'])if(next[key]===null)delete next[key];
 return next;
}

/** Supports both legacy completion/date edits and partial board edits. */
export function applyTodoUpdates(data,updates,today=berlinToday(),creates=[]){
 if(!Array.isArray(updates)||!Array.isArray(creates)||updates.length+creates.length>MAX_UPDATES)throw new AdminError(400,'Ungueltige Anfrage.');
 const next=normalizeTodos(data);
 const categories=new Map(next.kategorien.map(category=>[category.id,category]));
 const tasks=new Map(next.kategorien.flatMap(category=>category.items.map(item=>[item.id,{item,category}])));
 const changes=updates.map(update=>validateInput(update));
 const additions=creates.map(create=>validateInput(create,true));
 if(new Set(changes.map(update=>update.id)).size!==changes.length)throw new AdminError(400,'Eintrag mehrfach geaendert.');
 for(const change of changes){
  const entry=tasks.get(change.id);
  if(!entry)throw new AdminError(400,'Unbekannter Eintrag: '+change.id);
  const category=own(change,'kategorieId')?categories.get(change.kategorieId):entry.category;
  if(!category)throw new AdminError(400,'Unbekannte Kategorie: '+change.kategorieId);
  const item=applyChange(entry.item,change,today);
  const index=entry.category.items.indexOf(entry.item);
  if(category===entry.category)category.items[index]=item;
  else{entry.category.items.splice(index,1);category.items.push(item);}
  tasks.set(change.id,{item,category});
 }
 for(const change of additions){
  if(tasks.has(change.id))throw new AdminError(400,'Die Kennung ist bereits vergeben: '+change.id);
  const category=categories.get(change.kategorieId);
  if(!category)throw new AdminError(400,'Unbekannte Kategorie: '+change.kategorieId);
  const item=applyChange({id:change.id,text:change.text,erledigt:false,faellig:null,erledigtAm:null},change,today);
  category.items.push(item);tasks.set(item.id,{item,category});
 }
 return next;
}

// Old records wrote both completion and due date even when only one field changed.
// Recover only actual overrides so a later deployed date cannot erase an earlier completion.
function asStored(stored){
 if(stored?.format===2&&isObject(stored.changes)&&Array.isArray(stored.creates))return stored;
 const changes=Object.create(null);
 for(const [id,change] of Object.entries(isObject(stored)?stored:{})){
  if(!isObject(change)||!isObject(change.base))continue;
  const fields={};
  if(change.erledigt!==change.base.erledigt){fields.status=change.erledigt?'done':'backlog';fields.erledigt=change.erledigt;fields.erledigtAm=change.erledigtAm??null;}
  else if(change.erledigt&&change.erledigtAm)fields.erledigtAm=change.erledigtAm;
  if((change.faellig??null)!==(change.base.faellig??null))fields.faellig=change.faellig??null;
  if(Object.keys(fields).length)changes[id]={fields};
 }
 return {format:2,changes,creates:[]};
}

/** Server overrides survive changes to source text, dates and category order on deployment. */
export function mergeTodos(base,stored){
 const source=asStored(stored),next=normalizeTodos(base);
 const categories=new Map(next.kategorien.map(category=>[category.id,category]));
 // A pulled task can already be in the source while its server record has newer edits.
 const created=new Map(source.creates.filter(change=>change?.item).map(change=>[change.item.id,change]));
 const seen=new Set();
 for(const category of next.kategorien)category.items=category.items.map(item=>{
  seen.add(item.id);
  const current=created.has(item.id)?normalize(created.get(item.id).item):item;
  const change=own(source.changes,item.id)?source.changes[item.id]:null;
  return change?normalize({...current,...change.fields}):current;
 });
 for(const change of source.creates){
  if(!change?.item||seen.has(change.item.id))continue;
  const category=categories.get(change.kategorieId);
  if(category){category.items.push(normalize(change.item));seen.add(change.item.id);}
 }
 for(const category of [...next.kategorien])for(const item of [...category.items]){
  const destination=(own(source.changes,item.id)?source.changes[item.id]?.kategorieId:null)??created.get(item.id)?.kategorieId;
  if(destination&&destination!==category.id&&categories.has(destination)){
   category.items.splice(category.items.indexOf(item),1);categories.get(destination).items.push(item);
  }
 }
 return next;
}

/** Minimal per-field overrides plus full records for tasks created through the board. */
export function diffTodos(base,next){
 const before=new Map(normalizeTodos(base).kategorien.flatMap(category=>category.items.map(item=>[item.id,{item,kategorieId:category.id}])));
 const changes=Object.create(null),creates=[];
 for(const category of normalizeTodos(next).kategorien)for(const item of category.items){
  const previous=before.get(item.id);
  if(!previous){creates.push({kategorieId:category.id,item});continue;}
  const fields={};
  for(const key of FIELDS){
   const before=previous.item[key]??null,after=item[key]??null;
   if(key==='unteraufgaben'?JSON.stringify(before)!==JSON.stringify(after):before!==after)fields[key]=after;
  }
  // Keep a planned interval together when a later deployment changes its source dates.
  if(own(fields,'startDatum')||own(fields,'faellig'))Object.assign(fields,{startDatum:item.startDatum,faellig:item.faellig});
  // Closure is a single state: a deployment cannot keep its reason while reopening its status.
  if((previous.item.erledigt||item.erledigt)&&['status','erledigt','erledigtAm','abschluss'].some(key=>own(fields,key))){
   for(const key of ['status','erledigt','erledigtAm','abschluss'])fields[key]=item[key]??null;
  }
  const moved=previous.kategorieId!==category.id;
  if(Object.keys(fields).length||moved)changes[item.id]={fields,...moved?{kategorieId:category.id}:{}};
 }
 return {format:2,changes,creates};
}

async function readRow(db){return db.prepare('SELECT value FROM system_state WHERE key=?').bind(KEY).first();}
function parseStored(row){
 if(!row)return {};
 try{
  const stored=JSON.parse(row.value);
  if(!isObject(stored))throw Error('Invalid state');
  if(own(stored,'format')){
   if(stored.format!==2||!isObject(stored.changes)||!Array.isArray(stored.creates))throw Error('Invalid state');
   for(const [id,change] of Object.entries(stored.changes)){
    if(!isObject(change)||!isObject(change.fields)||Object.keys(change.fields).some(key=>!FIELDS.includes(key)))throw Error('Invalid change');
    if(change.fields.prio===null)change.fields.prio=2;
    if(Object.keys(change.fields).length||change.kategorieId!==undefined)validateInput({id,...change.fields,...change.kategorieId!==undefined?{kategorieId:change.kategorieId}:{}});
   }
   for(const create of stored.creates){
    if(!isObject(create)||!isObject(create.item))throw Error('Invalid task');
    if(create.item.prio===null)create.item.prio=2;
    validateInput({...create.item,kategorieId:create.kategorieId},true);
   }
  }else for(const [id,change] of Object.entries(stored)){
   if(!isObject(change)||!isObject(change.base)||typeof change.base.erledigt!=='boolean')throw Error('Invalid legacy change');
   if(change.base.faellig!=null&&!isDate(change.base.faellig))throw Error('Invalid legacy date');
   validateInput({id,erledigt:change.erledigt,faellig:change.faellig??null,erledigtAm:change.erledigtAm??null});
  }
  return stored;
 }catch{throw new AdminError(500,'Der gespeicherte Aufgabenstand ist ungueltig.');}
}
export async function todoRevision(base,storedValue=''){
 const data={...base};delete data.revision;
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(data)+'\n'+storedValue));
 return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
}
export function requireTodoRevision(revision){
 if(typeof revision!=='string'||!/^[a-f0-9]{64}$/.test(revision))throw new AdminError(400,'Der Aufgabenstand fehlt. Bitte die Seite neu laden.');
}
export async function readChanges(db){return parseStored(await readRow(db));}
export async function readStoredTodos(db,base){
 const row=await readRow(db);
 return {...mergeTodos(base,parseStored(row)),revision:await todoRevision(base,row?.value??'')};
}
export async function updateStoredTodos(db,base,updates,today=berlinToday(),options={}){
 const row=await readRow(db),revision=await todoRevision(base,row?.value??'');
 if(options.revision!==undefined&&options.revision!==revision)throw conflict();
 const next=applyTodoUpdates(mergeTodos(base,parseStored(row)),updates,today,options.creates??[]);
 const stored={...diffTodos(base,next),saveId:crypto.randomUUID()};
 const value=JSON.stringify(stored);
 // A single conditional SQL write makes the compare-and-swap atomic on SQLite and D1.
 const saved=row
  ?await db.prepare('UPDATE system_state SET value=? WHERE key=? AND value=? RETURNING value').bind(value,KEY,row.value).first()
  :await db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO NOTHING RETURNING value').bind(KEY,value).first();
 if(!saved)throw conflict();
 return {...next,revision:await todoRevision(base,value)};
}
