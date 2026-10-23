// Überblick eines Berichts (seit 22.10.2026): zwei bis drei Sätze, die den Vorgang beschreiben, nicht seinen Inhalt. Gebaut aus den
// Antworten des Modells (nur sicheren), den Sitzungen und der Dokumentliste; ersetzt den Standardsatz des Imports („… Der Stand ist
// noch offen. Die Details stehen in den verlinkten Originalunterlagen.“). Kein Auszug und keine Zusammenfassung: es wird nichts aus
// dem Text übernommen und nichts dazu erfunden. Reine Funktion; readReport legt das Ergebnis in payload.overview ab.
import {SUBTOPICS,THEMES} from '../themes.mjs';
import {SERVICE_NAMES} from './names.mjs';
import {outcomeOf} from '../vote-result.mjs';

export const OVERVIEW_VERSION='overview-v3';
const SURE=0.7,TOPIC_SURE=0.5;
const subName=id=>SUBTOPICS.find(s=>s.id===id)?.name||'';
const themeName=id=>THEMES.find(t=>t.id===id)?.name||'';
// Ein Gremium „laut Originalquelle“ ohne Namen ist kein Gremium
const NO_BODY=/^\s*gremium(?: laut originalquelle)?(?:\s*,\s*gremium(?: laut originalquelle)?)*\s*$/i;
const STEP_TEXT={start:'Beginn des Verfahrens',frueh:'frühe Phase',entwurf:'Entwurf und Beteiligung',abwaegung:'Abwägung',beschluss:'Beschluss',umsetzung:'Umsetzung',aufhebung:'Aufhebung'};
const DOC_TEXT={paper:['Vorlage','Vorlagen'],bundle:['Sammeldokument','Sammeldokumente'],attachment:['Anlage','Anlagen'],result:['Beschlussauszug','Beschlussauszüge'],
 minutes:['Niederschrift','Niederschriften'],session:['Sitzungsunterlage','Sitzungsunterlagen'],other:['weiteres Dokument','weitere Dokumente']};
const NUM=['','ein','zwei','drei','vier','fünf','sechs','sieben','acht','neun','zehn','elf','zwölf'];
const dd=d=>`${d.slice(8,10)}.${d.slice(5,7)}.${d.slice(2,4)}`;
const list=a=>a.length<2?a.join(''):a.slice(0,-1).join(', ')+' und '+a.at(-1);

/** Art des Vorgangs als Nomen, mit Partei bei Anträgen einer Fraktion (aus dem Fakt) */
function what(m,parties){
 if(!(m.processP>=SURE))return null;
 const ap=m.applicants?.[0];
 switch(m.process){
  case 'information':return 'Information';
  case 'political':return ap==='fraction'?`Antrag einer Fraktion${parties.length?` (${parties.join(', ')})`:''}`:ap==='member'?'Antrag eines Ratsmitglieds':ap==='body'?'Antrag eines Gremiums':ap==='residents'?'Anliegen aus der Einwohnerschaft':'Antrag oder Anfrage aus der Politik';
  case 'permit':return 'Entscheidung über ein Vorhaben Dritter';
  case 'planning':return m.step&&STEP_TEXT[m.step]?`Planung (Schritt: ${STEP_TEXT[m.step]})`:'Planung oder Regelung';
  case 'build':return m.service&&SERVICE_NAMES[m.service]?`Bau und Vergabe (${SERVICE_NAMES[m.service]})`:'Bau und Vergabe';
  case 'money':return 'Finanzielle Entscheidung';
  case 'contract':return 'Vertrag oder Grundstücksgeschäft';
  default:return null;
 }
}
/** Gegenstand: Unterthema mit Thema, sonst Thema (nur bei sicherem Thema). Unter-Unterthemen nicht: zu oft falsch (76 %) */
function topic(m){
 if(!(m.themeP>=TOPIC_SURE)||!m.themes?.length)return null;
 const sub=subName(m.subs?.[0]),th=themeName(m.themes[0]);
 return sub?`${sub} (${th})`:th;
}
/** Sitzungen: höchstens die letzten drei mit Datum und Gremium; künftige als angesetzt. Der Ausgang nur aus dem Ergebnistext der Sitzung
    (outcomeOf, shared/vote-result.mjs), nie aus dem Stand des Imports: der setzte „empfohlen“ auch bei „ungeändert beschlossen“
    und „zur Kenntnis genommen“ ohne Ergebnis (Stichprobe 23.10.2026: 15 von 50 Überblicken falsch) */
function sessions(events,today){
 const ev=(events||[]).filter(e=>e?.date&&e.committee&&!NO_BODY.test(e.committee)).sort((a,b)=>a.date.localeCompare(b.date));
 const seen=new Set(),uniq=ev.filter(e=>{const k=e.date.slice(0,10)+'|'+e.committee;if(seen.has(k))return false;seen.add(k);return true;}).slice(-3);
 if(!uniq.length)return null;
 const parts=uniq.map(e=>{const d=e.date.slice(0,10),future=d>today,how=future?'angesetzt':outcomeOf(e.result)||'auf der Tagesordnung';return `am ${dd(d)} im Gremium „${e.committee.trim()}“ ${how}`;});
 const s=list(parts);return s[0].toUpperCase()+s.slice(1)+'.';
}
/** Unterlagen nach Dokumentart des Modells */
function documents(doctypes){
 if(!doctypes?.length)return null;
 const n={};for(const t of doctypes)n[t]=(n[t]||0)+1;
 const parts=Object.keys(DOC_TEXT).filter(k=>n[k]).map(k=>n[k]===1?DOC_TEXT[k][0]:`${NUM[n[k]]||n[k]} ${DOC_TEXT[k][1]}`);
 return `Unterlagen: ${list(parts)}.`;
}

/**
 * @param {{events?:any[]}} report
 * @param {{kind:string,kindP?:number,themes?:string[],themeP?:number,subs?:string[],subsubs?:string[],process?:string|null,processP?:number,step?:string|null,service?:string|null,applicants?:string[],doctypes?:string[]}} model
 * @param {{parties?:string[],today?:string}} [o] parties: Namen aus dem Fakt faction
 * @returns {{version:string,text:string}|null}
 */
export function overviewOf(report,model,{parties=[],today=new Date().toISOString().slice(0,10)}={}){
 if(!model)return null;
 const out=[];
 if(model.kindP>=SURE&&model.kind==='procedure')out.push('Punkt des Sitzungsablaufs ohne eigenen Gegenstand.');
 else if(model.kindP>=SURE&&model.kind==='personal')out.push('Personalie.');
 else{const w=what(model,parties),t=topic(model);if(w&&t)out.push(`${w} zum Thema ${t}.`);else if(w)out.push(`${w}.`);else if(t)out.push(`Thema: ${t}.`);}
 const s=sessions(report.events,today);if(s)out.push(s);
 // Nichtöffentlicher Punkt einer veröffentlichten Tagesordnung (seit 24.10.2026): öffentlich bekannt sind nur Titel, Sitzung, Gremium
 if(report.publicity==='nonpublic')out.push('Der Punkt wurde in nichtöffentlicher Sitzung beraten; öffentlich bekannt sind Titel, Sitzung und Gremium.');
 else if(report.publicity==='unclear')out.push('Ob der Punkt öffentlich beraten wurde, gibt die Quelle nicht an.');
 const d=documents(model.doctypes);if(d)out.push(d);
 return out.length?{version:OVERVIEW_VERSION,text:out.join(' ')}:null;
}
