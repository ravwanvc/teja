CREATE TABLE `demo_wallet` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`brand` text NOT NULL,
	`last4` text NOT NULL,
	`expiry` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `image_checks` (
	`key` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`status` text NOT NULL,
	`note` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `products` ADD `image_status` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `image_note` text DEFAULT '' NOT NULL;