import { digest, equal, hex } from "./password.js";
import { mockSms } from "./modes.js";
export const smsConfigured = (e) =>
  mockSms(e) ||
  !!(
    e.TWILIO_ACCOUNT_SID &&
    e.TWILIO_AUTH_TOKEN &&
    e.TWILIO_VERIFY_SERVICE_SID
  );
const failure = (message, status = 400) =>
  Object.assign(new Error(message), { status });
async function twilio(e, phone, code) {
  if (!smsConfigured(e))
    throw failure("SMS sozlanmagan: Twilio kalitlarini kiriting", 503);
  const response = await fetch(
    `https://verify.twilio.com/v2/Services/${encodeURIComponent(e.TWILIO_VERIFY_SERVICE_SID)}/${code ? "VerificationCheck" : "Verifications"}`,
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + btoa(e.TWILIO_ACCOUNT_SID + ":" + e.TWILIO_AUTH_TOKEN),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: phone,
        ...(code ? { Code: code } : { Channel: "sms" }),
      }),
      signal: AbortSignal.timeout(15000),
    },
  );
  const data = await response.json();
  if (!response.ok) throw failure("SMS xizmati so‘rovni qabul qilmadi", 502);
  return data;
}
export async function sendOtp(e, phone, purpose, now = Date.now()) {
  if (!smsConfigured(e))
    throw failure("SMS sozlanmagan: Twilio kalitlarini kiriting", 503);
  const owner = purpose + ":" + phone,
    salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  const code = String(
    crypto.getRandomValues(new Uint32Array(1))[0] % 1000000,
  ).padStart(6, "0");
  const hash = salt + ":" + (await digest(salt + ":" + code));
  // Atomic cooldown claim; parallel send requests cannot bypass the 60s limit.
  const changed = await e.DB.prepare(
    "INSERT INTO phone_otps(owner,hash,expires,attempts,sent_at) VALUES(?,?,?,0,?) ON CONFLICT(owner) DO UPDATE SET hash=excluded.hash,expires=excluded.expires,attempts=0,sent_at=excluded.sent_at WHERE phone_otps.sent_at<=?",
  )
    .bind(owner, hash, now + 300000, now, now - 60000)
    .run();
  if (!changed.meta.changes)
    throw failure("60 soniyadan so‘ng qayta yuboring", 429);
  if (!mockSms(e)) {
    const d = await twilio(e, phone);
    if (d.status !== "pending")
      throw failure("SMS yuborilishi tasdiqlanmadi", 502);
  }
  return {
    ok: true,
    expiresAt: now + 300000,
    retryAfter: 60,
    mock: mockSms(e),
    ...(mockSms(e)
      ? { mockCode: code, label: "SINOV SMS / ТЕСТОВОЕ SMS" }
      : {}),
  };
}
export async function consumeOtp(e, phone, purpose, code, now = Date.now()) {
  const owner = purpose + ":" + phone;
  const row = await e.DB.prepare(
    "UPDATE phone_otps SET attempts=attempts+1 WHERE owner=? AND expires>? AND attempts<5 RETURNING *",
  )
    .bind(owner, now)
    .first();
  if (!row)
    throw failure(
      "Kod muddati tugagan yoki 5 urinish sarflangan. Yangi kod oling",
    );
  if (!/^\d{6}$/.test(String(code))) throw failure("6 xonali kodni kiriting");
  let valid = false;
  if (mockSms(e))
    valid =
      code === "123456" ||
      equal(
        row.hash.split(":")[1],
        await digest(row.hash.split(":")[0] + ":" + code),
      );
  else {
    const d = await twilio(e, phone, code);
    valid = d.status === "approved" && d.to === phone;
  }
  if (!valid) throw failure("Kod noto‘g‘ri");
  const result = await e.DB.prepare(
    "DELETE FROM phone_otps WHERE owner=? AND hash=? AND expires>?",
  )
    .bind(owner, row.hash, now)
    .run();
  if (!result.meta.changes) throw failure("Kod allaqachon ishlatilgan");
  return true;
}
