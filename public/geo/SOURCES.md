# Verwaltungsgrenzen

© BKG (2026), Datenlizenz Deutschland Namensnennung 2.0.
Lizenz: https://www.govdata.de/dl-de/by-2-0
Datenquellen: https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_vg_nuts.pdf

- Länder und alle 31 NRW-Kreise einschließlich Städteregion Aachen: https://sgx.geodatenzentrum.de/wfs_vg2500, Layer vg2500_lan und vg2500_krs, Stand 31.12.2024.
- 396 NRW-Städte und Gemeinden: https://sgx.geodatenzentrum.de/wfs_vg250, Layer vg250_gem, Filter sn_l=05; amtliche Gemeindeschlüssel im Katalog.
- Niedersachsen (Abruf 04.10.2026, `scripts/build-nds.mjs`): https://sgx.geodatenzentrum.de/wfs_vg250, Layer vg250_vwg (403 Einheits- und Samtgemeinden sowie kreisfreie Städte, ohne gemeindefreie Gebiete), vg250_krs (37 Landkreise einschließlich Region Hannover) und vg250_gem (Mitgliedsgemeinden der Samtgemeinden), jeweils Filter sn_l=03 und gf=4. Samtgemeinden führen den 9-stelligen Regionalschlüssel.
- Abruf NRW: 26.09.2026. Nur amtliche Grenzen; keine bundesweite politische Datenabdeckung.
- Veränderung: Auswahl der Gebiete, Umrechnung der WGS84-Koordinaten in eine equirektanguläre Kartenprojektion mit mittlerem Breitengrad 51,3°, Rundung der Bildschirmkoordinaten; Einfärbung und Interaktion durch vor Ort.

- Gemeindegeometrien sind für die Webdarstellung mit Ramer-Douglas-Peucker (0,22 Bildschirmkoordinaten) vereinfacht. Kreisfreie Städte sind auf Gemeindeebene enthalten, nicht doppelt als Kreise.
