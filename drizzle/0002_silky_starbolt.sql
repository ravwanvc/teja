CREATE TABLE `favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`product` text NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`product`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`order_id` text PRIMARY KEY NOT NULL,
	`product` text NOT NULL,
	`buyer` text NOT NULL,
	`rating` integer NOT NULL,
	`comment` text NOT NULL,
	`hidden` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `stock_events` (
	`id` text PRIMARY KEY NOT NULL,
	`product` text NOT NULL,
	`actor` text NOT NULL,
	`qty` integer NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`product`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `users` ADD `verified` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `verification` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `business_name` text;--> statement-breakpoint
ALTER TABLE `users` ADD `business_contact` text;--> statement-breakpoint
CREATE TRIGGER restock_valid BEFORE INSERT ON stock_events BEGIN SELECT CASE WHEN NEW.qty<1 OR NEW.qty!=CAST(NEW.qty AS INTEGER) OR (SELECT stock FROM products WHERE id=NEW.product)+NEW.qty>10000 THEN RAISE(ABORT,'invalid stock addition') END; END;
--> statement-breakpoint
CREATE TRIGGER restock_add AFTER INSERT ON stock_events BEGIN UPDATE products SET stock=stock+NEW.qty WHERE id=NEW.product; END;
--> statement-breakpoint
CREATE INDEX favorites_user ON favorites(user);
--> statement-breakpoint
CREATE INDEX reviews_product ON reviews(product,hidden);
