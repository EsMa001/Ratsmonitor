// Länder des Gebietskatalogs; id ist der Länderschlüssel (erste zwei Stellen des AGS).
// Eigenes Modul, damit Browserseiten die Länder kennen, ohne den Gebietskatalog zu laden.
// Alle 16 Länder für Auswahl und Karte der Administration: NRW und Niedersachsen zuerst, dann nach Namen.
export const ALL_LANDS=[{id:'05',name:'Nordrhein-Westfalen',short:'NRW'},{id:'03',name:'Niedersachsen',short:'Niedersachsen'},...[['08','Baden-Württemberg'],['09','Bayern'],['11','Berlin'],['12','Brandenburg'],['04','Bremen'],['02','Hamburg'],['06','Hessen'],['13','Mecklenburg-Vorpommern'],['07','Rheinland-Pfalz'],['10','Saarland'],['14','Sachsen'],['15','Sachsen-Anhalt'],['01','Schleswig-Holstein'],['16','Thüringen']].map(([id,name])=>({id,name,short:name}))];
// Länder, in denen die Quellensuche gelaufen ist (scripts/source-discovery): Dort sagt der Katalog, welche Gebiete
// lesbar sind. Berlin und Hamburg stehen als je ein Gebiet im Katalog, ihre Bezirke mit eigenen Vertretungen noch nicht;
// dort gilt weiter die Stichprobe der Hochrechnung.
export const LANDS=ALL_LANDS.filter(l=>l.id!=='11'&&l.id!=='02');
export const landName=id=>ALL_LANDS.find(l=>l.id===id)?.name||'Unbekanntes Land';
