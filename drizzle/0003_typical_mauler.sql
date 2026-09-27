CREATE TABLE `article_analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`topic_id` text NOT NULL,
	`kind` text NOT NULL,
	`method` text NOT NULL,
	`input_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_article_analyses_topic_kind` ON `article_analyses` (`topic_id`,`kind`,`created_at`);