CREATE TABLE `card_charges` (
	`order_id` text PRIMARY KEY NOT NULL,
	`card_id` text NOT NULL,
	`receipt_id` text,
	`status` text DEFAULT 'creating' NOT NULL,
	`paid_at` integer,
	`updated` integer NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `card_charges_receipt_id_unique` ON `card_charges` (`receipt_id`);--> statement-breakpoint
CREATE TRIGGER card_charge_owner BEFORE INSERT ON card_charges BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM orders o JOIN saved_cards c ON c.id=NEW.card_id AND c.owner=o.buyer WHERE o.id=NEW.order_id AND o.provider='card' AND o.status='pending_payment' AND o.payment_state='unpaid') THEN RAISE(ABORT,'card order mismatch') END; END;
--> statement-breakpoint
CREATE TRIGGER card_payment_in_progress BEFORE UPDATE OF status ON orders WHEN OLD.status='pending_payment' AND NEW.status IN ('cancelled','expired','payment_expired') AND EXISTS(SELECT 1 FROM card_charges c WHERE c.order_id=OLD.id AND c.status='paying') BEGIN SELECT RAISE(ABORT,'Karta to‘lovi tekshirilmoqda. Avval provayder holatini tekshiring.'); END;
--> statement-breakpoint
CREATE TRIGGER card_capture_guard BEFORE UPDATE OF status ON card_charges WHEN NEW.status='paid' AND OLD.status='paying' BEGIN SELECT CASE WHEN NEW.receipt_id IS NULL OR NEW.paid_at IS NULL OR NOT EXISTS(SELECT 1 FROM orders WHERE id=NEW.order_id AND status='pending_payment' AND payment_state='unpaid' AND provider='card') THEN RAISE(ABORT,'card payment state changed') END; END;
--> statement-breakpoint
CREATE TRIGGER card_capture AFTER UPDATE OF status ON card_charges WHEN NEW.status='paid' AND OLD.status='paying' BEGIN UPDATE orders SET payment_state='paid',transaction_id='subscribe:'||NEW.receipt_id,paid_at=NEW.paid_at,status='reserved',pickup_at=MIN(NEW.updated+1800000,(SELECT until FROM products WHERE id=orders.product)) WHERE id=NEW.order_id; UPDATE orders SET status='cancelled',payment_state='refund_due' WHERE id=NEW.order_id AND (SELECT until FROM products WHERE id=orders.product)<=NEW.updated; END;
