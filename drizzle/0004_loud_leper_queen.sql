CREATE TABLE `app_accounts` (
	`phone` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`password_hash` text NOT NULL,
	`phone_verified` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_accounts_owner_unique` ON `app_accounts` (`owner`);--> statement-breakpoint
CREATE TABLE `app_admin` (
	`id` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `app_sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`expires` integer NOT NULL,
	`admin_version` text
);
--> statement-breakpoint
CREATE TABLE `auth_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`n` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `phone_otps` (
	`owner` text PRIMARY KEY NOT NULL,
	`hash` text NOT NULL,
	`expires` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
INSERT INTO app_admin(id) SELECT id FROM users WHERE role='admin' ORDER BY created LIMIT 1;
--> statement-breakpoint
UPDATE users SET role='member' WHERE role='admin';
--> statement-breakpoint
DELETE FROM demo_wallet;
--> statement-breakpoint
UPDATE orders SET status='cancelled' WHERE provider='demo' AND status IN ('pending_payment','reserved');
