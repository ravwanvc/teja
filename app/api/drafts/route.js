import { canSell } from "../../../lib/roles.js";
import { env } from "cloudflare:workers";
import { getAppUser, sameOrigin, throttle } from "../../../lib/auth.js";
import { emptyListing } from "../../../lib/listing-tools.js";
const reply = (v, s = 200) =>
  Response.json(v, { status: s, headers: { "Cache-Control": "no-store" } });
export async function GET() {
  const u = await getAppUser();
  if (!u) return reply({ error: "Hisobga kiring" }, 401);
  if (!canSell(u.role)) return reply({ error: "Faqat sotuvchi uchun" }, 403);
  const rows = (
    await env.DB.prepare(
      "SELECT id,body,version,updated FROM listing_drafts WHERE owner=? ORDER BY updated DESC LIMIT 30",
    )
      .bind(u.userId)
      .all()
  ).results;
  return reply({
    drafts: rows.map((r) => ({ ...r, body: JSON.parse(r.body) })),
  });
}
export async function POST(req) {
  if (!sameOrigin(req)) return reply({ error: "Ruxsat yo‘q" }, 403);
  const u = await getAppUser();
  if (!u) return reply({ error: "Hisobga kiring" }, 401);
  if (!canSell(u.role)) return reply({ error: "Faqat sotuvchi uchun" }, 403);
  if((await env.DB.prepare("SELECT selling_paused FROM users WHERE id=?").bind(u.userId).first())?.selling_paused)return reply({error:"Savdo vaqtincha cheklangan"},403);
  try {
    const raw = await req.text();
    if (raw.length > 12000) return reply({ error: "Qoralama juda katta" }, 413);
    const b = JSON.parse(raw);
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(b.id || ""))
      return reply({ error: "Qoralama raqami noto‘g‘ri" }, 400);
    if (!(await throttle(env.DB, "draft:" + u.userId, 60, 60000)))
      return reply({ error: "Bir oz kuting" }, 429);
    const prior = await env.DB.prepare(
      "SELECT owner,version FROM listing_drafts WHERE id=?",
    )
      .bind(b.id)
      .first();
    if (prior && prior.owner !== u.userId)
      return reply({ error: "Ruxsat yo‘q" }, 403);
    if (prior && prior.version !== b.version)
      return reply(
        {
          error:
            "Qoralama boshqa oynada o‘zgargan. Ro‘yxatni yangilang va qayta oching.",
        },
        409,
      );
    if (b.action === "delete") {
      if (prior)
        await env.DB.prepare(
          "DELETE FROM listing_drafts WHERE id=? AND owner=? AND version=?",
        )
          .bind(b.id, u.userId, b.version)
          .run();
      return reply({ ok: true });
    }
    if (b.action !== "save" || !b.body || typeof b.body !== "object")
      return reply({ error: "So‘rov noto‘g‘ri" }, 400);
    const body = {};
    for (const k of Object.keys(emptyListing())) {
      const v = b.body[k];
      if (k === "images") {
        if (
          Array.isArray(v) &&
          v.length <= 3 &&
          v.every(
            (url) =>
              typeof url === "string" &&
              url.startsWith("/api/image?id=" + u.userId + "/"),
          )
        )
          body[k] = v;
      } else if (["lat", "lng"].includes(k)) {
        if (v === null || (typeof v === "number" && Number.isFinite(v)))
          body[k] = v;
      } else if (["price", "original", "stock"].includes(k)) {
        if (
          (typeof v === "number" && Number.isFinite(v)) ||
          (typeof v === "string" && v.length < 20)
        )
          body[k] = v;
      } else if (typeof v === "string" && v.length <= 1000) body[k] = v;
    }
    if (body.image && !body.image.startsWith("/api/image?id=" + u.userId + "/"))
      return reply({ error: "Rasm hisobingizga tegishli emas" }, 400);
    if (prior) {
      const changed = await env.DB.prepare(
        "UPDATE listing_drafts SET body=?,version=version+1,updated=? WHERE id=? AND owner=? AND version=?",
      )
        .bind(JSON.stringify(body), Date.now(), b.id, u.userId, b.version)
        .run();
      if (!changed.meta.changes)
        return reply({ error: "Qoralama yangilangan. Qayta oching." }, 409);
    } else {
      const published = await env.DB.prepare(
        "SELECT id FROM products WHERE id=?",
      )
        .bind(b.id)
        .first();
      if (published)
        return reply(
          { error: "Mahsulot allaqachon joylangan. Yangi partiya yarating." },
          409,
        );
      if (b.version !== 0)
        return reply(
          {
            error:
              "Qoralama o‘chirilgan yoki nashr qilingan. Yangisini yarating.",
          },
          409,
        );
      const count = await env.DB.prepare(
        "SELECT COUNT(*) n FROM listing_drafts WHERE owner=?",
      )
        .bind(u.userId)
        .first();
      if (count.n >= 30)
        return reply(
          { error: "30 ta qoralama bor. Keraksizini o‘chiring." },
          400,
        );
      await env.DB.prepare(
        "INSERT INTO listing_drafts(id,owner,body,version,updated) VALUES(?,?,?,1,?)",
      )
        .bind(b.id, u.userId, JSON.stringify(body), Date.now())
        .run();
    }
    return reply({ ok: true, version: (prior?.version || 0) + 1 });
  } catch {
    return reply({ error: "Qoralama saqlanmadi. Qayta urinib ko‘ring." }, 400);
  }
}
