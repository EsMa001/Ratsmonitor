// plenara.X Fakten: welche Werte auf die Karte kommen (Server: plenara-x-query.mjs, Admin: admin-rule-texts.tsx)
/* plenara.X Fakten (view=fakten): Werte für die Karte, Farbe nach Richtung (hoch ist schlecht: rot, hoch ist gut: grün).
   Gezeigt nur ab 90 % gemessener Qualität (shared/rule-quality.json) und Werten für mindestens 10 % der Gemeinden (seit 17.10.2026: Hebesatz, Wassergebühr, Jahresergebnis); die übrigen stehen bereit, bis sie das Ziel erreichen. */
export const MAP_FACTS=[['hebesatz','bad',true],['housing','amount',false],['budget','amount',false],['second_home_tax','bad',false],['amusement_tax','bad',false],['fee_rate','bad',true],['annual_result','good',true],['land_price','bad',false],
 ['kita_fee','bad',false],['dog_tax','bad',false],['plot_price','bad',false],['grant','good',false],['ee_power','good',false],
 ['waste_fee','bad',false],['plan_area','amount',false],['wind_count','amount',false],['road','amount',false]];
export const MAP_FACT_NAMES={hebesatz:'Hebesätze',fee_rate:'Wasser- und Abwassergebühren',annual_result:'Jahresergebnis',land_price:'Gewerbegrundstücke (€/m²)',housing:'Geplante Wohneinheiten',budget:'Haushalt je Einwohner',second_home_tax:'Zweitwohnungsteuer',amusement_tax:'Vergnügungssteuer',
 kita_fee:'Kita-Gebühren',dog_tax:'Hundesteuer',plot_price:'Wohnbauplätze (€/m²)',grant:'Zuschüsse',ee_power:'Wind und Solar (MW)',
 waste_fee:'Abfallgebühr (120-l-Tonne)',plan_area:'Fläche der Plangebiete (ha)',wind_count:'Windenergieanlagen',road:'Kosten im Straßenbau'};
