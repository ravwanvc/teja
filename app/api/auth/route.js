import { consumeOtp } from "../../../lib/otp.js";
import { mockSms } from "../../../lib/modes.js";
import { adminSecondFactor } from "../../../lib/totp.js";
import {
  issueMobileSession,
  rotateMobileSession,
} from "../../../lib/mobile-session.js";
import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { getAppUser, sameOrigin, throttle } from "../../../lib/auth.js";
import {
  digest,
  hex,
  passwordHash,
  passwordMatches,
  phoneNumber,
} from "../../../lib/password.js";
import {
  schemaMissing,
  SCHEMA_HINT,
  logError,
} from "../../../lib/db-errors.js";
const reply = (v, status = 200, extra = {}) =>
  Response.json(v, {
    status,
    headers: { "Cache-Control": "no-store", ...extra },
  });
// Secure cookies are required on HTTPS production, but browsers reject them on local HTTP previews.
const cookie = (value, age, secure = true) =>
  `teja_session=${value}; Path=/; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Lax; Max-Age=${age}`;
export async function GET() {
  try {
    const u = await getAppUser();
    return reply({
      user: u,
      smsConfigured:
        mockSms(env) ||
        !!(
          env.TWILIO_ACCOUNT_SID &&
          env.TWILIO_AUTH_TOKEN &&
          env.TWILIO_VERIFY_SERVICE_SID
        ),
      mockSms: mockSms(env),
      smsRequired: env.SMS_REQUIRED === "true",
    });
  } catch (e) {
    logError("GET /api/auth", e);
    return schemaMissing(e)
      ? reply({ error: SCHEMA_HINT }, 503)
      : reply({ error: "Holatni tekshirib bo‘lmadi" }, 500);
  }
}
export async function POST(req) {
  try {
    const mobile =
      req.headers.get("x-client") === "app" && !req.headers.get("origin");
    if (!sameOrigin(req) && !mobile)
      return reply({ error: "Ruxsat etilmagan so‘rov" }, 403);
    if (Number(req.headers.get("content-length")) > 4096)
      return reply({ error: "So‘rov juda katta" }, 413);
    const b = await req.json();
    if (b.action === "refresh" && mobile) {
      try {
        return reply(await rotateMobileSession(env.DB, b.refreshToken));
      } catch {
        return reply({ error: "Sessiya tugagan" }, 401);
      }
    }
    if (b.action === "logout") {
      const h = await headers();
      if (mobile) {
        const raw = h.get("authorization")?.replace(/^Bearer /, "");
        if (raw)
          await env.DB.prepare(
            "DELETE FROM mobile_sessions WHERE access_hash=?",
          )
            .bind(await digest(raw))
            .run();
        return reply({ ok: true });
      }
      const token = h
        .get("cookie")
        ?.split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith("teja_session="))
        ?.slice(13);
      if (token)
        await env.DB.prepare("DELETE FROM app_sessions WHERE token=?")
          .bind(await digest(token))
          .run();
      return reply({ ok: true }, 200, {
        "Set-Cookie": cookie("", 0, new URL(req.url).protocol === "https:"),
      });
    }
    const phone =
        typeof b.phone === "string" && /^\+998[0-9]{9}$/.test(b.phone)
          ? b.phone
          : null,
      password = b.password;
    if (
      !phone ||
      (b.action !== "otpLogin" &&
        (typeof password !== "string" ||
          password.length < 8 ||
          password.length > 128))
    )
      return reply(
        {
          error:
            "Telefon +998 va aynan 9 raqamdan, parol esa 8–128 belgidan iborat bo‘lsin",
        },
        400,
      );
    const ip = req.headers.get("cf-connecting-ip") || "local";
    if (
      !(await throttle(env.DB, "ip:" + ip, 50)) ||
      !(await throttle(env.DB, "phone-ip:" + phone + ":" + ip, 10))
    )
      return reply(
        {
          error: "Urinishlar ko‘paydi. 15 daqiqadan so‘ng qayta urinib ko‘ring",
        },
        429,
      );
    let id,
      role = "member",
      adminVersion = null;
    if (
      b.action === "admin" ||
      (b.action === "login" && phone === phoneNumber(env.ADMIN_PHONE))
    ) {
      if (!phoneNumber(env.ADMIN_PHONE) || !env.ADMIN_PASSWORD_HASH)
        return reply(
          {
            error:
              "Admin kirishi sozlanmagan: ADMIN_PHONE va ADMIN_PASSWORD_HASH kerak",
          },
          503,
        );
      const valid = await passwordMatches(password, env.ADMIN_PASSWORD_HASH);
      if (phone !== phoneNumber(env.ADMIN_PHONE) || !valid)
        return reply({ error: "Telefon yoki parol noto‘g‘ri" }, 401);
      if (mobile)
        return reply({ error: "Admin uchun veb kirishdan foydalaning" }, 403);
      if (!adminSecondFactor(env, String(b.code || "")))
        return reply({ error: "2FA kodi kerak / Требуется код 2FA" }, 401);
      id =
        (await env.DB.prepare("SELECT id FROM app_admin LIMIT 1").first())
          ?.id || "admin-" + crypto.randomUUID();
      await env.DB.batch([
        env.DB.prepare(
          "INSERT OR IGNORE INTO users(id,name,role,created) VALUES(?,?,?,?)",
        ).bind(id, "Administrator", "admin", Date.now()),
        env.DB.prepare("INSERT OR IGNORE INTO app_admin(id) VALUES(?)").bind(
          id,
        ),
        env.DB.prepare("UPDATE users SET role='admin' WHERE id=?").bind(id),
      ]);
      role = "admin";
      adminVersion = await digest(phone + env.ADMIN_PASSWORD_HASH);
    } else if (b.action === "register") {
      if (phone === phoneNumber(env.ADMIN_PHONE))
        return reply(
          { error: "Bu raqam bilan ro‘yxatdan o‘tib bo‘lmaydi" },
          400,
        );
      if (!["member", "seller"].includes(b.role))
        return reply({ error: "Hisob turini tanlang" }, 400);
      const name = typeof b.name === "string" ? b.name.trim() : "";
      if (name.length < 2 || name.length > 80)
        return reply({ error: "Ism 2–80 belgidan iborat bo‘lsin" }, 400);
      if (
        await env.DB.prepare("SELECT phone FROM app_accounts WHERE phone=?")
          .bind(phone)
          .first()
      )
        return reply(
          {
            error:
              "Ro‘yxatdan o‘tib bo‘lmadi. Mavjud hisobga kirishni tekshiring",
          },
          409,
        );
      const verified = env.SMS_REQUIRED === "true";
      if (verified) await consumeOtp(env, phone, "register", String(b.code || ""));
      id = crypto.randomUUID();
      role = b.role;
      const hash = await passwordHash(password);
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO users(id,name,role,created) VALUES(?,?,?,?)",
        ).bind(id, name, role, Date.now()),
        env.DB.prepare(
          "INSERT INTO app_accounts(phone,owner,password_hash,phone_verified) VALUES(?,?,?,?)",
        ).bind(phone, id, hash, verified ? 1 : 0),
      ]);
    } else if (["login", "otpLogin", "reset"].includes(b.action)) {
      const row = await env.DB.prepare(
        "SELECT a.*,u.role FROM app_accounts a JOIN users u ON a.owner=u.id WHERE phone=?",
      )
        .bind(phone)
        .first();
      const valid =
        b.action !== "login" ||
        (await passwordMatches(
          password,
          row?.password_hash ||
            (await passwordHash(
              "constant-unused-password",
              "00000000000000000000000000000000",
            )),
        ));
      if (!row || !valid || row.role === "admin")
        return reply({ error: "Telefon yoki parol noto‘g‘ri" }, 401);
      if (b.action === "reset") {
        if (b.password !== b.confirmPassword) return reply({error:"Parollar mos emas"},400);
        const token = typeof b.resetToken === 'string' ? await digest(b.resetToken) : '';
        const claim=await env.DB.prepare("DELETE FROM password_resets WHERE token=? AND phone=? AND expires>? RETURNING token").bind(token,phone,Date.now()).first();
        if(!claim) return reply({error:"Tasdiqlash muddati tugagan. SMSni qayta tekshiring."},400);
      } else if (b.action === 'otpLogin') {
        await consumeOtp(env, phone, 'login', String(b.code||''));
      }
      id = row.owner;
      role = row.role;
      if (b.action === "reset") {
        await env.DB.batch([
          env.DB.prepare(
            "UPDATE app_accounts SET password_hash=? WHERE owner=?",
          ).bind(await passwordHash(password), id),
          env.DB.prepare("DELETE FROM app_sessions WHERE owner=?").bind(id),
          env.DB.prepare("DELETE FROM mobile_sessions WHERE owner=?").bind(id),
        ]);
      }
    } else return reply({ error: "Noma’lum amal" }, 400);
    if (mobile)
      return reply({
        ok: true,
        role,
        ...(await issueMobileSession(env.DB, id)),
      });
    const token = hex(crypto.getRandomValues(new Uint8Array(32)));
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO app_sessions(token,owner,expires,admin_version) VALUES(?,?,?,?)",
      ).bind(await digest(token), id, Date.now() + 7 * 86400000, adminVersion),
      env.DB.prepare("DELETE FROM app_sessions WHERE expires<?").bind(
        Date.now(),
      ),
    ]);
    return reply(
      {
        ok: true,
        role,
        redirect:
          role === "admin"
            ? "/admin"
            : role === "seller"
              ? "/?view=seller"
              : "/",
      },
      200,
      {
        "Set-Cookie": cookie(
          token,
          7 * 86400,
          new URL(req.url).protocol === "https:",
        ),
      },
    );
  } catch (e) {
    logError("POST /api/auth", e);
    if (schemaMissing(e)) return reply({ error: SCHEMA_HINT }, 503);
    return reply(
      {
        error: e.status
          ? e.message
          : "Kirish amalga oshmadi. Kod va ma’lumotlarni tekshiring",
      },
      e.status || 400,
    );
  }
}
