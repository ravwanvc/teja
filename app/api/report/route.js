import { canSell } from "../../../lib/roles.js";
import { env } from "cloudflare:workers";
import { getAppUser } from "../../../lib/auth.js";
export async function GET() {
  const u = await getAppUser();
  if (!u) return new Response("Hisobga kiring", { status: 401 });
  if (!["seller", "admin"].includes(u.role))
    return new Response("Faqat sotuvchi uchun", { status: 403 });
  const me = await env.DB.prepare("SELECT role FROM users WHERE id=?")
    .bind(u.userId)
    .first();
  const rows = (
    await env.DB.prepare(
      "SELECT o.*,p.title,p.shop FROM orders o JOIN products p ON p.id=o.product WHERE o.status='collected' AND COALESCE(o.provider,'')!='demo' AND o.is_mock=0 AND (p.owner=? OR ?='admin') ORDER BY o.created DESC LIMIT 10000",
    )
      .bind(u.userId, me?.role || "")
      .all()
  ).results;
  const cell = (v) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const content = [
    [
      "Chek",
      "Sana (Toshkent)",
      "Do‘kon",
      "Mahsulot",
      "Miqdor",
      "Bir dona UZS",
      "Jami UZS",
      "TEJA komissiya UZS",
      "Sotuvchi ulushi UZS",
    ],
    ...rows.map((o) => {
      const p = JSON.parse(o.snapshot || "{}");
      const fee = o.provider==="cash" && o.payment_state!=="refunded" ? o.commission_due : o.payment_state === "paid" ? o.deposit : 0;
      return [
        o.receipt_no || o.id,
        new Date(o.created).toLocaleString("uz-UZ", {
          timeZone: "Asia/Tashkent",
        }),
        p.shop || o.shop,
        p.title || o.title,
        JSON.parse(o.cart_items || "[]").reduce((n,i)=>n+Number(i.qty),0) || o.qty,
        JSON.parse(o.cart_items || "[]").length > 1 ? "Savat jami" : (JSON.parse(o.cart_items || "[]")[0]?.price ?? o.price),
        o.price * o.qty,
        fee,
        o.price * o.qty - fee,
      ];
    }),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
  return new Response("\uFEFF" + content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="teja-savdo-hisoboti.csv"',
      "Cache-Control": "no-store",
    },
  });
}
