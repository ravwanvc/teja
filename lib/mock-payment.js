import { mockPayments } from "./modes.js";
import { paymeCallback, clickCallback, clickSignature } from "./payments.js";
// Ephemeral credentials exist only in this process and never authorize HTTP callbacks.
export async function simulatePayment(e, owner, id, outcome) {
  if (!mockPayments(e)) throw Error("Sinov to‘lovlari o‘chirilgan");
  if (!["pay", "reject", "expire", "refund"].includes(outcome))
    throw Error("Amal noto‘g‘ri");
  const o = await e.DB.prepare(
    "SELECT * FROM orders WHERE id=? AND buyer=? AND is_mock=1",
  )
    .bind(id, owner)
    .first();
  if (!o) throw Error("Buyurtma topilmadi");
  if (outcome === "expire") {
    await e.DB.prepare(
      "UPDATE orders SET status='payment_expired' WHERE id=? AND status='pending_payment' AND payment_state='unpaid'",
    )
      .bind(id)
      .run();
    return { ok: true, id };
  }
  const existing = await e.DB.prepare(
    "SELECT * FROM payment_transactions WHERE order_id=?",
  )
    .bind(id)
    .first();
  const pid =
    existing?.provider_id ||
    (o.provider === "click"
      ? String(
          BigInt("0x" + crypto.randomUUID().replaceAll("-", "").slice(0, 12)),
        )
      : "mock-" + id);
  const credentials = {
    PAYME_MERCHANT_KEY: crypto.randomUUID(),
    CLICK_SECRET_KEY: crypto.randomUUID(),
    CLICK_SERVICE_ID: "mock",
  };
  if (o.provider === "click") {
    const base = {
      click_trans_id: pid,
      service_id: "mock",
      merchant_trans_id: id,
      amount: String(o.deposit),
      sign_time: String(Date.now()),
      error: "0",
    };
    const send = async (p) =>
      clickCallback(e.DB, credentials, {
        ...p,
        sign_string: clickSignature(credentials, p),
      });
    if (!existing) {
      const r = await send({ ...base, action: "0" });
      if (r.error) throw Error(r.error_note);
    }
    const result = await send({
      ...base,
      action: "1",
      merchant_prepare_id: pid,
      error: outcome === "pay" ? "0" : "-9",
    });
    if (result.error && !(result.error === -9 && outcome !== "pay"))
      throw Error(result.error_note);
  } else {
    const send = (method, params) =>
      paymeCallback(
        e.DB,
        credentials,
        "Basic " + btoa("Paycom:" + credentials.PAYME_MERCHANT_KEY),
        { id: 1, method, params },
      );
    if (!existing) {
      const r = await send("CreateTransaction", {
        id: pid,
        time: Date.now(),
        amount: o.deposit * 100,
        account: { order_id: id },
      });
      if (r.error) throw Error(r.error.message.uz);
    }
    const r = await send(
      outcome === "pay" ? "PerformTransaction" : "CancelTransaction",
      { id: pid, reason: 1 },
    );
    if (r.error) throw Error(r.error.message.uz);
  }
  return {
    ok: true,
    id,
    label: "SINOV — pul olinmagan / ТЕСТ — деньги не списаны",
  };
}
export async function refundMock(e, id) {
  const o = await e.DB.prepare("SELECT * FROM orders WHERE id=?")
    .bind(id)
    .first();
  if (!o?.is_mock || !mockPayments(e)) throw Error("Faqat sinov qaytarishi");
  if (o.payment_state === "refunded") return { ok: true };
  if (o.payment_state !== "refund_due") throw Error("Qaytarish kutilmayapti");
  return simulatePayment(e, o.buyer, id, "refund");
}
