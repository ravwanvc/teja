CREATE TABLE `geo` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`buyer` text NOT NULL,
	`product` text NOT NULL,
	`qty` integer NOT NULL,
	`price` integer NOT NULL,
	`code` text NOT NULL,
	`status` text NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`product`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`shop` text NOT NULL,
	`category` text NOT NULL,
	`image` text NOT NULL,
	`price` integer NOT NULL,
	`original` integer NOT NULL,
	`stock` integer NOT NULL,
	`address` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`allergens` text NOT NULL,
	`storage` text NOT NULL,
	`until` integer NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER orders_validate BEFORE INSERT ON orders BEGIN SELECT CASE WHEN NEW.qty < 1 OR NEW.qty != CAST(NEW.qty AS INTEGER) OR NOT EXISTS(SELECT 1 FROM products WHERE id=NEW.product AND active=1 AND stock>=NEW.qty AND until>NEW.created AND price=NEW.price) THEN RAISE(ABORT,'stock unavailable') END; END;
--> statement-breakpoint
CREATE TRIGGER orders_deduct AFTER INSERT ON orders BEGIN UPDATE products SET stock=stock-NEW.qty WHERE id=NEW.product; END;
--> statement-breakpoint
CREATE TRIGGER orders_restore AFTER UPDATE OF status ON orders WHEN OLD.status='reserved' AND NEW.status='cancelled' BEGIN UPDATE products SET stock=stock+NEW.qty WHERE id=NEW.product; END;
--> statement-breakpoint
CREATE INDEX orders_buyer ON orders(buyer);
--> statement-breakpoint
CREATE INDEX products_owner ON products(owner);
