// Reproduces the reported symptoms on a database that has NO tables, then proves the
// same code returns 200 once the eight migrations are applied.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const db = new DatabaseSync(":memory:");
const D1 = {
  prepare(sql) {
    let a = [];
    return {
      bind(...x) {
        a = x;
        return this;
      },
      async first() {
        return db.prepare(sql).get(...a) || null;
      },
      async all() {
        return { results: db.prepare(sql).all(...a) };
      },
      async run() {
        return { meta: { changes: db.prepare(sql).run(...a).changes } };
      },
    };
  },
  async batch(s) {
    const r = [];
    for (const q of s) r.push(await q.run());
    return r;
  },
};
globalThis.testEnv = { DB: D1, BUCKET: {} };
globalThis.reqHeaders = new Headers();
const cache = new Map();
async function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  let code = await fs.readFile(file, "utf8");
  code = code
    .replace(
      /import \{\s*env\s*\} from ['"]cloudflare:workers['"];?/g,
      "const env=globalThis.testEnv;",
    )
    .replace(
      /import \{\s*headers\s*\} from ['"]next\/headers['"];?/g,
      "const headers=async()=>globalThis.reqHeaders;",
    );
  for (const m of [...code.matchAll(/from ['"](\.\.?\/[^'"]+)['"]/g)]) {
    const u = await load(path.resolve(path.dirname(file), m[1]));
    code = code.replace(m[0], "from '" + u + "'");
  }
  const uri =
    "data:text/javascript;base64," + Buffer.from(code).toString("base64");
  cache.set(file, uri);
  return uri;
}
const data = await import(await load("app/api/data/route.js")),
  auth = await import(await load("app/api/auth/route.js"));
const quiet = console.error;
console.error = () => {};
const post = (m, b) =>
  m.POST(
    new Request("http://127.0.0.1:8787/api/auth", {
      method: "POST",
      headers: {
        origin: "http://127.0.0.1:8787",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(b),
    }),
  );
const {sendOtp}=await import("../lib/otp.js");
const reg = {
code:"123456",
  action: "register",
  phone: "+998901234567",
  password: "correct-password-123",
  name: "Buyer",
  role: "member",
};
// 1. unmigrated database
let r = await data.GET();
assert.equal(r.status, 503);
assert.match((await r.json()).error, /db:migrate:local/);
r = await post(auth, reg);
assert.equal(r.status, 503);
// 2. migrated database
for (const n of (await fs.readdir("drizzle"))
  .filter((n) => n.endsWith(".sql"))
  .sort())
  db.exec(await fs.readFile("drizzle/" + n, "utf8"));
r = await data.GET();
assert.equal(r.status, 200);
const body = await r.json();
assert.deepEqual(body.products, []);
await sendOtp(globalThis.testEnv,reg.phone,"register");
r = await post(auth, reg);
assert.equal(r.status, 200);
// plain-HTTP local preview must not set Secure (browser would drop the cookie)
assert.doesNotMatch(r.headers.get("set-cookie"), /Secure/);
r = await post(auth, { ...reg, password: "short" });
assert.equal(r.status, 400);
console.error = quiet;
console.log(
  "PASS: unmigrated DB -> 503 with hint (auth + data); migrated DB -> /api/data 200, register 200, HTTP cookie without Secure, short password 400",
);
