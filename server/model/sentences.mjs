// Satzkandidaten eines Hauptdokuments für die Kernsätze (Zusammenfassung aus dem Modell): dieselbe Säuberung und Satztrennung wie
// die Regel-Zusammenfassung (cleanText, splitSentences, sections in server/integrations/rule-summary.mjs), aber ohne deren Auswahl:
// welche Sätze Kernsätze sind, lernt das Modell aus den Einordnungen (Begriffsbuch Abschnitt 12). Jeder Satz mit Abschnitt
// (decision: Beschlussvorschlag, facts: Sachverhalt, other: sonst) und Stelle. Die ersten MAX_CANDIDATES Sätze ab 30 Zeichen.
import {cleanText,splitSentences,sections} from '../integrations/rule-summary.mjs';

export const SENTENCES_VERSION='sentences-v2';
export const MAX_CANDIDATES=60;
const key=s=>s.replace(/\s+/g,' ').trim().slice(0,60);

/** @param {string} text Text des Hauptdokuments (wie readDocument, höchstens 15.000 Zeichen genügen) @returns {{i:number,text:string,sec:string,rescued?:boolean}[]} */
export function candidates(text){
 const clean=cleanText(String(text||'').slice(0,15000));
 const {decision,facts}=sections(clean),marked=facts!==clean;
 const inDecision=new Set(splitSentences(decision).map(key)),inFacts=marked?new Set(splitSentences(facts).map(key)):new Set();
 const out=[];
 for(const s of splitSentences(clean)){
  if(s.length<30||s.length>600)continue;
  const k=key(s);out.push({i:out.length,text:s,sec:inDecision.has(k)?'decision':inFacts.has(k)?'facts':'other'});
  if(out.length>=MAX_CANDIDATES)break;
 }
 /* Beschlussvorschlag hinter Kopfzeilen ohne Punkt („Betr.: … Höhe der Kosten: … Beschlussvorschlag für den Rat: Der Förderantrag …“):
    die Satztrennung macht daraus einen Satz über 600 Zeichen, der oben wegfällt. Der Teil hinter der letzten Marke kommt hinten
    an (rescued), damit die Nummern der übrigen Kandidaten und damit die Lerndaten des Satzkopfs gleich bleiben (seit 23.10.2026) */
 for(const s of splitSentences(clean)){
  if(s.length<=600)continue;
  let cut=-1;for(const m of s.slice(0,800).matchAll(RESCUE))cut=m.index+m[0].length;
  const r=cut>0?s.slice(cut).trim():'';
  if(r.length>=30&&r.length<=600&&!out.some(c=>c.text===r))out.push({i:out.length,text:r,sec:'decision',rescued:true});
  if(out.filter(c=>c.rescued).length>=2)break;
 }
 return out;
}
const RESCUE=/(?:\b(?:Beschlussvorschlag|Beschlussantrag|Beschlussempfehlung|Beschlusstext|Beschluss)(?:\s+(?:für|an)\s+den\s+[^:.]{2,40})?\s*:|\bmögen? (?:folgendes |Folgendes |wie folgt )?beschließen:)\s*/g;
