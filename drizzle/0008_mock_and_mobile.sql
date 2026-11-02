ALTER TABLE phone_otps ADD sent_at integer NOT NULL DEFAULT 0;
ALTER TABLE orders ADD is_mock integer NOT NULL DEFAULT 0;
ALTER TABLE orders ADD mock_method text;
ALTER TABLE products ADD city text NOT NULL DEFAULT 'Toshkent';
ALTER TABLE products ADD images text NOT NULL DEFAULT '[]';
CREATE TABLE cities(name text PRIMARY KEY, lat real NOT NULL, lng real NOT NULL);
INSERT INTO cities VALUES ('Toshkent',41.3111,69.2797),('Samarqand',39.6542,66.9597),('Buxoro',39.7681,64.4556),('Andijon',40.7821,72.3442),('Namangan',40.9983,71.6726),('Farg‘ona',40.3864,71.7864),('Nukus',42.4602,59.6166),('Qarshi',38.8606,65.789),('Termiz',37.2242,67.2783);
CREATE TABLE mobile_sessions(access_hash text PRIMARY KEY, refresh_hash text UNIQUE NOT NULL, owner text NOT NULL, access_expires integer NOT NULL, refresh_expires integer NOT NULL, family text NOT NULL);
CREATE INDEX mobile_owner ON mobile_sessions(owner);
CREATE TABLE notifications(id text PRIMARY KEY, owner text NOT NULL, kind text NOT NULL, entity text, created integer NOT NULL, read_at integer, UNIQUE(owner,kind,entity));
CREATE INDEX notification_owner ON notifications(owner,created DESC);
CREATE TABLE reports(id text PRIMARY KEY, reporter text NOT NULL, kind text NOT NULL CHECK(kind IN ('product','seller','review')), target text NOT NULL, reason text NOT NULL, status text NOT NULL DEFAULT 'pending', created integer NOT NULL);
CREATE INDEX reports_status ON reports(status,created);
CREATE TABLE change_version(id integer PRIMARY KEY CHECK(id=1), version integer NOT NULL DEFAULT 0);
INSERT INTO change_version VALUES(1,0);
CREATE INDEX products_market ON products(active,city,created DESC);
CREATE INDEX products_category ON products(active,category,price);
CREATE INDEX orders_product_status ON orders(product,status);
DROP TRIGGER payment_capture;
CREATE TRIGGER payment_capture AFTER UPDATE OF state ON payment_transactions WHEN NEW.state=2 AND OLD.state=1 BEGIN
 UPDATE orders SET payment_state=CASE WHEN is_mock=1 THEN 'test' ELSE 'paid' END,transaction_id=NEW.id,paid_at=NEW.performed,status='reserved',pickup_at=MIN(NEW.performed+1800000,(SELECT until FROM products WHERE id=orders.product)) WHERE id=NEW.order_id;
END;
CREATE TRIGGER notification_new_order AFTER INSERT ON orders BEGIN
 INSERT OR IGNORE INTO notifications VALUES(lower(hex(randomblob(16))),(SELECT owner FROM products WHERE id=NEW.product),'new_order',NEW.id,NEW.created,NULL);
END;
CREATE TRIGGER notification_order_paid AFTER UPDATE OF payment_state ON orders WHEN OLD.payment_state='unpaid' AND NEW.payment_state IN ('test','paid') BEGIN
 INSERT OR IGNORE INTO notifications VALUES(lower(hex(randomblob(16))),NEW.buyer,'paid',NEW.id,NEW.paid_at,NULL);
 INSERT OR IGNORE INTO notifications VALUES(lower(hex(randomblob(16))),(SELECT owner FROM products WHERE id=NEW.product),'paid',NEW.id,NEW.paid_at,NULL);
END;
CREATE TRIGGER notification_order_status AFTER UPDATE OF status ON orders WHEN NEW.status!=OLD.status AND NEW.status IN ('cancelled','collected','expired','payment_expired') BEGIN
 INSERT OR IGNORE INTO notifications VALUES(lower(hex(randomblob(16))),NEW.buyer,NEW.status,NEW.id,CAST(strftime('%s','now') AS INTEGER)*1000,NULL);
 INSERT OR IGNORE INTO notifications VALUES(lower(hex(randomblob(16))),(SELECT owner FROM products WHERE id=NEW.product),NEW.status,NEW.id,CAST(strftime('%s','now') AS INTEGER)*1000,NULL);
END;
CREATE TRIGGER notification_refund AFTER UPDATE OF payment_state ON orders WHEN NEW.payment_state='refunded' AND OLD.payment_state!='refunded' BEGIN
 INSERT OR IGNORE INTO notifications VALUES(lower(hex(randomblob(16))),NEW.buyer,'refunded',NEW.id,CAST(strftime('%s','now') AS INTEGER)*1000,NULL);
END;
CREATE TRIGGER notification_seller AFTER UPDATE OF verification ON users WHEN NEW.verification IN ('approved','rejected') AND NEW.verification!=OLD.verification BEGIN
 INSERT OR REPLACE INTO notifications VALUES(lower(hex(randomblob(16))),NEW.id,'seller_'||NEW.verification,NEW.id,CAST(strftime('%s','now') AS INTEGER)*1000,NULL);
END;
CREATE TRIGGER notification_review AFTER INSERT ON reviews BEGIN
 INSERT OR IGNORE INTO notifications VALUES(lower(hex(randomblob(16))),(SELECT owner FROM products WHERE id=NEW.product),'review',NEW.order_id,NEW.created,NULL);
END;
CREATE TRIGGER changes_products_insert AFTER INSERT ON products BEGIN UPDATE change_version SET version=version+1 WHERE id=1; END;
CREATE TRIGGER changes_products_update AFTER UPDATE ON products BEGIN UPDATE change_version SET version=version+1 WHERE id=1; END;
CREATE TRIGGER changes_products_delete AFTER DELETE ON products BEGIN UPDATE change_version SET version=version+1 WHERE id=1; END;
CREATE TRIGGER changes_orders_insert AFTER INSERT ON orders BEGIN UPDATE change_version SET version=version+1 WHERE id=1; END;
CREATE TRIGGER changes_orders_update AFTER UPDATE ON orders BEGIN UPDATE change_version SET version=version+1 WHERE id=1; END;
CREATE TRIGGER changes_orders_delete AFTER DELETE ON orders BEGIN UPDATE change_version SET version=version+1 WHERE id=1; END;
CREATE TRIGGER changes_users_insert AFTER INSERT ON users BEGIN UPDATE change_version SET version=version+1 WHERE id=1; END;
CREATE TRIGGER changes_users_update AFTER UPDATE ON users BEGIN UPDATE change_version SET version=version+1 WHERE id=1; END;
CREATE TRIGGER changes_users_delete AFTER DELETE ON users BEGIN UPDATE change_version SET version=version+1 WHERE id=1; END;
CREATE TRIGGER changes_reviews_insert AFTER INSERT ON reviews BEGIN UPDATE change_version SET version=version+1 WHERE id=1; END;
CREATE TRIGGER changes_reviews_update AFTER UPDATE ON reviews BEGIN UPDATE change_version SET version=version+1 WHERE id=1; END;
CREATE TRIGGER changes_reviews_delete AFTER DELETE ON reviews BEGIN UPDATE change_version SET version=version+1 WHERE id=1; END;
CREATE TRIGGER changes_notifications_insert AFTER INSERT ON notifications BEGIN UPDATE change_version SET version=version+1 WHERE id=1; END;
CREATE TRIGGER changes_notifications_update AFTER UPDATE ON notifications BEGIN UPDATE change_version SET version=version+1 WHERE id=1; END;
CREATE TRIGGER changes_notifications_delete AFTER DELETE ON notifications BEGIN UPDATE change_version SET version=version+1 WHERE id=1; END;
CREATE TRIGGER changes_reports_insert AFTER INSERT ON reports BEGIN UPDATE change_version SET version=version+1 WHERE id=1; END;
CREATE TRIGGER changes_reports_update AFTER UPDATE ON reports BEGIN UPDATE change_version SET version=version+1 WHERE id=1; END;
CREATE TRIGGER changes_reports_delete AFTER DELETE ON reports BEGIN UPDATE change_version SET version=version+1 WHERE id=1; END;
CREATE TABLE deletion_jobs(key text PRIMARY KEY, created integer NOT NULL);
CREATE TRIGGER account_delete_guard BEFORE DELETE ON app_accounts WHEN EXISTS(SELECT 1 FROM orders o JOIN products p ON p.id=o.product WHERE (o.buyer=OLD.owner OR p.owner=OLD.owner) AND (o.status IN ('pending_payment','reserved') OR o.payment_state IN ('refund_due','test_refund_due'))) BEGIN SELECT RAISE(ABORT,'active orders or refunds'); END;
CREATE TRIGGER deleted_seller_guard BEFORE INSERT ON products WHEN EXISTS(SELECT 1 FROM users WHERE id=NEW.owner AND role='deleted') BEGIN SELECT RAISE(ABORT,'account deleted'); END;
CREATE TRIGGER deleted_buyer_guard BEFORE INSERT ON orders WHEN EXISTS(SELECT 1 FROM users WHERE id=NEW.buyer AND role='deleted') BEGIN SELECT RAISE(ABORT,'account deleted'); END;
