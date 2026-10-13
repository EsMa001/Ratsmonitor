CREATE TABLE `ai_work_items` (
  `topic_id` text PRIMARY KEY NOT NULL,
  `input_hash` text NOT NULL,
  `state` text NOT NULL,
  `agent` text,
  `claim_token` text,
  `lease_expires_at` integer,
  `attempts` integer DEFAULT 0 NOT NULL,
  `last_error` text,
  `read_state` text DEFAULT '{}' NOT NULL,
  `updated_at` text NOT NULL,
  `last_result_token` text,
  `last_result_hash` text,
  `last_receipt` text
);
--> statement-breakpoint
CREATE INDEX `idx_ai_work_items_state` ON `ai_work_items` (`state`,`lease_expires_at`);
--> statement-breakpoint
CREATE INDEX `idx_topics_ai_local_date` ON `topics` (`event_date` DESC,`id`) WHERE `active`=1;
--> statement-breakpoint
CREATE INDEX `idx_topics_ai_local_region_date` ON `topics` (`region_id`,`event_date` DESC,`id`) WHERE `active`=1;
