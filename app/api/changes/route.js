import { env } from "cloudflare:workers";
import { expireOrders } from "../../../lib/commerce.js";
import { pickupReminders } from "../../../lib/notifications.js";
export async function GET(req) {
  await expireOrders(env.DB);
  await pickupReminders(env.DB);
  const { version } = await env.DB.prepare(
    "SELECT version FROM change_version WHERE id=1",
  ).first();
  const since = Number(new URL(req.url).searchParams.get("since"));
  return Response.json(
    { changed: since !== version, version },
    { headers: { "Cache-Control": "no-store" } },
  );
}
