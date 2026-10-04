// Umkreisfilter der Suche als Parameter der Anfrage. Ohne Serverabhängigkeit: Suchseite und Tests verwenden dieselbe Regel.
/** Kartenschlüssel eines Gebiets: seine Gemeinden (Mitglieder eines Verbands, frühere Schlüssel nach einer Fusion) oder der Kreis selbst. */
export const areaKeys=r=>r.kind==='district'?[r.ags]:r.members?r.members.map(m=>m.ags):r.formerAgs??[r.ags];
/**
 * Der Katalog nennt jedes Gebiet Deutschlands, Berichte gibt es nur für einen Teil. Gesendet werden deshalb nur Gebiete
 * mit Berichten, und zwar die kürzere Liste: die Gebiete im Umkreis ('within') oder die außerhalb ('without').
 * regions: Gebiete der gewählten Ebene; inside: Kartenschlüssel im Umkreis; stocked: Kartenschlüssel mit Berichten,
 * oder null, solange sie nicht bekannt sind (dann zählt jedes Gebiet).
 * Ergebnis: [Name des Parameters, Schlüssel der Gebiete durch Komma getrennt].
 */
export function radiusParam(regions,inside,stocked){
 const withReports=stocked?regions.filter(r=>areaKeys(r).some(key=>stocked.has(key))):regions,hit=withReports.filter(r=>areaKeys(r).some(key=>inside.has(key)));
 if(hit.length*2<=withReports.length)return ['within',hit.map(r=>r.ags).join(',')];
 const within=new Set(hit);
 return ['without',withReports.filter(r=>!within.has(r)).map(r=>r.ags).join(',')];
}
