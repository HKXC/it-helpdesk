ALTER TABLE `accounts` ADD `locale` text DEFAULT 'th' NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts` ADD `theme` text DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts` ADD `onboarding_completed` integer DEFAULT 0 NOT NULL;