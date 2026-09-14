CREATE TABLE `blog_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `blog_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_blog_sessions_user_expires` ON `blog_sessions` (`user_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `blog_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`role` text DEFAULT 'reader' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_login_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_blog_users_email` ON `blog_users` (`email`);