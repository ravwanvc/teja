import {freshness} from './partners.js';
import { capitalize } from "./format.js";
export async function growthData(db, me) {
  const favorites = me
    ? (
        await db
          .prepare("SELECT product FROM favorites WHERE user=?")
          .bind(me.id)
          .all()
      ).results.map((f) => f.product)
    : [];
  const reviews = (
    await db
      .prepare(
        `SELECT r.order_id,r.product,r.rating,r.comment,r.hidden,r.created FROM reviews r WHERE hidden=0 OR ?='admin' ORDER BY created DESC LIMIT 500`,
      )
      .bind(me?.role || "")
      .all()
  ).results;
  const sellers =
    me?.role === "admin"
      ? (
          await db
            .prepare(
              "SELECT id,name,verified,verification,business_name,business_contact,selling_paused FROM users WHERE role='seller' ORDER BY created DESC",
            )
            .all()
        ).results
      : [];
  let report = null;
  if (me && ["seller", "admin"].includes(me.role)) {
    report = await db
      .prepare(
        `SELECT COUNT(*) orders_count,COALESCE(SUM(CASE WHEN json_array_length(o.cart_items)>0 THEN (SELECT SUM(CAST(json_extract(value,'$.qty') AS INTEGER)) FROM json_each(o.cart_items)) ELSE o.qty END),0) units,COALESCE(SUM(o.price*o.qty),0) revenue,COALESCE(SUM(CASE WHEN o.provider='cash' AND o.payment_state!='refunded' THEN o.commission_due WHEN o.payment_state='paid' THEN o.deposit ELSE 0 END),0) commission FROM orders o JOIN products p ON p.id=o.product WHERE o.status='collected' AND COALESCE(o.provider,'')!='demo' AND o.is_mock=0 AND (p.owner=? OR ?='admin')`,
      )
      .bind(me.id, me.role)
      .first();
  }
  return { favorites, reviews, sellers, report };
}
export async function growthAction(db, me, b) {
  const fail = (m) => {
    throw Error(m);
  };
  const str = (v, max) =>
    typeof v === "string" && v.trim() && v.length <= max
      ? v.trim()
      : fail("Maydonlarni to‘g‘ri to‘ldiring");
  const int = (v, min, max) =>
    Number.isSafeInteger(Number(v)) && Number(v) >= min && Number(v) <= max
      ? Number(v)
      : fail("Son noto‘g‘ri");
  if (b.action === "favorite") {
    const p = await db
      .prepare("SELECT id FROM products WHERE id=?")
      .bind(str(b.id, 100))
      .first();
    if (!p) fail("Mahsulot topilmadi");
    const key = me.id + ":" + p.id;
    if (b.saved === true)
      await db
        .prepare(
          "INSERT OR IGNORE INTO favorites(id,user,product,created) VALUES(?,?,?,?)",
        )
        .bind(key, me.id, p.id, Date.now())
        .run();
    else if (b.saved === false)
      await db
        .prepare("DELETE FROM favorites WHERE id=? AND user=?")
        .bind(key, me.id)
        .run();
    else fail("Amal noto‘g‘ri");
    return { ok: true };
  }
  if (b.action === "review") {
    const o = await db
      .prepare(
        "SELECT o.*,p.owner FROM orders o JOIN products p ON p.id=o.product WHERE o.id=?",
      )
      .bind(str(b.id, 100))
      .first();
    if (
      !o ||
      o.buyer !== me.id ||
      o.status !== "collected" ||
      o.provider === "demo" ||
      o.owner === me.id
    )
      fail("Faqat o‘zingiz olgan haqiqiy buyurtmaga baho berishingiz mumkin");
    const prior = await db
      .prepare("SELECT order_id FROM reviews WHERE order_id=?")
      .bind(o.id)
      .first();
    if (prior) fail("Bu buyurtmaga baho berilgan");
    await db
      .prepare(
        "INSERT INTO reviews(order_id,product,buyer,rating,comment,created) VALUES(?,?,?,?,?,?)",
      )
      .bind(
        o.id,
        o.product,
        me.id,
        int(b.rating, 1, 5),
        str(b.comment, 1000),
        Date.now(),
      )
      .run();
    return { ok: true };
  }
  if (b.action === "moderateReview") {
    if (me.role !== "admin") fail("Faqat admin uchun");
    if (typeof b.hidden !== "boolean") fail("Amal noto‘g‘ri");
    await db
      .prepare("UPDATE reviews SET hidden=? WHERE order_id=?")
      .bind(b.hidden ? 1 : 0, str(b.id, 100))
      .run();
    return { ok: true };
  }
  if (b.action === "requestVerification") {
    if (me.verified) fail("Sotuvchi allaqachon tasdiqlangan");
    await db
      .prepare(
        "UPDATE users SET business_name=?,business_contact=?,verification='pending' WHERE id=? AND verified=0",
      )
      .bind(str(b.name, 100), str(b.contact, 150), me.id)
      .run();
    return { ok: true };
  }
  if (b.action === "verifySeller") {
    if (me.role !== "admin") fail("Faqat admin uchun");
    if (typeof b.approved !== "boolean") fail("Amal noto‘g‘ri");
    const changed = await db
      .prepare(
        "UPDATE users SET verified=?,verification=? WHERE id=? AND role='seller' AND verification!='none'",
      )
      .bind(
        b.approved ? 1 : 0,
        b.approved ? "approved" : "rejected",
        str(b.id, 100),
      )
      .run();
    if (!changed.meta.changes) fail("Ariza topilmadi");
    return { ok: true };
  }
  if (["editProduct", "restock"].includes(b.action)) {
    const p = await db
      .prepare("SELECT * FROM products WHERE id=?")
      .bind(str(b.id, 100))
      .first();
    if (!p || (p.owner !== me.id && me.role !== "admin"))
      fail("Bu mahsulotni boshqarishga ruxsat yo‘q");
    if (b.action === "restock") {
      const qty = int(b.qty, 1, 10000),
        key = str(b.requestId, 100);
      const prior = await db
        .prepare("SELECT actor,product FROM stock_events WHERE id=?")
        .bind(key)
        .first();
      if (prior) {
        if (prior.actor !== me.id || prior.product !== p.id)
          fail("So‘rov mos emas");
        return { ok: true };
      }
      if (p.until <= Date.now())
        fail("Avval mahsulotning yangi muddatini belgilang");
      await db
        .prepare(
          "INSERT INTO stock_events(id,product,actor,qty,created) VALUES(?,?,?,?,?)",
        )
        .bind(key, p.id, me.id, qty, Date.now())
        .run();
      return { ok: true };
    }
    const v = b.product,
      price = int(v.price, 100, 100000000),
      original = int(v.original, price + 1, 100000000),
      until = int(v.until, Date.now() + 60000, Date.now() + 30 * 86400000);
    const changed = await db
      .prepare(
        "UPDATE products SET title=?,price=?,original=?,until=?,allergens=?,storage=?,prepared_at=?,best_before=? WHERE id=? AND NOT EXISTS(SELECT 1 FROM orders WHERE product=? AND status IN ('reserved','pending_payment'))",
      )
      .bind(
        capitalize(str(v.title, 100)),
        price,
        original,
        until,
        str(v.allergens, 250),
        str(v.storage, 250),
        freshness(v,until).prepared,freshness(v,until).best,
        p.id,
        p.id,
      )
      .run();
    if (!changed.meta.changes)
      fail("Faol buyurtma bor. Avval uni topshiring yoki bekor qiling");
    return { ok: true };
  }
  return null;
}
