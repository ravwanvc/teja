import { mockPayments } from "../../../lib/modes.js";
import { validExpiry } from "../../../lib/card-form.js";
import { env } from "cloudflare:workers";
import { getAppUser, sameOrigin, throttle } from "../../../lib/auth.js";
import { cardsConfigured, subscribe } from "../../../lib/payme-subscribe.js";
const reply = (v, s = 200) =>
  Response.json(v, { status: s, headers: { "Cache-Control": "no-store" } });
export async function GET() {
  const u = await getAppUser();
  if (!u) return reply({ error: "Hisobga kiring" }, 401);
  if (mockPayments(env)) {
    const rows = (
      await env.DB.prepare(
        "SELECT id,brand,last4,expiry FROM demo_wallet WHERE owner=? ORDER BY created DESC",
      )
        .bind(u.userId)
        .all()
    ).results;
    return reply({
      demo: true,
      configured: true,
      cards: rows.map((c) => ({ ...c, number: "•••• •••• •••• " + c.last4 })),
    });
  }
  const cards = (
    await env.DB.prepare(
      "SELECT id,number,expiry FROM saved_cards WHERE owner=? ORDER BY created DESC",
    )
      .bind(u.userId)
      .all()
  ).results;
  return reply({
    cards,
    configured: cardsConfigured(env),
    merchantId: cardsConfigured(env) ? env.PAYME_SUBSCRIBE_ID : null,
  });
}
export async function POST(req) {
  if (!sameOrigin(req)) return reply({ error: "Ruxsat yo‘q" }, 403);
  const u = await getAppUser();
  if (!u) return reply({ error: "Hisobga kiring" }, 401);
  if (mockPayments(env)) return demoCard(req, u);
  if (!cardsConfigured(env))
    return reply(
      { error: "Payme Subscribe hali ulanmagan. Karta saqlanmadi." },
      503,
    );
  try {
    if (!(await throttle(env.DB, "cards:" + u.userId, 12)))
      return reply({ error: "Keyinroq urinib ko‘ring" }, 429);
    const b = await req.json();
    if (Object.keys(b).some((k) => !["action", "token", "id"].includes(k)))
      return reply(
        { error: "Karta raqami, CVV yoki SMS kodini TEJA serveriga yubormang" },
        400,
      );
    if (b.action === "remove") {
      const c = await env.DB.prepare(
        "SELECT token FROM saved_cards WHERE id=? AND owner=?",
      )
        .bind(String(b.id || ""), u.userId)
        .first();
      if (!c) return reply({ error: "Karta topilmadi" }, 404);
      if (
        await env.DB.prepare(
          "SELECT c.order_id FROM card_charges c JOIN orders o ON o.id=c.order_id WHERE c.card_id=? AND o.status='pending_payment' AND c.status IN ('creating','created','paying')",
        )
          .bind(b.id)
          .first()
      )
        return reply(
          {
            error:
              "Bu karta bilan to‘lov tekshirilmoqda. Avval buyurtma holatini tekshiring.",
          },
          409,
        );
      const result = await subscribe(env, "cards.remove", { token: c.token });
      if (result.success !== true)
        throw Error("Provayder kartani o‘chirishni tasdiqlamadi");
      await env.DB.prepare("DELETE FROM saved_cards WHERE id=? AND owner=?")
        .bind(b.id, u.userId)
        .run();
      return reply({ ok: true });
    }
    if (
      b.action !== "add" ||
      typeof b.token !== "string" ||
      b.token.length < 20 ||
      b.token.length > 4096
    )
      return reply({ error: "Karta tokeni noto‘g‘ri" }, 400);
    const { card } = await subscribe(env, "cards.check", { token: b.token });
    if (
      card?.verify !== true ||
      card.recurrent !== true ||
      typeof card.number !== "string" ||
      !card.number.includes("*") ||
      card.number.length > 24 ||
      typeof card.expire !== "string"
    )
      return reply({ error: "Karta bank SMS kodi bilan tasdiqlanmagan" }, 400);
    const exists = await env.DB.prepare(
      "SELECT owner FROM saved_cards WHERE token=?",
    )
      .bind(b.token)
      .first();
    if (exists)
      return exists.owner === u.userId
        ? reply({ ok: true })
        : reply({ error: "Karta tokeni boshqa hisobga tegishli" }, 409);
    const count = await env.DB.prepare(
      "SELECT COUNT(*) n FROM saved_cards WHERE owner=?",
    )
      .bind(u.userId)
      .first();
    if (count.n >= 5)
      return reply({ error: "5 tagacha karta qo‘shish mumkin" }, 400);
    await env.DB.prepare(
      "INSERT INTO saved_cards(id,owner,token,number,expiry,created) VALUES(?,?,?,?,?,?)",
    )
      .bind(
        crypto.randomUUID(),
        u.userId,
        b.token,
        card.number,
        card.expire,
        Date.now(),
      )
      .run();
    return reply({ ok: true });
  } catch {
    return reply(
      {
        error: "Payme kartani tasdiqlamadi yoki xizmatga ulanishda xatolik bor",
      },
      502,
    );
  }
}

async function demoCard(req, u) {
  try {
    const b = await req.json();
    if (
      Object.keys(b).some(
        (k) => !["action", "id", "brand", "last4", "expiry"].includes(k),
      )
    )
      return reply(
        { error: "Faqat karta turi va oxirgi 4 raqam yuborilishi mumkin" },
        400,
      );
    if (b.action === "remove") {
      await env.DB.prepare("DELETE FROM demo_wallet WHERE id=? AND owner=?")
        .bind(String(b.id || ""), u.userId)
        .run();
      return reply({ ok: true });
    }
    if (
      b.action !== "add" ||
      !["uzcard", "humo", "visa"].includes(b.brand) ||
      !/^\d{4}$/.test(b.last4) ||
      !validExpiry(b.expiry)
    )
      return reply({ error: "Karta ma’lumotlari noto‘g‘ri" }, 400);
    if (
      (
        await env.DB.prepare("SELECT COUNT(*) n FROM demo_wallet WHERE owner=?")
          .bind(u.userId)
          .first()
      ).n >= 5
    )
      return reply({ error: "5 tagacha sinov kartasi mumkin" }, 400);
    await env.DB.prepare(
      "INSERT INTO demo_wallet(id,owner,brand,last4,expiry,created) VALUES(?,?,?,?,?,?)",
    )
      .bind(
        crypto.randomUUID(),
        u.userId,
        b.brand,
        b.last4,
        b.expiry,
        Date.now(),
      )
      .run();
    return reply({ ok: true, demo: true });
  } catch {
    return reply({ error: "Sinov kartasi saqlanmadi" }, 400);
  }
}
