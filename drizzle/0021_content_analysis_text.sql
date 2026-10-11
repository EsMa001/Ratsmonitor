-- Die KI-Zusammenfassung stand im Vorgang doppelt: in shortSummary/longSummary und noch einmal in contentAnalysis. Seit der
-- Übernahme ohne Text (shared/ai-job.mjs) trägt contentAnalysis nur die Angaben zur Analyse; der Text steht zusätzlich
-- vollständig in article_analyses (Art 'summary'). Gelesen wurde der Text aus contentAnalysis nirgends. Die Suchkarten
-- reagieren nicht auf diese Felder (Trigger aus 0019), nur die Datenstände und Gebietsstände zählen hoch.
UPDATE `topics` SET `payload`=json_remove(`payload`,'$.contentAnalysis.shortSummary','$.contentAnalysis.longSummary')
  WHERE json_type(`payload`,'$.contentAnalysis.shortSummary') IS NOT NULL OR json_type(`payload`,'$.contentAnalysis.longSummary') IS NOT NULL;
