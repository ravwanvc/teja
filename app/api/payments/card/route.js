import { env } from "cloudflare:workers";
import { getAppUser, sameOrigin, throttle } from "../../../../lib/auth.js";
import { cardsConfigured } from "../../../../lib/payme-subscribe.js";
import { reconcileCardPayment } from "../../../../lib/card-payments.js";
export async function POST(req) {
  if (!sameOrigin(req))
    return Response.json({ error: "Ruxsat yo‘q" }, { status: 403 });
  const u = await getAppUser();
  if (!u) return Response.json({ error: "Hisobga kiring" }, { status: 401 });
  if (!cardsConfigured(env))
    return Response.json({ error: "Karta xizmati ulanmagan" }, { status: 503 });
  try {
    if (!(await throttle(env.DB, "card-status:" + u.userId, 20, 60000)))
      return Response.json({ error: "Bir oz kuting" }, { status: 429 });
    const b = await req.json();
    return Response.json(
      await reconcileCardPayment(
        env,
        u.userId,
        String(b.id || ""),
        u.role === "admin",
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Buyurtma topilmadi yoki tekshirib bo‘lmadi" },
      { status: 400 },
    );
  }
}
