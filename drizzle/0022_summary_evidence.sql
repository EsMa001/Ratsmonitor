-- summaryEvidence wiederholte die Zitate aus contentAnalysis.evidence (dort mit Adresse); gelesen wurde es im Vorgang nirgends.
-- Neue Zusammenfassungen schreiben es nicht mehr. Entfernt wird es nur, wo contentAnalysis.evidence vorhanden ist; sonst
-- bleibt es als einzige Kopie der Belege stehen. Suchkarten reagieren nicht auf das Feld.
UPDATE `topics` SET `payload`=json_remove(`payload`,'$.summaryEvidence')
  WHERE json_type(`payload`,'$.summaryEvidence') IS NOT NULL AND json_type(`payload`,'$.contentAnalysis.evidence')='array';
