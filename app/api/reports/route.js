import { env } from "cloudflare:workers";
import { getAppUser, sameOrigin, throttle } from "../../../lib/auth.js";
export async function GET() {
  const u = await getAppUser();
  if (u?.role !== "admin")
    return Response.json({ error: "Faqat admin" }, { status: 403 });
  return Response.json({
    reports: (
      await env.DB.prepare(
        "SELECT * FROM reports ORDER BY created DESC LIMIT 200",
      ).all()
    ).results,
  });
}
export async function POST(req) {
  if (!sameOrigin(req))
    return Response.json({ error: "Origin" }, { status: 403 });
  const u = await getAppUser();
  if (!u) return Response.json({ error: "Kirish kerak" }, { status: 401 });
  try {
    const b = await req.json();
    if (b.action === "resolve") {
      if (u.role !== "admin")
        return Response.json({ error: "Faqat admin" }, { status: 403 });
      await env.DB.prepare("UPDATE reports SET status='resolved' WHERE id=?")
        .bind(String(b.id))
        .run();
      return Response.json({ ok: true });
    }
    if (!(await throttle(env.DB, "report:" + u.userId, 10)))
      return Response.json({ error: "Bir oz kuting" }, { status: 429 });
    const table = {
      product: ["products", "id"],
      seller: ["users", "id"],
      review: ["reviews", "order_id"],
    }[b.kind];
    if (
      !table ||
      typeof b.reason !== "string" ||
      b.reason.trim().length < 5 ||
      b.reason.length > 1000
    )
      throw Error("Sababni yozing (5–1000 belgi)");
    if (
      !(await env.DB.prepare(
        `SELECT ${table[1]} FROM ${table[0]} WHERE ${table[1]}=?`,
      )
        .bind(String(b.target))
        .first())
    )
      throw Error("Topilmadi");
    await env.DB.prepare(
      "INSERT INTO reports(id,reporter,kind,target,reason,created) VALUES(?,?,?,?,?,?)",
    )
      .bind(
        crypto.randomUUID(),
        u.userId,
        b.kind,
        String(b.target),
        b.reason.trim(),
        Date.now(),
      )
      .run();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
