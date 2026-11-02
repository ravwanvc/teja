// Amounts are stored in whole UZS. No browser request can confirm a real payment.
export const splitTotal = (price, qty) => {
  const total = price * qty;
  const deposit = Math.ceil(total / 10);
  return { total, deposit, balance: total - deposit };
};
export async function expireOrders(db, now = Date.now()) {
  await db
    .prepare(
      "UPDATE orders SET status='payment_expired' WHERE status='pending_payment' AND hold_until<=? AND NOT EXISTS(SELECT 1 FROM card_charges c WHERE c.order_id=orders.id AND c.status='paying')",
    )
    .bind(now)
    .run();
  await db
    .prepare(
      "UPDATE orders SET status='expired' WHERE status='reserved' AND payment_state IN ('paid','test','cash_due') AND pickup_at<=?",
    )
    .bind(now)
    .run();
}
// Call ONLY after an authenticated provider callback validates signature, amount,
// currency and order reference. Client redirects are never proof of payment.
export async function settleVerifiedPayment(
  db,
  { id, transactionId, amount, provider, test = false },
  now = Date.now(),
) {
  const o = await db
    .prepare(
      "SELECT o.*,p.until FROM orders o JOIN products p ON p.id=o.product WHERE o.id=?",
    )
    .bind(id)
    .first();
  if (!o || o.deposit !== amount || o.provider !== provider)
    throw Error("To‘lov ma’lumotlari mos emas");
  if (o.payment_state !== "unpaid") {
    if (o.transaction_id === transactionId) return o;
    throw Error("Buyurtma uchun to‘lov allaqachon qayd etilgan");
  }
  if (o.status !== "pending_payment" || o.hold_until <= now || o.until <= now)
    throw Error(
      "Band qilish muddati tugagan. To‘lovni qaytarish tekshiruvi kerak",
    );
  const updated = await db
    .prepare(
      "UPDATE orders SET payment_state=?,transaction_id=?,paid_at=?,status='reserved',pickup_at=? WHERE id=? AND payment_state='unpaid' AND status='pending_payment' AND hold_until>?",
    )
    .bind(
      test ? "test" : "paid",
      transactionId,
      now,
      Math.min(now + 30 * 60000, o.until),
      id,
      now,
    )
    .run();
  const settled = await db
    .prepare("SELECT * FROM orders WHERE id=?")
    .bind(id)
    .first();
  if (!updated.meta.changes && settled?.transaction_id !== transactionId)
    throw Error("To‘lov holati o‘zgardi");
  return settled;
}
