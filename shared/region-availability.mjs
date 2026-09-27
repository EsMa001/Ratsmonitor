/** Stored canonical articles across all dates; source configuration alone is not data. */
export function regionAvailability(coverage){
 return Object.fromEntries(coverage.map(c=>[c.regionId,{count:Math.max(0,Number(c.articleCount)||0),partial:!c.complete}]));
}
export function availabilityLabel(availability){
 if(!availability)return 'Datenstand unbekannt';
 if(!availability.count)return 'Noch keine Artikel';
 return availability.count.toLocaleString('de-DE')+' Artikel'+(availability.partial?' · Teilstand':'');
}
