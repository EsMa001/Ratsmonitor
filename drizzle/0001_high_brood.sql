CREATE TABLE `article_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`topic_id` text NOT NULL,
	`captured_at` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_versions_topic` ON `article_versions` (`topic_id`,`captured_at`);--> statement-breakpoint
CREATE TABLE `source_coverage` (
	`region_id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `topics` ADD `region_id` text DEFAULT 'muenster' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_topics_region_updated` ON `topics` (`region_id`,`updated_at`);