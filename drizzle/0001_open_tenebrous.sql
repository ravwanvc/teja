CREATE TABLE `receipt_counters` (
	`kind` text PRIMARY KEY NOT NULL,
	`value` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_state` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `provider` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `deposit` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `receipt_no` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `paid_at` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `pickup_at` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `pickup_selected` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `hold_until` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `snapshot` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `terms_at` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `transaction_id` text;--> statement-breakpoint
DROP TRIGGER orders_restore;
--> statement-breakpoint
CREATE TRIGGER orders_restore AFTER UPDATE OF status ON orders WHEN OLD.status IN ('reserved','pending_payment') AND NEW.status IN ('cancelled','expired','payment_expired') BEGIN UPDATE products SET stock=stock+NEW.qty WHERE id=NEW.product; END;
--> statement-breakpoint
CREATE TRIGGER receipt_assign AFTER UPDATE OF payment_state ON orders WHEN OLD.payment_state='unpaid' AND NEW.payment_state IN ('paid','test') BEGIN INSERT INTO receipt_counters(kind,value) VALUES(NEW.payment_state,1) ON CONFLICT(kind) DO UPDATE SET value=value+1; UPDATE orders SET receipt_no=(SELECT value FROM receipt_counters WHERE kind=NEW.payment_state) WHERE id=NEW.id; END;
--> statement-breakpoint
CREATE UNIQUE INDEX payment_transaction_unique ON orders(transaction_id) WHERE transaction_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX orders_deadline ON orders(status,pickup_at);
