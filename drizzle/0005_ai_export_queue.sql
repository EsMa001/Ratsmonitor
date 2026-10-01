CREATE TABLE `ai_dispatches` (
	`topic_id` text NOT NULL,
	`kind` text NOT NULL,
	`exported_at` integer NOT NULL,
	PRIMARY KEY(`topic_id`, `kind`)
);
--> statement-breakpoint
CREATE TABLE `ai_job_articles` (
	`job_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`position` integer NOT NULL,
	`payload` text NOT NULL,
	`applied` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`job_id`, `topic_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_ai_job_articles_position` ON `ai_job_articles` (`job_id`,`position`);