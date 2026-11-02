import { canSell } from "../../../lib/roles.js";
import { env } from "cloudflare:workers";
import { getAppUser, sameOrigin, phoneVerified } from "../../../lib/auth.js";
import { validImage, inspectImage } from "../../../lib/image-review.js";
export async function POST(req) {
  try {
    const u = await getAppUser();
    if (!u) return Response.json({ error: "Hisobga kiring" }, { status: 401 });
    if (env.SMS_REQUIRED === "true" && !(await phoneVerified(env.DB, u.userId)))
      return Response.json(
        { error: "Avval telefonni tasdiqlang" },
        { status: 403 },
      );
    if (!canSell(u.role))
      return Response.json({ error: "Faqat sotuvchi uchun" }, { status: 403 });
    if((await env.DB.prepare("SELECT selling_paused FROM users WHERE id=?").bind(u.userId).first())?.selling_paused)return Response.json({error:"Savdo vaqtincha cheklangan"},{status:403});
    if (!sameOrigin(req)) return new Response(null, { status: 403 });
    if (Number(req.headers.get("content-length")) > 6 * 1024 * 1024)
      return Response.json(
        { error: "Rasm 5 MB dan oshmasin" },
        { status: 413 },
      );
    const count = await env.DB.prepare(
      "SELECT COUNT(*) n FROM image_checks WHERE owner=? AND created>?",
    )
      .bind(u.userId, Date.now() - 60000)
      .first();
    if (count.n >= 6)
      return Response.json(
        { error: "Bir daqiqada 6 tagacha rasm. Bir oz kuting." },
        { status: 429 },
      );
    const f = (await req.formData()).get("file");
    if (
      !f ||
      typeof f.arrayBuffer !== "function" ||
      !["image/jpeg", "image/png", "image/webp"].includes(f.type) ||
      f.size > 5 * 1024 * 1024
    )
      return Response.json(
        { error: "JPG, PNG yoki WebP; 5 MB gacha" },
        { status: 400 },
      );
    const bytes = await f.arrayBuffer();
    if (!validImage(bytes, f.type))
      return Response.json(
        { error: "Rasm fayli noto‘g‘ri. Haqiqiy JPG, PNG yoki WebP yuklang." },
        { status: 400 },
      );
    const key = u.userId + "/" + crypto.randomUUID();
    const review = await inspectImage(bytes, f.type, env);
    await env.DB.prepare(
      "INSERT INTO image_checks(key,owner,status,note,created) VALUES(?,?,?,?,?)",
    )
      .bind(key, u.userId, review.status, review.note, Date.now())
      .run();
    if (review.status === "rejected")
      return Response.json({ error: review.note, review }, { status: 422 });
    await env.BUCKET.put(key, bytes, { httpMetadata: { contentType: f.type } });
    return Response.json({ url: "/api/image?id=" + key, review });
  } catch {
    return Response.json(
      { error: "Rasm yuklanmadi. Qayta urinib ko‘ring." },
      { status: 500 },
    );
  }
}
export async function GET(req) {
  const key = new URL(req.url).searchParams.get("id");
  if (!key) return new Response(null, { status: 404 });
  const o = await env.BUCKET.get(key);
  if (!o) return new Response(null, { status: 404 });
  return new Response(o.body, {
    headers: {
      "Content-Type": o.httpMetadata.contentType,
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
