import { mockPayments } from "./modes.js";
import { createHash } from "node:crypto";
import { cardPaymentsConfigured } from "./card-payments.js";
import { equal } from "./password.js";
export const paymentConfig = (e) =>
  mockPayments(e)
    ? { card: true, payme: true, click: true }
    : {
        card: cardPaymentsConfigured(e),
        payme: !!(
          e.PAYME_MERCHANT_ID &&
          e.PAYME_MERCHANT_KEY &&
          e.PAYMENT_CALLBACKS_READY === "true"
        ),
        click: !!(
          e.CLICK_MERCHANT_ID &&
          e.CLICK_SERVICE_ID &&
          e.CLICK_SECRET_KEY &&
          e.PAYMENT_CALLBACKS_READY === "true"
        ),
      };
export function paymentUrl(e, provider, id, amount, origin) {
  const back = origin + "/?view=orders";
  if (provider === "payme")
    return (
      "https://checkout.paycom.uz/" +
      btoa(
        `m=${e.PAYME_MERCHANT_ID};ac.order_id=${id};a=${amount * 100};l=uz;c=${back}`,
      )
    );
  const p = new URLSearchParams({
    service_id: e.CLICK_SERVICE_ID,
    merchant_id: e.CLICK_MERCHANT_ID,
    amount: String(amount),
    transaction_param: id,
    return_url: back,
  });
  return "https://my.click.uz/services/pay?" + p;
}
const txResult = (t) => ({
  transaction: t.order_id,
  create_time: t.created,
  perform_time: t.performed,
  cancel_time: t.cancelled,
  state: t.state,
  reason: t.reason,
});
const error = (code, message, data) => {
  throw {
    code,
    message: { uz: message, ru: message, en: message },
    ...(data ? { data } : {}),
  };
};
async function order(db, id, amount, provider) {
  const o = await db
    .prepare("SELECT * FROM orders WHERE id=?")
    .bind(String(id || ""))
    .first();
  if (!o || o.provider !== provider)
    error(-31050, "Buyurtma topilmadi", "order_id");
  if (o.deposit !== amount) error(-31001, "Summa mos emas");
  return o;
}
async function canPay(o) {
  if (
    o.payment_state !== "unpaid" ||
    o.status !== "pending_payment" ||
    o.hold_until <= Date.now()
  )
    error(-31008, "Buyurtma faol emas");
}
async function getTx(db, provider, id) {
  return db
    .prepare("SELECT * FROM payment_transactions WHERE id=?")
    .bind(provider + ":" + id)
    .first();
}
async function makeTx(db, provider, pid, o, providerTime) {
  try {
    await db
      .prepare(
        "INSERT INTO payment_transactions(id,provider,provider_id,order_id,amount,provider_time,created) VALUES(?,?,?,?,?,?,?)",
      )
      .bind(
        provider + ":" + pid,
        provider,
        String(pid),
        o.id,
        o.deposit,
        providerTime,
        Date.now(),
      )
      .run();
  } catch {
    const t = await getTx(db, provider, pid);
    if (!t || t.order_id !== o.id || t.amount !== o.deposit)
      error(-31008, "Tranzaksiya allaqachon mavjud");
  }
  return getTx(db, provider, pid);
}
async function perform(db, t) {
  if (t.state === 2) return t;
  if (t.state !== 1) error(-31008, "Tranzaksiya bekor qilingan");
  try {
    await db
      .prepare(
        "UPDATE payment_transactions SET state=2,performed=? WHERE id=? AND state=1",
      )
      .bind(Date.now(), t.id)
      .run();
  } catch {
    error(-31008, "To‘lov muddati tugagan yoki buyurtma o‘zgargan");
  }
  const out = await getTx(db, t.provider, t.provider_id);
  if (out.state !== 2) error(-31008, "Tranzaksiya bekor qilingan");
  return out;
}
async function cancel(db, t, reason) {
  if (t.state < 0) return t;
  try {
    await db
      .prepare(
        "UPDATE payment_transactions SET state=CASE WHEN state=2 THEN -2 ELSE -1 END,cancelled=?,reason=? WHERE id=? AND state>0",
      )
      .bind(Date.now(), reason, t.id)
      .run();
  } catch {
    error(-31007, "Mahsulot topshirilgan");
  }
  return getTx(db, t.provider, t.provider_id);
}
export async function paymeCallback(db, e, auth, b) {
  const id = b?.id ?? null;
  try {
    if (
      !e.PAYME_MERCHANT_KEY ||
      !equal(auth, "Basic " + btoa("Paycom:" + e.PAYME_MERCHANT_KEY))
    )
      error(-32504, "Avtorizatsiya xatosi");
    const p = b.params || {};
    let result, t;
    if (["CheckPerformTransaction", "CreateTransaction"].includes(b.method)) {
      if (!Number.isSafeInteger(p.amount) || p.amount <= 0 || p.amount % 100)
        error(-31001, "Summa noto‘g‘ri");
      const o = await order(db, p.account?.order_id, p.amount / 100, "payme");
      if (b.method === "CheckPerformTransaction") {
        await canPay(o);
        result = { allow: true };
      } else {
        if (
          typeof p.id !== "string" ||
          p.id.length > 100 ||
          !Number.isSafeInteger(p.time)
        )
          error(-32600, "So‘rov noto‘g‘ri");
        t = await getTx(db, "payme", p.id);
        if (t) {
          if (t.order_id !== o.id || t.amount !== o.deposit || t.state < 0)
            error(-31008, "Tranzaksiya mos emas");
        } else {
          await canPay(o);
          t = await makeTx(db, "payme", p.id, o, p.time);
        }
        result = {
          create_time: t.created,
          transaction: t.order_id,
          state: t.state,
        };
      }
    } else if (b.method === "GetStatement") {
      if (
        !Number.isSafeInteger(p.from) ||
        !Number.isSafeInteger(p.to) ||
        p.to < p.from
      )
        error(-32600, "Davr noto‘g‘ri");
      const rows = (
        await db
          .prepare(
            "SELECT * FROM payment_transactions WHERE provider='payme' AND provider_time>=? AND provider_time<=? ORDER BY provider_time",
          )
          .bind(p.from, p.to)
          .all()
      ).results;
      result = {
        transactions: rows.map((t) => ({
          ...txResult(t),
          id: t.provider_id,
          time: t.provider_time,
          amount: t.amount * 100,
          account: { order_id: t.order_id },
        })),
      };
    } else if (
      ["PerformTransaction", "CancelTransaction", "CheckTransaction"].includes(
        b.method,
      )
    ) {
      t = await getTx(db, "payme", p.id);
      if (!t) error(-31003, "Tranzaksiya topilmadi");
      if (b.method === "PerformTransaction") t = await perform(db, t);
      if (b.method === "CancelTransaction") {
        if (!Number.isSafeInteger(p.reason)) error(-32600, "Sabab noto‘g‘ri");
        t = await cancel(db, t, p.reason);
      }
      result = txResult(t);
    } else error(-32601, "Metod mavjud emas");
    return { jsonrpc: "2.0", id, result };
  } catch (err) {
    return {
      jsonrpc: "2.0",
      id,
      error: err.code
        ? err
        : {
            code: -32400,
            message: {
              uz: "Tizim xatosi",
              ru: "System error",
              en: "System error",
            },
          },
    };
  }
}
export function clickSignature(e, p) {
  return createHash("md5")
    .update(
      String(p.click_trans_id) +
        p.service_id +
        e.CLICK_SECRET_KEY +
        p.merchant_trans_id +
        (String(p.action) === "1" ? p.merchant_prepare_id : "") +
        p.amount +
        p.action +
        p.sign_time,
    )
    .digest("hex");
}
export async function clickCallback(db, e, p) {
  const base = {
    click_trans_id: p.click_trans_id,
    merchant_trans_id: p.merchant_trans_id,
  };
  const fail = (n, m) => ({ ...base, error: n, error_note: m });
  try {
    if (
      !e.CLICK_SECRET_KEY ||
      String(p.service_id) !== String(e.CLICK_SERVICE_ID) ||
      !equal(clickSignature(e, p), p.sign_string)
    )
      return fail(-1, "SIGN CHECK FAILED");
    if (!["0", "1"].includes(String(p.action)))
      return fail(-3, "Action not found");
    if (
      !/^\d+$/.test(String(p.click_trans_id)) ||
      !/^\d+(\.\d{1,2})?$/.test(String(p.amount))
    )
      return fail(-2, "Invalid amount");
    const o = await order(db, p.merchant_trans_id, Number(p.amount), "click");
    let t = await getTx(db, "click", p.click_trans_id);
    if (t && (t.order_id !== o.id || t.amount !== o.deposit))
      return fail(-6, "Transaction mismatch");
    if (String(p.action) === "0") {
      if (t?.state === 2) return fail(-4, "Already paid");
      if (t?.state < 0) return fail(-9, "Cancelled");
      await canPay(o);
      if (Number(p.error) < 0) return fail(-9, "Cancelled");
      t = t || (await makeTx(db, "click", p.click_trans_id, o, Date.now()));
      return {
        ...base,
        merchant_prepare_id: t.provider_id,
        error: 0,
        error_note: "Success",
      };
    }
    if (!t || String(p.merchant_prepare_id) !== t.provider_id)
      return fail(-6, "Transaction not found");
    if (Number(p.error) < 0) {
      await cancel(db, t, Number(p.error));
      return fail(-9, "Cancelled");
    }
    if (t.state === 2)
      return {
        ...base,
        merchant_confirm_id: t.provider_id,
        error: 0,
        error_note: "Success",
      };
    if (t.state < 0) return fail(-9, "Cancelled");
    t = await perform(db, t);
    return {
      ...base,
      merchant_confirm_id: t.provider_id,
      error: 0,
      error_note: "Success",
    };
  } catch (err) {
    return fail(
      err.code === -31001 ? -2 : err.code === -31050 ? -5 : -9,
      "Payment could not be completed",
    );
  }
}
