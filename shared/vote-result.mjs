// Ausgang aus den Ergebnistexten der Sitzungen (events[].result, Beschlusstext): eine Regel für Newsradar (outcomeOf), Social Media
// und Streitquote (classifyResult, scripts/learn-social.mjs) und plenara.X Beschlüsse (readResult, x_cases.vote/changed). Liest nur,
// was wörtlich dasteht („einstimmig“, „Ja: 21, Nein: 0“, „geändert beschlossen“); den Status selbst liefert das Modell.

/** Ausgang einer Sitzung aus ihrem Ergebnistext: Kenntnisnahme und Empfehlung sind kein Beschluss, Zurückziehen keine Vertagung.
    Platzhalter der Importe („ein Beschlussergebnis ist im erfassten Text nicht belegt“, „die Sitzung steht noch aus“, „der
    Beschlusstext liegt als Dokument vor“) sind kein Ergebnis. */
export const NO_RESULT=/nicht belegt|steht noch aus|liegt als Dokument vor|ohne Beschluss geführt/i;
export function outcomeOf(text){
 const t=String(text||'').toLowerCase();if(!t.trim()||NO_RESULT.test(t))return null;
 if(/zurückgezogen/.test(t))return 'zurückgezogen';
 if(/abgelehnt|nicht angenommen|nicht beschlossen|keine mehrheit|nicht empfohlen/.test(t))return 'abgelehnt';
 if(/vertagt|zurückgestellt|abgesetzt|vertagung|ohne beschluss/.test(t))return 'vertagt';
 if(/verwiesen|überwiesen/.test(t))return 'verwiesen';
 if(/kenntnis/.test(t)&&!/beschlossen|zugestimmt|angenommen/.test(t))return 'zur Kenntnis genommen';
 // Stimmenzahlen („Ja: 21, Nein: 0“, „29 Ja-Stimme(n), 0 Gegenstimme(n)“, „20 Stimmen dafür 0 Stimmen dagegen“): ohne Nein-Stimme
 // einstimmig, mehr Ja als Nein mit Mehrheit, sonst abgelehnt (Enthaltungen zählen nicht)
 const yes=t.match(/(?:\bja\s*:?\s*(\d+)|(\d+)\s*(?:ja-stimme|ja\b|stimmen? dafür|stimme\(n\) dafür|dafür))/),no=t.match(/(?:\bnein\s*:?\s*(\d+)|(\d+)\s*(?:nein-stimme|nein\b|gegenstimme|stimmen? dagegen|stimme\(n\) dagegen|dagegen))/);
 // leere Zähler („Ja: 0, Nein: 0“) sind keine Abstimmung
 if(yes&&no&&+(yes[1]??yes[2])+ +(no[1]??no[2])>0&&!/abgelehnt|vertagt|zurückgezogen|verwiesen|kenntnis/.test(t)){const y=+(yes[1]??yes[2]),n=+(no[1]??no[2]);
  if(y>n)return (n===0?'einstimmig ':'mit Mehrheit ')+(/empfohlen|empfiehlt|empfehlung/.test(t)&&!/beschlossen/.test(t)?'empfohlen':'beschlossen');
  return 'abgelehnt';}
 if(/^(?:zustimmung|befürwortet|antrag angenommen)\b/.test(t.trim()))return /befürwortet/.test(t)?'empfohlen':'beschlossen';
 const how=/einstimmig|ohne gegenstimme|einhellig/.test(t)?'einstimmig ':/mehrheitlich|mit mehrheit|stimmenmehrheit|[1-9]\d* (?:nein|gegenstimme)/.test(t)?'mit Mehrheit ':'';
 if(/empfohlen|empfiehlt|empfehlung/.test(t)&&!/beschlossen/.test(t))return how+'empfohlen';
 if(/beschlossen|zugestimmt|angenommen|genehmigt|erledigt/.test(t)||how)return how+'beschlossen';
 return null;
}

const R_SAME=/ungeändert|unverändert|ohne änderung/,R_CHANGED=/geändert|änderung|ergänz|mit maßgabe/;
const R_UNAN=/einstimmig|ohne gegenstimme|einhellig|einvernehmlich/,R_MAJ=/mehrheitlich|mit mehrheit|stimmenmehrheit|[1-9]\d* (?:nein|gegenstimme)/;
/** Wie abgestimmt wurde: 'unanimous' | 'majority' | null (Stimmenzahlen über outcomeOf, sonst die Wörter) */
export function voteOf(text){
 const t=String(text||'').toLowerCase();if(!t.trim()||NO_RESULT.test(t))return null;
 const o=outcomeOf(t)||'';
 return o.startsWith('einstimmig')||R_UNAN.test(t)?'unanimous':o.startsWith('mit Mehrheit')||R_MAJ.test(t)?'majority':null;
}
const CLASS={'abgelehnt':'rej','vertagt':'post','verwiesen':'post','zurückgezogen':'post'};
/** Ausgang für Social Media und Streitquote, stärkster zuerst: 'rej' | 'post' | 'unan' | 'maj' | 'ok' | null */
export function classifyResult(text){
 const o=outcomeOf(text);if(!o)return null;
 return CLASS[o]||(o.startsWith('einstimmig')?'unan':o.startsWith('mit Mehrheit')?'maj':'ok');
}
/** Abstimmung und Änderung am Beschlussvorschlag einer Station (plenara.X Beschlüsse) */
export function readResult(text){
 const t=String(text||'').toLowerCase();
 if(!t.trim()||NO_RESULT.test(t))return {vote:null,change:null};
 return {vote:voteOf(t),change:R_SAME.test(t)?'unchanged':R_CHANGED.test(t)?'changed':null};
}
