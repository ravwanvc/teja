import { env } from "cloudflare:workers";
import { getAppUser, sameOrigin, throttle } from "../../../lib/auth.js";
import { digest, hex, phoneNumber } from "../../../lib/password.js";
import { sendOtp, consumeOtp, smsConfigured } from "../../../lib/otp.js";
import { mockSms } from "../../../lib/modes.js";
const reply = (v, status = 200) =>
  Response.json(v, { status, headers: { "Cache-Control": "no-store" } });
export async function GET() {
  const u = await getAppUser();
  if (!u) return reply({ error: "Hisobga kiring" }, 401);
  const a = await env.DB.prepare(
    "SELECT phone,phone_verified FROM app_accounts WHERE owner=?",
  )
    .bind(u.userId)
    .first();
  return reply({
    phone: a?.phone,
    verified: !!a?.phone_verified,
    configured: smsConfigured(env),
    mock: mockSms(env),
  });
}
export async function POST(req) {
  try {
    if (
      !sameOrigin(req) &&
      !(req.headers.get("X-Client") === "app" && !req.headers.get("origin"))
    )
      return reply({ error: "Ruxsat yo‘q" }, 403);
    const b = await req.json(),
      u = await getAppUser();
    if (!["send", "verify"].includes(b.action))
      return reply({ error: "Noma’lum amal" }, 400);
    const purpose = b.purpose || "verify";
    if (!["verify", "register", "login", "reset"].includes(purpose))
      return reply({ error: "Maqsad noto‘g‘ri" }, 400);
    const a =
      purpose === "verify" && u
        ? await env.DB.prepare("SELECT phone FROM app_accounts WHERE owner=?")
            .bind(u.userId)
            .first()
        : null;
    const phone = phoneNumber(purpose === "verify" ? a?.phone : b.phone);
    if (!phone)
      return reply(
        { error: "Telefon raqamini kiriting / Укажите телефон" },
        400,
      );
    if (
      !(await throttle(
        env.DB,
        "otp-ip:" + (req.headers.get("cf-connecting-ip") || "local"),
        40,
      )) ||
      !(await throttle(env.DB, "otp:" + phone + ":" + b.action, 15))
    )
      return reply({ error: "Urinishlar ko‘paydi" }, 429);
    if (b.action === "send") return reply(await sendOtp(env, phone, purpose));
    if(purpose === "reset") {
      await consumeOtp(env,phone,'reset',String(b.code||''));
      const resetToken=hex(crypto.getRandomValues(new Uint8Array(32)));
      await env.DB.batch([
        env.DB.prepare('DELETE FROM password_resets WHERE phone=? OR expires<?').bind(phone,Date.now()),
        env.DB.prepare('INSERT INTO password_resets(token,phone,expires) VALUES(?,?,?)').bind(await digest(resetToken),phone,Date.now()+300000)
      ]);
      return reply({ok:true,resetToken});
    }
    if (purpose !== "verify" || !u)
      return reply(
        { error: "Kodni kirish yoki ro‘yxatdan o‘tish oynasida tasdiqlang" },
        400,
      );
    await consumeOtp(env, phone, purpose, String(b.code));
    await env.DB.prepare(
      "UPDATE app_accounts SET phone_verified=1 WHERE owner=? AND phone=?",
    )
      .bind(u.userId, phone)
      .run();
    return reply({ ok: true, verified: true });
  } catch (e) {
    return reply({ error: e.message }, e.status || 400);
  }
}
