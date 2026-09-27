export const SOURCE_FILTERS=[{id:'data',name:'Mit Artikeln'},{id:'attention',name:'Handlungsbedarf'},{id:'partial',name:'Teilstände'},{id:'stale',name:'Seit 7 Tagen ohne Datenübernahme'},{id:'empty',name:'Konfiguriert, ohne Artikel'},{id:'all',name:'Alle 427 Gebiete'}];
export const REVIEW_FILTERS=[{id:'labels',name:'Label offen'},{id:'status',name:'Verfahrensstand unklar'},{id:'identity',name:'Widersprüchliche Zuordnung'},{id:'summaries',name:'Probleme bei der Textverarbeitung'}];
export function sourceHealth(coverage,count,now=new Date()){
 const configured=coverage.method!=='pending';
 const last=coverage.lastSuccessAt||coverage.importedAt||null;
 const stale=configured&&count>0&&(!last||!Number.isFinite(Date.parse(last))||Date.parse(last)<now.getTime()-7*86400000);
 const partial=count>0&&!coverage.complete;
 return {configured,stale,partial,lastSuccessAt:last,attention:configured&&(!count||partial||stale),state:!configured?'Nicht angebunden':!count?'Ohne Artikel':partial?'Teilstand':stale?'Datenstand älter':'Ohne gemeldete Lücke'};
}
export function filterAdminSources(rows,filter='data',query=''){
 const q=query.trim().toLocaleLowerCase('de-DE');
 return rows.filter(r=>(!q||[r.name,r.ags].join(' ').toLocaleLowerCase('de-DE').includes(q))&&(filter==='all'||filter==='data'&&r.count>0||filter==='attention'&&r.attention||filter==='partial'&&r.partial||filter==='stale'&&r.stale||filter==='empty'&&r.configured&&!r.count));
}
export function sourcesCsv(rows){
 const cell=value=>{let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 const data=[['Gebiet','Gemeindeschlüssel','Ebene','Artikel','Zustand','Datenübernahme','Letzter Versuch','Methode','Hinweise'],...rows.map(r=>[r.name,r.ags,r.kind==='city'?'Kommune':'Kreis',r.count,r.state,r.lastSuccessAt,r.lastAttemptAt,r.method,r.issues.join(' | ')])];
 return '\ufeff'+data.map(row=>row.map(cell).join(';')).join('\r\n');
}
