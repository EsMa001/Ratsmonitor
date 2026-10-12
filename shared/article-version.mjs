// Fassungen eines Vorgangs (article_versions) als Änderung statt als volle Kopie (seit 12.10.2026): gespeichert werden nur die
// Felder, in denen sich der frühere Stand vom folgenden unterscheidet, mit ihrem alten Wert (`changed`), und die Felder, die
// es früher nicht gab (`added`). Bei Listen und Objekten in beiden Ständen (events, sourceData …) bis vier Ebenen tief nur die
// geänderten Einträge ({$list: alte Länge, at: {Index: alter Eintrag}} bzw. {$obj: {Schlüssel: alter Wert}, added}).
// metadata und updatedAt fehlen (ändern sich bei jedem Schreiben). Den vollen früheren Stand ergibt restoreVersions vom
// aktuellen Vorgang rückwärts. Ältere Zeilen ohne `format` sind volle Kopien.


export const VERSION_FORMAT='diff-v1';
const SKIP=new Set(['metadata','updatedAt']);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const isObj=v=>v&&typeof v==='object'&&!Array.isArray(v);

const DEPTH=4;
function delta(old,now,depth=1){
 if(depth>DEPTH)return old;
 if(Array.isArray(old)&&Array.isArray(now)){
  const at={};for(let i=0;i<old.length;i++)if(!same(old[i],now[i]))at[i]=i<now.length?delta(old[i],now[i],depth+1):old[i];
  return {$list:old.length,at};
 }
 if(isObj(old)&&isObj(now)){
  const o={},added=[];
  for(const k of Object.keys(old))if(!same(old[k],now[k]))o[k]=k in now?delta(old[k],now[k],depth+1):old[k];
  for(const k of Object.keys(now))if(!(k in old))added.push(k);
  return {$obj:o,...(added.length?{added}:{})};
 }
 return old;
}
function undo(now,d){
 if(d&&typeof d==='object'&&'$list' in d&&Array.isArray(now)){const out=now.slice(0,d.$list);for(const [i,v] of Object.entries(d.at))out[i]=Number(i)<now.length?undo(now[i],v):v;return out;}
 if(d&&typeof d==='object'&&'$obj' in d&&isObj(now)){const out={...now};for(const [k,v] of Object.entries(d.$obj))out[k]=k in now?undo(now[k],v):v;for(const k of d.added||[])delete out[k];return out;}
 return d;
}

/** Änderung vom früheren Stand `prior` zum folgenden `next` als JSON für article_versions.payload. */
export function versionPayload(prior,next){
 const changed={},added=[];
 for(const k of Object.keys(prior||{}))if(!SKIP.has(k)&&!same(prior[k],next?.[k]))changed[k]=next&&k in next?delta(prior[k],next[k]):prior[k];
 for(const k of Object.keys(next||{}))if(!SKIP.has(k)&&!(k in (prior||{})))added.push(k);
 return JSON.stringify({format:VERSION_FORMAT,id:prior?.id,changed,...(added.length?{added}:{})});
}

/** Volle frühere Stände aus dem aktuellen Vorgang und seinen Fassungen (neueste zuerst, payload als Objekt). */
export function restoreVersions(current,newestFirst){
 const out=[];let state=current;
 for(const v of newestFirst){
  if(v?.format!==VERSION_FORMAT){state=v;out.push(v);continue;}
  const next={...state};
  for(const [k,d] of Object.entries(v.changed))next[k]=k in state?undo(state[k],d):d;
  for(const k of v.added||[])delete next[k];
  state=next;out.push(state);
 }
 return out;
}
