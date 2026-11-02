ALTER TABLE users ADD COLUMN selling_paused INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE products ADD COLUMN prepared_at INTEGER;
--> statement-breakpoint
ALTER TABLE products ADD COLUMN best_before INTEGER;
--> statement-breakpoint
ALTER TABLE orders ADD COLUMN partner_id TEXT;
--> statement-breakpoint
ALTER TABLE orders ADD COLUMN commission_rate INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE orders ADD COLUMN commission_due INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE partner_businesses(id TEXT PRIMARY KEY,owner TEXT UNIQUE,name TEXT NOT NULL,contact TEXT NOT NULL,address TEXT NOT NULL,rate_bps INTEGER NOT NULL CHECK(rate_bps BETWEEN 0 AND 10000),enabled INTEGER NOT NULL DEFAULT 1,created INTEGER NOT NULL,updated INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE partner_ledger(id TEXT PRIMARY KEY,partner_id TEXT NOT NULL REFERENCES partner_businesses(id),kind TEXT NOT NULL CHECK(kind IN ('commission','settlement','refund')),amount INTEGER NOT NULL,order_id TEXT,actor TEXT,reference TEXT NOT NULL DEFAULT '',created INTEGER NOT NULL,UNIQUE(kind,order_id));
--> statement-breakpoint
CREATE INDEX partner_ledger_partner ON partner_ledger(partner_id,created);
--> statement-breakpoint
CREATE TABLE admin_events(id TEXT PRIMARY KEY,actor TEXT NOT NULL,target TEXT NOT NULL,action TEXT NOT NULL,note TEXT NOT NULL,created INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE refund_records(order_id TEXT PRIMARY KEY REFERENCES orders(id),amount INTEGER NOT NULL,actor TEXT NOT NULL,reference TEXT NOT NULL,created INTEGER NOT NULL);
--> statement-breakpoint
CREATE TRIGGER cash_order_validate BEFORE INSERT ON orders WHEN NEW.provider='cash' BEGIN
 SELECT CASE WHEN (SELECT COUNT(*) FROM orders WHERE buyer=NEW.buyer AND provider='cash' AND status='reserved')>=3 THEN RAISE(ABORT,'cash reservation limit') END;
 SELECT CASE WHEN NEW.status!='reserved' OR NEW.payment_state!='cash_due' OR NEW.deposit!=0 OR NOT EXISTS(SELECT 1 FROM partner_businesses b JOIN products p ON p.owner=b.owner JOIN users u ON u.id=b.owner WHERE b.id=NEW.partner_id AND p.id=NEW.product AND b.enabled=1 AND u.selling_paused=0 AND NEW.commission_rate=b.rate_bps AND NEW.commission_due=CAST((NEW.price*NEW.qty*b.rate_bps+9999)/10000 AS INTEGER)) THEN RAISE(ABORT,'cash partner unavailable') END;
END;
--> statement-breakpoint
CREATE TRIGGER cash_receipt AFTER INSERT ON orders WHEN NEW.provider='cash' BEGIN
 INSERT OR IGNORE INTO receipt_counters(kind,value) VALUES('cash',0);
 UPDATE receipt_counters SET value=value+1 WHERE kind='cash';
 UPDATE orders SET receipt_no='C-'||(SELECT value FROM receipt_counters WHERE kind='cash') WHERE id=NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER cash_commission AFTER UPDATE OF status ON orders WHEN OLD.status='reserved' AND NEW.status='collected' AND NEW.provider='cash' BEGIN
 SELECT CASE WHEN NEW.payment_state!='cash_paid' THEN RAISE(ABORT,'cash confirmation required') END;
 INSERT INTO partner_ledger(id,partner_id,kind,amount,order_id,actor,created) VALUES('sale-'||NEW.id,NEW.partner_id,'commission',NEW.commission_due,NEW.id,(SELECT owner FROM products WHERE id=NEW.product),NEW.paid_at);
END;
--> statement-breakpoint
CREATE TRIGGER refund_record_apply AFTER INSERT ON refund_records BEGIN
 UPDATE orders SET payment_state='refunded' WHERE id=NEW.order_id AND payment_state IN ('refund_due','cash_refund_due');
 INSERT INTO partner_ledger(id,partner_id,kind,amount,order_id,actor,reference,created) SELECT 'refund-'||o.id,o.partner_id,'refund',-o.commission_due,o.id,NEW.actor,NEW.reference,NEW.created FROM orders o WHERE o.id=NEW.order_id AND o.provider='cash' AND EXISTS(SELECT 1 FROM partner_ledger WHERE order_id=o.id AND kind='commission');
 INSERT OR IGNORE INTO notifications(id,owner,kind,entity,created) SELECT 'refund-record-'||id,buyer,'refunded',id,NEW.created FROM orders WHERE id=NEW.order_id;
END;
--> statement-breakpoint
CREATE TRIGGER orders_seller_available BEFORE INSERT ON orders BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM products p JOIN users u ON p.owner=u.id WHERE p.id=NEW.product AND (u.selling_paused=1 OR (p.best_before IS NOT NULL AND p.best_before<=NEW.created))) OR EXISTS(SELECT 1 FROM json_each(COALESCE(NEW.cart_items,'[]')) j JOIN products p ON p.id=json_extract(j.value,'$.id') JOIN users u ON u.id=p.owner WHERE u.selling_paused=1 OR (p.best_before IS NOT NULL AND p.best_before<=NEW.created)) THEN RAISE(ABORT,'seller or food unavailable') END;
END;
--> statement-breakpoint
CREATE TABLE reminder_preferences(owner TEXT PRIMARY KEY,sms INTEGER NOT NULL DEFAULT 0,updated INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE reminder_deliveries(order_id TEXT PRIMARY KEY,state TEXT NOT NULL,provider_id TEXT,error TEXT,created INTEGER NOT NULL,updated INTEGER NOT NULL);
