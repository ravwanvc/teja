import { env } from "cloudflare:workers";
import { getAppUser, sameOrigin } from "../../../lib/auth.js";
import { pickupReminders } from "../../../lib/notifications.js";
export async function GET() {
  const u = await getAppUser();
  if (!u) return Response.json({ error: "Hisobga kiring" }, { status: 401 });
  await pickupReminders(env.DB);
  const now=Date.now(),hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tashkent',hour:'2-digit',hourCycle:'h23'}).format(now));
  await env.DB.prepare("INSERT OR IGNORE INTO notifications(id,owner,kind,entity,created) SELECT lower(hex(randomblob(16))),f.owner,'new_offer',p.id,? FROM shop_follows f JOIN products p ON p.owner=f.seller WHERE f.owner=? AND f.hour<=? AND p.active=1 AND p.stock>0 AND p.until>? AND p.created>?").bind(now,u.userId,hour,now,now-86400000).run();
  return Response.json(
    {
      notifications: (
        await env.DB.prepare(
          "SELECT * FROM notifications WHERE owner=? ORDER BY created DESC LIMIT 100",
        )
          .bind(u.userId)
          .all()
      ).results,
      channel: "mock",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(req) {
  if (!sameOrigin(req))
    return Response.json({ error: "Origin" }, { status: 403 });
  const u = await getAppUser();
  if (!u) return Response.json({ error: "Hisobga kiring" }, { status: 401 });
  const b = await req.json();
  await env.DB.prepare(
    "UPDATE notifications SET read_at=? WHERE owner=? AND (id=? OR ?=1)",
  )
    .bind(Date.now(), u.userId, String(b.id || ""), b.all === true ? 1 : 0)
    .run();
  return Response.json({ ok: true });
}
