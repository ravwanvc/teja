CREATE TABLE `payment_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`provider_id` text NOT NULL,
	`order_id` text NOT NULL,
	`amount` integer NOT NULL,
	`provider_time` integer NOT NULL,
	`created` integer NOT NULL,
	`performed` integer DEFAULT 0 NOT NULL,
	`cancelled` integer DEFAULT 0 NOT NULL,
	`state` integer DEFAULT 1 NOT NULL,
	`reason` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_transactions_order_id_unique` ON `payment_transactions` (`order_id`);--> statement-breakpoint
CREATE TABLE `saved_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`token` text NOT NULL,
	`number` text NOT NULL,
	`expiry` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saved_cards_token_unique` ON `saved_cards` (`token`);--> statement-breakpoint
CREATE TRIGGER payment_capture_guard BEFORE UPDATE OF state ON payment_transactions WHEN NEW.state=2 AND OLD.state=1 BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM orders o JOIN products p ON p.id=o.product WHERE o.id=NEW.order_id AND o.status='pending_payment' AND o.payment_state='unpaid' AND o.provider=NEW.provider AND o.deposit=NEW.amount AND o.hold_until>NEW.performed AND p.until>NEW.performed) THEN RAISE(ABORT,'payment expired or changed') END; END;
--> statement-breakpoint
CREATE TRIGGER payment_capture AFTER UPDATE OF state ON payment_transactions WHEN NEW.state=2 AND OLD.state=1 BEGIN UPDATE orders SET payment_state='paid',transaction_id=NEW.id,paid_at=NEW.performed,status='reserved',pickup_at=MIN(NEW.performed+1800000,(SELECT until FROM products WHERE id=orders.product)) WHERE id=NEW.order_id; END;
--> statement-breakpoint
CREATE TRIGGER payment_cancel_guard BEFORE UPDATE OF state ON payment_transactions WHEN NEW.state<0 AND OLD.state>0 BEGIN SELECT CASE WHEN EXISTS(SELECT 1 FROM orders WHERE id=NEW.order_id AND status='collected') THEN RAISE(ABORT,'already collected') END; END;
--> statement-breakpoint
CREATE TRIGGER payment_cancel AFTER UPDATE OF state ON payment_transactions WHEN NEW.state<0 AND OLD.state>0 BEGIN UPDATE orders SET status = CASE WHEN status IN ('pending_payment','reserved') THEN 'cancelled' ELSE status END , payment_state = CASE WHEN OLD.state=2 THEN 'refunded' ELSE payment_state END WHERE id=NEW.order_id; END;
