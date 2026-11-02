ALTER TABLE users ADD avatar text NOT NULL DEFAULT '';
ALTER TABLE orders ADD cart_items text NOT NULL DEFAULT '[]';
CREATE TABLE password_resets(token text PRIMARY KEY,phone text NOT NULL,expires integer NOT NULL);
CREATE TABLE shop_follows(owner text NOT NULL,seller text NOT NULL,hour integer NOT NULL DEFAULT 18,PRIMARY KEY(owner,seller));
CREATE TABLE waitlist(owner text NOT NULL,product text NOT NULL,created integer NOT NULL,PRIMARY KEY(owner,product));
CREATE TABLE quality_claims(id text PRIMARY KEY,order_id text UNIQUE NOT NULL,owner text NOT NULL,reason text NOT NULL,status text NOT NULL DEFAULT 'pending',reply text NOT NULL DEFAULT '',created integer NOT NULL,updated integer NOT NULL);
DROP TRIGGER orders_validate;
CREATE TRIGGER orders_validate BEFORE INSERT ON orders BEGIN
 SELECT CASE WHEN NEW.qty<1 OR NEW.qty!=CAST(NEW.qty AS INTEGER) THEN RAISE(ABORT,'invalid quantity') END;
 SELECT CASE WHEN json_array_length(NEW.cart_items)=0 AND NOT EXISTS(SELECT 1 FROM products WHERE id=NEW.product AND active=1 AND stock>=NEW.qty AND until>NEW.created AND price=NEW.price) THEN RAISE(ABORT,'stock unavailable') END;
 SELECT CASE WHEN json_array_length(NEW.cart_items)>0 AND (NEW.qty!=1 OR NEW.price!=(SELECT SUM(json_extract(value,'$.price')*json_extract(value,'$.qty')) FROM json_each(NEW.cart_items)) OR EXISTS(SELECT 1 FROM json_each(NEW.cart_items) j LEFT JOIN products p ON p.id=json_extract(j.value,'$.id') WHERE p.id IS NULL OR p.active!=1 OR p.stock<json_extract(j.value,'$.qty') OR json_extract(j.value,'$.qty')<1 OR p.price!=json_extract(j.value,'$.price') OR p.until<=NEW.created OR p.owner!=(SELECT owner FROM products WHERE id=NEW.product))) THEN RAISE(ABORT,'cart stock unavailable') END;
END;
DROP TRIGGER orders_deduct;
CREATE TRIGGER orders_deduct AFTER INSERT ON orders BEGIN
 UPDATE products SET stock=stock-NEW.qty WHERE id=NEW.product AND json_array_length(NEW.cart_items)=0;
 UPDATE products SET stock=stock-(SELECT json_extract(value,'$.qty') FROM json_each(NEW.cart_items) WHERE json_extract(value,'$.id')=products.id) WHERE id IN (SELECT json_extract(value,'$.id') FROM json_each(NEW.cart_items));
END;
DROP TRIGGER orders_restore;
CREATE TRIGGER orders_restore AFTER UPDATE OF status ON orders WHEN OLD.status IN ('reserved','pending_payment') AND NEW.status IN ('cancelled','expired','payment_expired') BEGIN
 UPDATE products SET stock=stock+NEW.qty WHERE id=NEW.product AND json_array_length(NEW.cart_items)=0;
 UPDATE products SET stock=stock+(SELECT json_extract(value,'$.qty') FROM json_each(NEW.cart_items) WHERE json_extract(value,'$.id')=products.id) WHERE id IN (SELECT json_extract(value,'$.id') FROM json_each(NEW.cart_items));
END;
CREATE TRIGGER waitlist_available AFTER UPDATE OF stock ON products WHEN OLD.stock=0 AND NEW.stock>0 AND NEW.active=1 AND NEW.until>CAST(strftime('%s','now') AS INTEGER)*1000 BEGIN
 INSERT OR REPLACE INTO notifications(id,owner,kind,entity,created) SELECT lower(hex(randomblob(16))),owner,'available',NEW.id,CAST(strftime('%s','now') AS INTEGER)*1000 FROM waitlist WHERE product=NEW.id;
 DELETE FROM waitlist WHERE product=NEW.id;
END;
CREATE TRIGGER cart_pickup_deadline AFTER UPDATE OF status ON orders WHEN NEW.status='reserved' AND json_array_length(NEW.cart_items)>0 BEGIN
 UPDATE orders SET pickup_at=MIN(pickup_at,(SELECT MIN(json_extract(value,'$.until')) FROM json_each(NEW.cart_items))) WHERE id=NEW.id;
END;
