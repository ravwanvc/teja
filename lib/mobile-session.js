import { digest, hex } from "./password.js";
const token = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export async function issueMobileSession(db, owner) {
  const accessToken = token(),
    refreshToken = token(),
    now = Date.now();
  await db
    .prepare("INSERT INTO mobile_sessions VALUES(?,?,?,?,?,?)")
    .bind(
      await digest(accessToken),
      await digest(refreshToken),
      owner,
      now + 900000,
      now + 30 * 86400000,
      crypto.randomUUID(),
    )
    .run();
  return { accessToken, refreshToken, expiresIn: 900 };
}
export async function rotateMobileSession(db, raw) {
  if (!/^[a-f0-9]{64}$/.test(raw || "")) throw Error("Refresh token noto‘g‘ri");
  const accessToken = token(),
    refreshToken = token(),
    now = Date.now();
  const row = await db
    .prepare(
      "UPDATE mobile_sessions SET access_hash=?,refresh_hash=?,access_expires=? WHERE refresh_hash=? AND refresh_expires>? RETURNING owner",
    )
    .bind(
      await digest(accessToken),
      await digest(refreshToken),
      now + 900000,
      await digest(raw),
      now,
    )
    .first();
  if (!row) throw Error("Sessiya tugagan. Qayta kiring");
  return { accessToken, refreshToken, expiresIn: 900 };
}
