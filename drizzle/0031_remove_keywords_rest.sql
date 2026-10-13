-- Stichwörter entfallen ganz (Entscheidung 13.10.2026). Payloads, Fassungen und Suchtexte sind seit 0019 frei davon; hier
-- gehen die übrigen Reste: der gespeicherte Zählstand der früheren Admin-Seite „Stichwörter“ (mit den Teilsummen eines
-- angefangenen Baus) und die alten KI-Stichwortanalysen in article_analyses (Index idx_article_analyses_kind_topic).
DELETE FROM `admin_agg` WHERE `build` IN (SELECT json_extract(`value`,'$.id') FROM `system_state` WHERE `key`='admin-build:keywords');
--> statement-breakpoint
DELETE FROM `system_state` WHERE `key`='admin-build:keywords' OR `key` GLOB 'admin-stored:keywords*';
--> statement-breakpoint
DELETE FROM `article_analyses` WHERE `kind`='keywords';
