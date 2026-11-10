CREATE TABLE `role_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`target_id` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `it_tickets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`requester_id` text NOT NULL,
	`assignee_id` text,
	`body` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`legacy_key` text,
	FOREIGN KEY (`requester_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assignee_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `it_tickets_legacy_key_unique` ON `it_tickets` (`legacy_key`);--> statement-breakpoint
ALTER TABLE `accounts` ADD `role` text DEFAULT 'employee' NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts` ADD `active` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts` ADD `version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts` ADD `legacy_migrated` integer DEFAULT 0 NOT NULL;