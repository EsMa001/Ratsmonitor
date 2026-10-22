// Satzkandidaten eines Hauptdokuments für die Kernsätze (Zusammenfassung aus dem Modell): dieselbe Säuberung und Satztrennung wie
// die Regel-Zusammenfassung (cleanText, splitSentences, sections in server/integrations/rule-summary.mjs), aber ohne deren Auswahl:
// welche Sätze Kernsätze sind, lernt das Modell aus den Einordnungen (Begriffsbuch Abschnitt 12). Jeder Satz mit Abschnitt
// (decision: Beschlussvorschlag, facts: Sachverhalt, other: sonst) und Stelle. Die ersten MAX_CANDIDATES Sätze ab 30 Zeichen.
import {cleanText,splitSentences,sections} from '../../server/integrations/rule-summary.mjs';

export const SENTENCES_VERSION='sentences-v1';
export const MAX_CANDIDATES=60;
const key=s=>s.replace(/\s+/g,' ').trim().slice(0,60);

/** @param {string} text Text des Hauptdokuments (wie readDocument, höchstens 15.000 Zeichen genügen) @returns {{i:number,text:string,sec:string}[]} */
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
 return out;
}
