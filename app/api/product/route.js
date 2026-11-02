import { env } from "cloudflare:workers";
export async function GET(req) {
  const id = new URL(req.url).searchParams.get("id");
  const product = await env.DB.prepare(
    "SELECT * FROM products WHERE id=? AND active=1 AND until>? AND NOT EXISTS(SELECT 1 FROM users u WHERE u.id=products.owner AND u.selling_paused=1) AND (best_before IS NULL OR best_before>CAST(strftime('%s','now') AS INTEGER)*1000)",
  )
    .bind(id, Date.now())
    .first();
  return Response.json(
    product ? { product } : { error: "Topilmadi / Не найдено" },
    { status: product ? 200 : 404 },
  );
}
