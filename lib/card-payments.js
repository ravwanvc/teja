import { cardsConfigured, subscribe } from "./payme-subscribe.js";
export const cardPaymentsConfigured = (e) =>
  cardsConfigured(e) && e.SUBSCRIBE_PAYMENTS_READY === "true";
const note =
  "Karta to‘lovi tekshirilmoqda. Qayta pul yechishga urinilmaydi. Buyurtmalarim bo‘limida holatni tekshiring.";
const pending = (id) => ({
  ok: true,
  id,
  cardPayment: "pending",
  message: note,
});
const row = (db, id) =>
  db.prepare("SELECT * FROM card_charges WHERE order_id=?").bind(id).first();
async function getOrder(db, id) {
  return db
    .prepare(
      "SELECT o.*,p.until FROM orders o JOIN products p ON p.id=o.product WHERE o.id=?",
    )
    .bind(id)
    .first();
}
function validateReceipt(e, r, o, receiptId) {
  const account = Array.isArray(r?.account)
    ? r.account.find((a) => a.name === "order_id")?.value
    : r?.account?.order_id;
  if (
    !r ||
    typeof r._id !== "string" ||
    r._id.length > 100 ||
    (receiptId && r._id !== receiptId) ||
    r.amount !== o.deposit * 100 ||
    String(account) !== o.id ||
    r.merchant?._id !== e.PAYME_SUBSCRIBE_ID ||
    (r.currency !== undefined && r.currency !== 860)
  )
    throw Error("Provayder javobi buyurtmaga mos emas");
}
async function outcome(e, o, c, r) {
  validateReceipt(e, r, o, c.receipt_id);
  if (r.state === 4) {
    if (
      !Number.isSafeInteger(r.pay_time) ||
      r.pay_time < o.created - 60000 ||
      r.pay_time > Date.now() + 60000
    )
      throw Error("To‘lov vaqti noto‘g‘ri");
    await e.DB.prepare(
      "UPDATE card_charges SET status='paid',paid_at=?,updated=? WHERE order_id=? AND status='paying'",
    )
      .bind(r.pay_time, Date.now(), o.id)
      .run();
    const settled = await getOrder(e.DB, o.id);
    return {
      ok: true,
      id: o.id,
      cardPayment: "paid",
      message:
        settled.payment_state === "refund_due"
          ? "To‘lov tasdiqlandi, lekin mahsulot muddati o‘tgan. Qaytarish uchun qayd ochildi."
          : "10% to‘lov tasdiqlandi. Buyurtma cheki tayyor.",
    };
  }
  if (r.state === 50) {
    await e.DB.batch([
      e.DB.prepare(
        "UPDATE card_charges SET status='failed',updated=? WHERE order_id=? AND status='paying'",
      ).bind(Date.now(), o.id),
      e.DB.prepare(
        "UPDATE orders SET status='cancelled' WHERE id=? AND status='pending_payment'",
      ).bind(o.id),
    ]);
    return {
      ok: true,
      id: o.id,
      cardPayment: "failed",
      message:
        "Provayder to‘lov bekor qilinganini tasdiqladi. Qoldiq qaytarildi.",
    };
  }
  return pending(o.id);
}
export async function reconcileCardPayment(e, owner, id, admin = false) {
  const o = await getOrder(e.DB, id);
  if (!o || (!admin && o.buyer !== owner) || o.provider !== "card")
    throw Error("Buyurtma topilmadi yoki ruxsat yo‘q");
  const c = await row(e.DB, id);
  if (c?.status === "paid")
    return {
      ok: true,
      id,
      cardPayment: "paid",
      message: "To‘lov avval tasdiqlangan. Yangi pul yechilmadi.",
    };
  if (c?.status === "failed")
    return {
      ok: true,
      id,
      cardPayment: "failed",
      message: "Karta to‘lovi yakunlanmagan. Yangi buyurtma oching.",
    };
  if (!c?.receipt_id || c.status !== "paying") return pending(id);
  try {
    const { receipt } = await subscribe(e, "receipts.get", {
      id: c.receipt_id,
    });
    return await outcome(e, o, c, receipt);
  } catch {
    return pending(id);
  }
}
export async function chargeCardPayment(e, owner, id, cardId) {
  if (!cardPaymentsConfigured(e))
    throw Error("Karta orqali to‘lov hali ulanmagan");
  const o = await getOrder(e.DB, id);
  if (!o || o.buyer !== owner || o.provider !== "card")
    throw Error("Buyurtma topilmadi");
  const card = await e.DB.prepare(
    "SELECT * FROM saved_cards WHERE id=? AND owner=?",
  )
    .bind(String(cardId || ""), owner)
    .first();
  if (!card) throw Error("Karta hisobingizga tegishli emas");
  let c = await row(e.DB, id);
  if (c && c.card_id !== card.id)
    throw Error(
      "Bu buyurtma uchun boshqa karta tanlangan. Holatini tekshiring.",
    );
  if (c?.status === "paid" || c?.status === "paying" || c?.status === "failed")
    return reconcileCardPayment(e, owner, id);
  if (
    o.status !== "pending_payment" ||
    o.payment_state !== "unpaid" ||
    o.hold_until <= Date.now()
  )
    throw Error("To‘lov muddati tugagan");
  if (!c) {
    const now = Date.now();
    const lock = await e.DB.prepare(
      "INSERT OR IGNORE INTO card_charges(order_id,card_id,status,updated,created) VALUES(?,?,'creating',?,?)",
    )
      .bind(id, card.id, now, now)
      .run();
    if (!lock.meta.changes) return pending(id);
    try {
      const { card: checked } = await subscribe(e, "cards.check", {
        token: card.token,
      });
      if (checked?.verify !== true || checked.recurrent !== true)
        throw Error("Karta tasdiqlanmagan");
      const { receipt } = await subscribe(e, "receipts.create", {
        amount: o.deposit * 100,
        account: { order_id: id },
        description: "TEJA 10% oldindan to‘lov",
      });
      validateReceipt(e, receipt, o);
      if (receipt.state !== 0) throw Error("Yangi chek holati noto‘g‘ri");
      await e.DB.prepare(
        "UPDATE card_charges SET receipt_id=?,status='created',updated=? WHERE order_id=? AND status='creating'",
      )
        .bind(receipt._id, Date.now(), id)
        .run();
      c = await row(e.DB, id);
    } catch {
      await e.DB.batch([
        e.DB.prepare(
          "UPDATE card_charges SET status='failed',updated=? WHERE order_id=? AND status='creating'",
        ).bind(Date.now(), id),
        e.DB.prepare(
          "UPDATE orders SET status='cancelled' WHERE id=? AND status='pending_payment'",
        ).bind(id),
      ]);
      return {
        ok: true,
        id,
        cardPayment: "failed",
        message:
          "Karta yoki to‘lov cheki tasdiqlanmadi. Pul yechish so‘rovi yuborilmadi.",
      };
    }
  }
  if (c?.status !== "created") return pending(id);
  // Only the request which changes created -> paying may send receipts.pay.
  // Ambiguous results stay locked and are reconciled, never paid a second time.
  const locked = await e.DB.prepare(
    "UPDATE card_charges SET status='paying',updated=? WHERE order_id=? AND status='created' AND EXISTS(SELECT 1 FROM orders o JOIN products p ON p.id=o.product WHERE o.id=card_charges.order_id AND o.status='pending_payment' AND o.payment_state='unpaid' AND o.hold_until>? AND p.until>?)",
  )
    .bind(Date.now(), id, Date.now(), Date.now())
    .run();
  if (!locked.meta.changes) {
    const latest = await getOrder(e.DB, id);
    return latest.status === "pending_payment"
      ? pending(id)
      : {
          ok: true,
          id,
          cardPayment: "failed",
          message:
            "Buyurtma muddati tugagan yoki bekor qilingan. Pul yechish so‘rovi yuborilmadi.",
        };
  }
  try {
    const { receipt } = await subscribe(e, "receipts.pay", {
      id: c.receipt_id,
      token: card.token,
    });
    return await outcome(e, o, { ...c, status: "paying" }, receipt);
  } catch {
    return pending(id);
  }
}
