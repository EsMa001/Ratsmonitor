// Restposten („Sonstiges“, „Sonstige Leistungen“, „andere Flächen“, „Ohne Angabe“, „Noch nicht eingeordnet“) stehen in jeder Auswahl
// am Ende, auch wenn sie die meisten Treffer haben (Entscheidung 23.10.2026); die übrige Reihenfolge bleibt.
export const isRest=name=>/^(sonstig|andere\b|ohne angabe|noch nicht eingeordnet)/i.test(String(name??'').trim());
/** @template T @param {T[]} list @param {(x:T)=>string} nameOf */
export const restLast=(list,nameOf=x=>x.name)=>[...list.filter(x=>!isRest(nameOf(x))),...list.filter(x=>isRest(nameOf(x)))];
