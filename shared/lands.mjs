// Angebundene Länder in Anzeigereihenfolge; id ist der Länderschlüssel (erste zwei Stellen des AGS).
// Eigenes Modul, damit Browserseiten die Länder kennen, ohne den Gebietskatalog zu laden.
// Angebunden heißt: Die Quellensuche ist für das Land gelaufen; der Katalog sagt dort, welche Gebiete lesbar sind.
export const LANDS=[{id:'05',name:'Nordrhein-Westfalen',short:'NRW'},{id:'03',name:'Niedersachsen',short:'Niedersachsen'}];
// Alle 16 Länder des Gebietskatalogs, für Auswahl und Karte der Administration: zuerst die angebundenen, dann nach Namen.
export const ALL_LANDS=[...LANDS,...[['08','Baden-Württemberg'],['09','Bayern'],['11','Berlin'],['12','Brandenburg'],['04','Bremen'],['02','Hamburg'],['06','Hessen'],['13','Mecklenburg-Vorpommern'],['07','Rheinland-Pfalz'],['10','Saarland'],['14','Sachsen'],['15','Sachsen-Anhalt'],['01','Schleswig-Holstein'],['16','Thüringen']].map(([id,name])=>({id,name,short:name}))];
export const landName=id=>ALL_LANDS.find(l=>l.id===id)?.name||'Unbekanntes Land';
