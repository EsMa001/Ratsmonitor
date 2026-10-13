// Letters a source lost before its text reached us. Some KIC systems (komuna) send every umlaut, ß, § or quote mark of
// a title as the replacement character U+FFFD ("Kosten f�r Hitzeschutzplanung", "gem�� � 27", "Gro�ostheim"); the
// original cannot be read back. Each one is restored from its neighbours with windows learned from correct titles
// (scripts/learn-lost-letters.mjs → lost-letters.json): the longest window of up to 3 characters on each side that
// the model keeps decides the character, and at the start of a word the word's beginning decides upper or lower case.
// Measured on 48,219 titles held out from learning, all such characters lost (learn-lost-letters.mjs --messen,
// 13.10.2026): 98.8 % come back exactly, 99.3 % up to upper or lower case.
import model from './lost-letters.json' with {type:'json'};

/** The replacement character U+FFFD. */
export const LOST='�';
/** Characters a source can lose (Windows-1252 beyond ASCII), with the capital umlauts folded to small ones. */
export const CANDIDATES=new Set([...'äöüß§–—„“”‚‘’€é…•²³°«»´áàèêóôúçñ½']);
export const foldCase=c=>c==='Ä'?'ä':c==='Ö'?'ö':c==='Ü'?'ü':c;
/** A character of a window: letters in small case, digits as 0, white space as a blank, ?|^$ (used by the keys) as #. */
export const windowChar=c=>/\p{L}/u.test(c)?c.toLowerCase():/\d/.test(c)?'0':/\s/.test(c)?' ':/[?|^$]/.test(c)?'#':c;
/**
 * Key of the window around position i of the characters a: before characters before, after characters after, the
 * position itself as "?", the start of the text as "^" and its end as "$". null where the window reaches beyond the
 * text or covers another lost character.
 */
export function windowKey(a,i,before,after){
 let left='',right='';
 for(let j=1;j<=before;j++){const p=i-j;if(p<-1||(p===-1&&j<before))return null;const c=p===-1?'^':windowChar(a[p]);if(c===LOST)return null;left=c+left;}
 for(let j=1;j<=after;j++){const p=i+j;if(p>a.length||(p===a.length&&j<after))return null;const c=p===a.length?'$':windowChar(a[p]);if(c===LOST)return null;right+=c;}
 return left+'?'+right;
}
/** The beginning of the word at position i (up to 12 letters, small case), the lost letter given as c. */
export function wordStart(a,i,c){let w=c;for(let j=i+1;j<a.length&&j<=i+12&&/\p{L}/u.test(a[j]);j++)w+=a[j].toLowerCase();return w;}
/** Shapes of the windows [before, after] in the order they are asked: longer first, then balanced, then more before. */
export const shapes=side=>{const r=[];for(let b=0;b<=side;b++)for(let a=0;a<=side;a++)r.push([b,a]);return r.sort((x,y)=>(y[0]+y[1])-(x[0]+x[1])||Math.abs(x[0]-x[1])-Math.abs(y[0]-y[1])||y[0]-x[0]);};
export const letter=c=>/\p{L}/u.test(c||'');
const capital=c=>/\p{Lu}/u.test(c||''),small=c=>/\p{Ll}/u.test(c||'');
/** Between two letters only a letter or an apostrophe can stand ("Kapps�ge" has no quote mark, "Peter�s" may). */
export const inWordChar=c=>letter(c)||c==='’'||c==='´';

// Tables of a model: windows "f?r|b?rg|…" grouped by their character, beginnings of words in upper and in lower case.
function tablesOf(m){
 const windows=new Map();
 for(const [c,keys] of Object.entries(m.windows))for(const k of keys.split('|'))if(k)windows.set(k,c);
 const cases=new Map();
 for(const p of m.upper.split('|'))if(p)cases.set(p,true);
 for(const p of m.lower.split('|'))if(p)cases.set(p,false);
 return {windows,cases,shapes:shapes(m.side)};
}
// The character for position i: the first window the model knows, in the order of shapes.
function character(a,i,{windows,shapes}){
 const inWord=letter(a[i-1])&&letter(a[i+1]);
 for(const [before,after] of shapes){const k=windowKey(a,i,before,after),c=k&&windows.get(k);if(c&&(!inWord||inWordChar(c)))return c;}
 return null;
}
// Upper or lower case of a restored umlaut: capitals next to capitals ("ÖPNV", "KVÜ"), a capital at the start of the
// text, otherwise at the start of a word as the titles write that word ("Änderung", "über", "Öffentlichkeit").
function withCase(a,i,c,{cases}){
 if(!'äöü'.includes(c))return c;
 if(capital(a[i+1])||(capital(a[i-1])&&!small(a[i+1])))return c.toUpperCase();
 if(letter(a[i-1]))return c;
 if(/^[\s"'„“(]*$/.test(a.slice(0,i).join('')))return c.toUpperCase();
 const w=wordStart(a,i,c);
 for(let n=w.length;n>=1;n--){const up=cases.get(w.slice(0,n));if(up!==undefined)return up?c.toUpperCase():c;}
 return c;
}
// Two lost characters before a number outside a word are "§§" ("nach �� 3 und 4"): one at a time, the first sees only
// what stands before it.
const SECTIONS=new RegExp('(?<!\\p{L})'+LOST+LOST+'(?=\\s?\\d)','gu');
/** The restoring function of a model (as lost-letters.json stores it). */
export function restorer(m){
 let t;
 return text=>{
  if(typeof text!=='string'||!text.includes(LOST))return text;
  t??=tablesOf(m);const a=[...text.replace(SECTIONS,'§§')];
  for(let i=0;i<a.length;i++){if(a[i]!==LOST)continue;const c=character(a,i,t);if(c)a[i]=withCase(a,i,c,t);}
  return a.join('');
 };
}
/** text with each lost character (U+FFFD) restored; text without one is returned as it is. */
export const restoreLostLetters=restorer(model);
