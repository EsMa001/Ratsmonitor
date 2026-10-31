-- Social-Videos je Themenvorschlag (31.10.2026, scripts/social-videos.mjs, server/integrations/social-videos.mjs):
-- Der Job „social-videos“ baut zu jedem Vorschlag des Social-Reiters genau ein Video aus dem Datenblatt des Berichts
-- (shared/social-video-sheet.mjs, scripts/social-video/auto.py, ohne KI) und löscht es, sobald der Vorschlag den Reiter verlässt.
-- Entschieden wird im Admin nur die Freigabe (released_at). Ändert sich das Datenblatt, entsteht das Video neu und die Freigabe
-- entfällt. Die Videodateien liegen außerhalb der Datenbank (RM_SOCIAL_VIDEOS); die Tabelle gehört nicht zur Übertragung.
CREATE TABLE IF NOT EXISTS `social_videos` (
  `topic_id` text PRIMARY KEY NOT NULL,
  `region_id` text NOT NULL,
  `title` text NOT NULL,
  `sheet_key` text NOT NULL,
  `state` text NOT NULL,
  `file` text,
  `seconds` real,
  `note` text,
  `made_at` text NOT NULL,
  `released_at` text,
  `released_by` text
);
