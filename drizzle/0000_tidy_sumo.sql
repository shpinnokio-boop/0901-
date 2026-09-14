CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`author_id` text NOT NULL,
	`author_email` text NOT NULL,
	`author_name` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`content` text NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_posts_author_updated` ON `posts` (`author_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_posts_status_created` ON `posts` (`status`,`created_at`);