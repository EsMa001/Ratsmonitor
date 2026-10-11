// Datum der Suchkarte „Stand heute“ (drizzle/0024): letzte Sitzung bis heute, next_date die nächste anstehende.
// Ist next_date vorbei, rückt das Datum nach. Aufgerufen nach jedem Metadaten-Import (server/services/sync.ts) und in
// scripts/refresh-search-words.mjs (Dev-Start, nachts per Cron); meist ändert sich nichts (Teilindex idx_search_cards_next).
// Das Gremium bleibt das des Vorgangs (letzte Sitzung, auch eine künftige; Entscheidung 11.10.2026), der Suchtext ändert sich nicht.
// Dieselben Ausdrücke stehen in drizzle/0024 (Trigger und Nachfüllen); tests/search-card-dates.test.mjs prüft das.
const DAY="substr(json_extract(e.value,'$.date'),1,10)";
const events=(cmp)=>`FROM topics t,json_each(t.payload,'$.events') e WHERE t.id=search_cards.id AND ${DAY}${cmp}date('now')`;
export const PAST_SQL=`(SELECT max(${DAY}) ${events('<=')})`;
export const NEXT_SQL=`(SELECT min(${DAY}) ${events('>')})`;

/** Rückt Karten nach, deren nächste Sitzung erreicht ist. Gibt die Zahl der geänderten Karten zurück, null ohne Migration 0024. */
export async function rollCardDates(db){
 let changes;
 try{
  const r=await db.prepare(`UPDATE search_cards SET date=COALESCE(${PAST_SQL},date),next_date=${NEXT_SQL} WHERE next_date IS NOT NULL AND next_date<=date('now')`).run();
  changes=Number(r?.meta?.changes??0);
 }catch{return null;/* Spalte next_date fehlt: wie vorher */}
 // Geänderte Daten: Zwischenspeicher und Blättern lesen neu (wie bei jeder Änderung an den Karten)
 if(changes)await db.prepare("UPDATE data_revisions SET revision=revision+1 WHERE id IN ('search','content')").run().catch(()=>{});
 return changes;
}
