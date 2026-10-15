// plenara.X Fakten: welche Werte auf die Karte kommen (Server: plenara-x-query.mjs, Admin: admin-rule-texts.tsx)
/* plenara.X Fakten (view=fakten): Werte für die Karte, Farbe nach Richtung (hoch ist schlecht: rot, hoch ist gut: grün).
   Gezeigt nur ab 90 % gemessener Qualität (shared/rule-quality.json); die übrigen stehen bereit, bis sie das Ziel erreichen. */
export const MAP_FACTS=[['hebesatz','bad',true],['housing','amount',false],['budget','amount',true],['second_home_tax','bad',false],['amusement_tax','bad',false],['fee_rate','bad',true],['annual_result','good',true],['land_price','bad',true],
 ['kita_fee','bad',false],['dog_tax','bad',false],['plot_price','bad',false],['grant','good',false],['ee_power','good',false],
 ['waste_fee','bad',false],['plan_area','amount',false],['wind_count','amount',false],['road','amount',false]];
export const MAP_FACT_NAMES={hebesatz:'Hebesätze',fee_rate:'Wasser- und Abwassergebühren',annual_result:'Jahresergebnis',land_price:'Gewerbegrundstücke (€/m²)',housing:'Geplante Wohneinheiten',budget:'Haushalt je Einwohner',second_home_tax:'Zweitwohnungsteuer',amusement_tax:'Vergnügungssteuer',
 kita_fee:'Kita-Gebühren',dog_tax:'Hundesteuer',plot_price:'Wohnbauplätze (€/m²)',grant:'Zuschüsse',ee_power:'Wind und Solar (MW)',
 waste_fee:'Abfallgebühren',plan_area:'Fläche der Plangebiete (ha)',wind_count:'Windenergieanlagen',road:'Kosten im Straßenbau'};
