# Verwaltungsgrenzen

© GeoBasis-DE / BKG 2025, Datenlizenz Deutschland Namensnennung 2.0.
Lizenz: https://www.govdata.de/dl-de/by-2-0
Datenquellen: https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_vg_nuts.pdf

- Alle Karten (Suche, plenara.X, Lückenatlas, Abrufkarte der Administration, eigenständiger Atlas) zeichnen aus einer Datei: `public/data/de_map.json`, gebaut von `scripts/build-map.mjs` aus https://sgx.geodatenzentrum.de/wfs_vg250 (Layer vg250_gem, vg250_krs, vg250_lan, nur Landflächen gf=4), Stand 2025. Gemeinden, Kreise und Länder teilen sich die Grenzlinien; gemeindefreie Gebiete sind Gemeinden der Art 2.
- Flächen eines Gebiets des Katalogs: `shared/map-shapes.mjs` (Gemeinde, Gemeindeverband aus seinen Mitgliedsgemeinden, Kreis; kreisfreie Städte auf der Kreisebene mit eigener Kennung).
- `de-districts.json` (Kreise der Startseite) ist noch eine eigene, ältere Datei.
- Veränderung: Auswahl der Gebiete, Vereinfachung der Linien (Douglas-Peucker, 120 m), Rundung; Einfärbung und Interaktion durch Plenara.
