import { env } from "cloudflare:workers";
import { getAppUser, sameOrigin } from "../../../lib/auth.js";
export async function GET() {
  const u = await getAppUser();
  if (!u) return Response.json({ error: "Kirish kerak" }, { status: 401 });
  const profile = await env.DB.prepare(
    "SELECT u.name,u.role,a.phone,a.phone_verified FROM users u LEFT JOIN app_accounts a ON a.owner=u.id WHERE u.id=?",
  )
    .bind(u.userId)
    .first();
  const results = { profile };
  for (const [name, column] of [
    ["orders", "buyer"],
    ["products", "owner"],
    ["reviews", "buyer"],
    ["notifications", "owner"],
  ])
    results[name] = (
      await env.DB.prepare(`SELECT * FROM ${name} WHERE ${column}=?`)
        .bind(u.userId)
        .all()
    ).results;
  return Response.json(results, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": 'attachment; filename="teja-export.json"',
    },
  });
}
export async function POST(req) {
  if (!sameOrigin(req))
    return Response.json({ error: "Origin" }, { status: 403 });
  const u = await getAppUser();
  if (!u) return Response.json({ error: "Kirish kerak" }, { status: 401 });
  if (u.role === "admin")
    return Response.json(
      { error: "Admin hisobi alohida boshqariladi" },
      { status: 403 },
    );
  const phone = (
    await env.DB.prepare("SELECT phone FROM app_accounts WHERE owner=?")
      .bind(u.userId)
      .first()
  )?.phone;
  const b = await req.json();
  if (b.confirm !== "DELETE")
    return Response.json({ error: "DELETE bilan tasdiqlang" }, { status: 400 });
  try {
    const avatar=(await env.DB.prepare('SELECT avatar FROM users WHERE id=?').bind(u.userId).first())?.avatar;
    const statements = [
      env.DB.prepare('DELETE FROM password_resets WHERE phone=?').bind(phone||''),
      env.DB.prepare('DELETE FROM shop_follows WHERE owner=? OR seller=?').bind(u.userId,u.userId),
      env.DB.prepare('DELETE FROM waitlist WHERE owner=?').bind(u.userId),
      env.DB.prepare("UPDATE quality_claims SET reason='Deleted',reply='' WHERE owner=?").bind(u.userId),
      env.DB.prepare("DELETE FROM phone_otps WHERE owner IN (?,?,?,?)").bind(
        "login:" + phone,
        "register:" + phone,
        "reset:" + phone,
        "verify:" + phone,
      ),
      env.DB.prepare("DELETE FROM app_accounts WHERE owner=?").bind(u.userId),
      env.DB.prepare(
        "UPDATE users SET name='Deleted',avatar='',role='deleted',business_name=NULL,business_contact=NULL,verified=0,verification='none' WHERE id=?",
      ).bind(u.userId),
      env.DB.prepare(
        "INSERT OR IGNORE INTO deletion_jobs SELECT key,? FROM image_checks WHERE owner=?",
      ).bind(Date.now(), u.userId),
      env.DB.prepare(
        "UPDATE products SET active=0,title='Deleted',shop='Deleted',image='',images='[]',address='',lat=0,lng=0,allergens='',storage='' WHERE owner=?",
      ).bind(u.userId),
      env.DB.prepare(
        "UPDATE reviews SET comment='',hidden=1 WHERE buyer=?",
      ).bind(u.userId),
      env.DB.prepare(
        "UPDATE orders SET snapshot='{}' WHERE product IN (SELECT id FROM products WHERE owner=?)",
      ).bind(u.userId),
    ];
    for (const [table, column] of [
      ["app_sessions", "owner"],
      ["mobile_sessions", "owner"],
      ["saved_cards", "owner"],
      ["demo_wallet", "owner"],
      ["listing_drafts", "owner"],
      ["image_checks", "owner"],
      ["notifications", "owner"],
      ["favorites", "user"],
      ["reports", "reporter"],
    ])
      statements.push(
        env.DB.prepare(`DELETE FROM ${table} WHERE ${column}=?`).bind(u.userId),
      );
    if(avatar?.startsWith('/api/profile?image=')) statements.push(env.DB.prepare('INSERT OR IGNORE INTO deletion_jobs VALUES(?,?)').bind(decodeURIComponent(avatar.split('image=')[1]),Date.now()));
    await env.DB.batch(statements);
    const jobs = (
      await env.DB.prepare("SELECT key FROM deletion_jobs LIMIT 100").all()
    ).results;
    for (const j of jobs) {
      try {
        await env.BUCKET.delete(j.key);
        await env.DB.prepare("DELETE FROM deletion_jobs WHERE key=?")
          .bind(j.key)
          .run();
      } catch {
        /* durable cleanup retried by scheduled worker */
      }
    }
    return Response.json(
      { ok: true },
      {
        headers: {
          "Set-Cookie":
            "teja_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
        },
      },
    );
  } catch {
    return Response.json(
      {
        error:
          "Faol buyurtma yoki qaytarish bor. Avval yakunlang / Завершите активные заказы и возвраты",
      },
      { status: 409 },
    );
  }
}
