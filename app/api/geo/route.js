import { env } from "cloudflare:workers";
import { getAppUser } from "../../../lib/auth.js";
export async function GET(req) {
  if (!(await getAppUser()))
    return Response.json({ error: "Hisobga kiring" }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const reverse = q.has("lat");
  const lat = Number(q.get("lat")),
    lng = Number(q.get("lng"));
  if (
    reverse &&
    (!Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180)
  )
    return Response.json({ error: "Koordinata xato" }, { status: 400 });
  if (!reverse && (!q.get("q") || q.get("q").length > 150))
    return Response.json({ error: "Manzilni yozing" }, { status: 400 });
  const city = await env.DB.prepare("SELECT lat,lng FROM cities WHERE name=?")
    .bind(q.get("city") || "Toshkent")
    .first();
  const params = reverse
    ? `lat=${lat.toFixed(5)}&lon=${lng.toFixed(5)}&limit=1`
    : `q=${encodeURIComponent(q.get("q"))}&limit=5&lat=${city?.lat || 41.31}&lon=${city?.lng || 69.28}`;
  const key = (reverse ? "reverse?" : "api?") + params;
  const c = await env.DB.prepare(
    "SELECT value FROM geo WHERE key=? AND created>?",
  )
    .bind(key, Date.now() - 7 * 86400000)
    .first();
  if (c) return Response.json(JSON.parse(c.value));
  const slot = String(Math.floor(Date.now() / 1500));
  const gate = await env.DB.prepare(
    "INSERT OR IGNORE INTO geo(key,value,created) VALUES(?,'{}',?)",
  )
    .bind("rate:" + slot, Date.now())
    .run();
  if (!gate.meta.changes)
    return Response.json(
      { error: "Bir oz kutib qayta qidiring" },
      { status: 429 },
    );
  try {
    const base = env.GEOCODER_URL || "https://photon.komoot.io";
    const r = await fetch(base + "/" + key, {
      headers: { "User-Agent": "TEJA-MVP/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw Error();
    const data = await r.json();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT OR REPLACE INTO geo(key,value,created) VALUES(?,?,?)",
      ).bind(key, JSON.stringify(data), Date.now()),
      env.DB.prepare("DELETE FROM geo WHERE created<?").bind(
        Date.now() - 7 * 86400000,
      ),
    ]);
    return Response.json(data);
  } catch {
    return Response.json(
      {
        error:
          "Xarita qidiruvi vaqtincha ishlamadi. Nuqtani belgilang va manzilni qo‘lda yozing.",
      },
      { status: 502 },
    );
  }
}
