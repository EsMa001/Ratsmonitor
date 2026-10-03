CREATE TABLE `ai_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`topic_id` text NOT NULL,
	`region_id` text NOT NULL,
	`method` text NOT NULL,
	`agent` text NOT NULL,
	`model` text NOT NULL,
	`kinds` text NOT NULL,
	`created_at` text NOT NULL,
	`outcome` text NOT NULL,
	`token_basis` text NOT NULL,
	`source_count` integer,
	`attachment_count` integer,
	`word_count` integer,
	`input_tokens` integer,
	`output_tokens` integer,
	`cached_tokens` integer,
	`total_tokens` integer,
	`summary_prompt_tokens` integer,
	`summary_completion_tokens` integer,
	`summary_cached_tokens` integer,
	`check_prompt_tokens` integer,
	`check_completion_tokens` integer,
	`check_cached_tokens` integer
);
--> statement-breakpoint
CREATE INDEX `idx_ai_usage_topic` ON `ai_usage` (`topic_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_ai_usage_model` ON `ai_usage` (`method`,`model`);