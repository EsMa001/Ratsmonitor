// Angebundene Länder in Anzeigereihenfolge; id ist der Länderschlüssel (erste zwei Stellen des AGS).
// Eigenes Modul, damit Browserseiten die Länder kennen, ohne den Gebietskatalog zu laden.
export const LANDS=[{id:'05',name:'Nordrhein-Westfalen',short:'NRW'},{id:'03',name:'Niedersachsen',short:'Niedersachsen'}];
export const landName=id=>LANDS.find(l=>l.id===id)?.name||'Unbekanntes Land';
