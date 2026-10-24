// Namen von Privatpersonen in Titeln (Entscheidung des Projektinhabers, 24.10.2026; seit „Namen immer weg“ in jedem Bericht, ob
// öffentlich, unklar oder nichtöffentlich, zentral in collectRegion über withoutPrivateNamesDeep): „Personalangelegenheit
// Herr Müller“, „Grundstücksverkauf an Familie Meier“, „Stundungsantrag der Eheleute Schulz“ → „Herr …“, „Familie …“, „Eheleute …“.
// Erkannt wird nur, was sich sicher als Person lesen lässt: eine Anrede oder Familie/Eheleute vor einem oder zwei großgeschriebenen
// Namen. Amtsträger in ihrer Funktion („Bürgermeister“, auch „Herr Bürgermeister“), Firmen, Straßen und Orte bleiben. Reine Funktion.
const NAME="\\p{Lu}[\\p{Ll}'’]+(?:-\\p{Lu}[\\p{Ll}'’]+)*";
// Ein Amt nach der Anrede („Frau Bürgermeisterin“, „Herr Landrat“) ist kein Name.
const OFFICE='(?:Ober)?[Bb]ürgermeister|Landr(?:a|ä)t|Stadtr(?:a|ä)t|Gemeinder(?:a|ä)t|Kreisr(?:a|ä)t|Ortsvorsteher|Beigeordnete|Vorsitzende|Bürgerbeauftragte|Kämmerer|Amtsdirektor|Stadtdirektor|Dezernent|Präsident|Minister|Abgeordnete';
const PERSON=new RegExp(`(?<!\\p{L})(Herrn?|Frau|Familie|Eheleute|Ehepaar|Geschwister|Erbengemeinschaft)(\\s+(?:Dr\\.\\s*|Prof\\.\\s*)*)(?!${OFFICE})(?:${NAME})(?:\\s+(?:${NAME}))?`,'gu');
/** Titel ohne Namen von Privatpersonen */
export function withoutPrivateNames(title){
 return String(title||'').replace(PERSON,(m,who)=>`${who} …`).replace(/\s+/g,' ').trim();
}
/** Ein Bericht (oder ein Wert darin) ohne Namen von Privatpersonen in allen Texten; Adressen und Kennungen bleiben, Zeilen auch. */
const KEEP=new Set(['id','url','sourceUrl','identityLinks','regionId','accessUrl']);
export function withoutPrivateNamesDeep(value,key=''){
 if(typeof value==='string')return KEEP.has(key)?value:value.replace(PERSON,(m,who)=>`${who} …`);
 if(Array.isArray(value))return KEEP.has(key)?value:value.map(v=>withoutPrivateNamesDeep(v,key));
 if(value&&typeof value==='object'){const out={};for(const [k,v] of Object.entries(value))out[k]=withoutPrivateNamesDeep(v,k);return out;}
 return value;
}
