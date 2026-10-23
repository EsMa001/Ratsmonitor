// Namen von Privatpersonen in Titeln nichtöffentlicher Punkte (Entscheidung des Projektinhabers, 24.10.2026): „Personalangelegenheit
// Herr Müller“, „Grundstücksverkauf an Familie Meier“, „Stundungsantrag der Eheleute Schulz“ → „Herr …“, „Familie …“, „Eheleute …“.
// Erkannt wird nur, was sich sicher als Person lesen lässt: eine Anrede oder Familie/Eheleute vor einem oder zwei großgeschriebenen
// Namen. Amtsträger in ihrer Funktion („Bürgermeister“), Firmen, Straßen und Orte bleiben. Reine Funktion.
const NAME="\\p{Lu}[\\p{Ll}'’]+(?:-\\p{Lu}[\\p{Ll}'’]+)*";
const PERSON=new RegExp(`(?<!\\p{L})(Herrn?|Frau|Familie|Eheleute|Ehepaar|Geschwister|Erbengemeinschaft)(\\s+(?:Dr\\.\\s*|Prof\\.\\s*)*)(?:${NAME})(?:\\s+(?:${NAME}))?`,'gu');
/** Titel ohne Namen von Privatpersonen */
export function withoutPrivateNames(title){
 return String(title||'').replace(PERSON,(m,who)=>`${who} …`).replace(/\s+/g,' ').trim();
}
