import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { digest, phoneNumber } from "./password.js";
export async function getAppUser() {
  const h = await headers();
  if (h.get("x-client") === "app") {
    const raw = h.get("authorization")?.replace(/^Bearer /, "");
    if (!/^[a-f0-9]{64}$/.test(raw || "")) return null;
    const row = await env.DB.prepare(
      "SELECT u.* FROM mobile_sessions s JOIN users u ON u.id=s.owner WHERE s.access_hash=? AND s.access_expires>? AND s.refresh_expires>?",
    )
      .bind(await digest(raw), Date.now(), Date.now())
      .first();
    return row && row.role !== "admin"
      ? { userId: row.id, displayName: row.name, role: row.role }
      : null;
  }
  const raw = h
    .get("cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("teja_session="))
    ?.slice(13);
  if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return null;
  const row = await env.DB.prepare(
    "SELECT s.admin_version,u.* FROM app_sessions s JOIN users u ON u.id=s.owner WHERE s.token=? AND s.expires>?",
  )
    .bind(await digest(raw), Date.now())
    .first();
  if (!row) return null;
  if (
    row.role === "admin" &&
    (!env.ADMIN_PASSWORD_HASH ||
      row.admin_version !==
        (await digest(
          (phoneNumber(env.ADMIN_PHONE) || "") + env.ADMIN_PASSWORD_HASH,
        )))
  )
    return null;
  return { userId: row.id, displayName: row.name, role: row.role };
}
export async function currentUser() {
  const u = await getAppUser();
  if (!u) return null;
  return env.DB.prepare("SELECT * FROM users WHERE id=?")
    .bind(u.userId)
    .first();
}
export function sameOrigin(req) {
  return (
    req.headers.get("origin") === new URL(req.url).origin ||
    (!req.headers.get("origin") &&
      req.headers.get("x-client") === "app" &&
      /^Bearer [a-f0-9]{64}$/.test(req.headers.get("authorization") || ""))
  );
}
export async function throttle(db, key, limit, windowMs = 900000) {
  const now = Date.now(),
    bucket = Math.floor(now / windowMs);
  const id = await digest(key + ":" + bucket);
  const row = await db
    .prepare(
      "INSERT INTO auth_limits(key,n,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET n=n+1 RETURNING n",
    )
    .bind(id, now + windowMs)
    .first();
  await db.prepare("DELETE FROM auth_limits WHERE expires<?").bind(now).run();
  return row.n <= limit;
}

export async function phoneVerified(db, owner) {
  return !!(
    await db
      .prepare("SELECT phone_verified FROM app_accounts WHERE owner=?")
      .bind(owner)
      .first()
  )?.phone_verified;
}
