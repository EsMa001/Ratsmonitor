// Von Hand geprüfte Gruppen von Katalog-Gebieten, die zum selben gemeinsamen System (Samtgemeinde, Verbandsgemeinde,
// Amt, Verwaltungsgemeinschaft) gehören, aber als eigene Katalogeinträge geführt werden (z. B. Baden-Württemberg,
// wo jede Mitgliedsgemeinde eine eigene Katalog-ID hat statt die Verwaltungsgemeinschaft eine eigene). Ist ein
// Gebiet einer Gruppe angebunden, gilt die ganze Gruppe für die Kennzahl „Einwohner erreicht (inkl. VG)“ als
// erreicht, auch wenn die übrigen Gebiete keine eigene, gelesene Quelle haben. Nur Fälle aufnehmen, die bestätigt
// zum selben System gehören (Gremiennamen oder Betreiber geprüft) – nicht aufgrund eines gemeinsam genutzten
// Hosting-Anbieters (z. B. ris-portal.de, gremien.info bedienen viele fremde Gemeinden auf einer Plattform).
export const VG_GROUPS=[
 // Verwaltungsgemeinschaft Stadtprozelten (SessionNet, http://buergerinfo-stadtprozelten.de/): angebunden ist nur
 // der Stadtrat Stadtprozelten (organizations.include); Faulbach ist Mitglied desselben Systems, aber ungelesen.
 ['de-096765632','de-09676124'],
];
