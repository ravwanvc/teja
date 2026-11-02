import { env } from "cloudflare:workers";
import { getAppUser, sameOrigin, throttle } from "../../../../lib/auth.js";
import { simulatePayment } from "../../../../lib/mock-payment.js";
export async function POST(req) {
  if (!sameOrigin(req))
    return Response.json({ error: "Origin" }, { status: 403 });
  const u = await getAppUser();
  if (!u) return Response.json({ error: "Kirish kerak" }, { status: 401 });
  if (!(await throttle(env.DB, "mock-pay:" + u.userId, 30, 60000)))
    return Response.json({ error: "Bir oz kuting" }, { status: 429 });
  try {
    const b = await req.json();
    if (!["pay", "reject", "expire"].includes(b.outcome))
      throw Error("Amal noto‘g‘ri");
    return Response.json(await simulatePayment(env, u.userId, b.id, b.outcome));
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
