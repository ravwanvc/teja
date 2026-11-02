import { access, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const required = [
  "package.json",
  "vite.config.ts",
  "worker/index.ts",
  "db/index.ts",
  "db/schema.ts",
  "app/page.jsx",
  "app/api/auth/route.js",
  "app/api/data/route.js",
  ".openai/hosting.json",
  ".env.example",
];
let failed = false;
for (const item of required) {
  try {
    await access(resolve(root, item));
    console.log(`OK   ${item}`);
  } catch {
    failed = true;
    console.error(`MISS ${item}`);
  }
}
try {
  const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  const hosting = JSON.parse(
    await readFile(resolve(root, ".openai/hosting.json"), "utf8"),
  );
  if (!pkg.scripts?.dev || !pkg.scripts?.build || !pkg.scripts?.start) {
    failed = true;
    console.error("FAIL package scripts dev/build/start are required");
  } else console.log("OK   package scripts dev/build/start");
  if (hosting.d1 !== "DB") {
    failed = true;
    console.error("FAIL expected current D1 binding name DB");
  } else console.log("OK   hosting declares current D1 binding DB");
  const auth = await readFile(resolve(root, "app/api/auth/route.js"), "utf8");
  if (!/new URL\(req.url\)\.protocol\s*===\s*['"]https:['"]/.test(auth)) {
    failed = true;
    console.error("FAIL auth cookie protocol check is missing");
  } else
    console.log("OK   auth cookie adapts to HTTP preview / HTTPS production");
} catch (e) {
  failed = true;
  console.error(`FAIL configuration check: ${e.message}`);
}

// --- migrations, journal, vite config and environment template -------------------
try {
  const sqlFiles = (await readdir(resolve(root, "drizzle")))
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .sort();
  const journal = JSON.parse(
    await readFile(resolve(root, "drizzle/meta/_journal.json"), "utf8"),
  );
  const tags = journal.entries.map((e) => e.tag);
  const same =
    tags.length === sqlFiles.length &&
    tags.every((t, i) => `${t}.sql` === sqlFiles[i]);
  if (!same) {
    failed = true;
    console.error("FAIL drizzle journal does not match drizzle/*.sql");
  } else
    console.log(
      `OK   drizzle journal matches ${sqlFiles.length} SQL migrations`,
    );
  const vite = await readFile(resolve(root, "vite.config.ts"), "utf8");
  if (!vite.includes("migrations_dir")) {
    failed = true;
    console.error(
      "FAIL vite.config.ts has no migrations_dir for the D1 binding",
    );
  } else console.log("OK   vite.config.ts points the D1 binding at ./drizzle");
  const example = await readFile(resolve(root, ".env.example"), "utf8");
  const sources = [];
  for (const dir of ["app", "lib"]) {
    for (const f of await readdir(resolve(root, dir), { recursive: true }))
      if (/\.(js|jsx|ts|tsx)$/.test(f))
        sources.push(await readFile(resolve(root, dir, f), "utf8"));
  }
  const used = new Set(
    sources
      .join("\n")
      .match(/\b(?:env|e)\.([A-Z][A-Z0-9_]{5,})\b/g)
      ?.map((m) => m.split(".")[1]) ?? [],
  );
  for (const skip of ["BUCKET", "CONNECTORS", "DB"]) used.delete(skip);
  const missing = [...used].filter(
    (name) => !new RegExp(`^#?\\s*${name}=`, "m").test(example),
  );
  if (missing.length) {
    failed = true;
    console.error("FAIL .env is missing: " + missing.join(", "));
  } else
    console.log(
      `OK   .env documents all ${used.size} environment variables used by app/ and lib/`,
    );
} catch (e) {
  failed = true;
  console.error(`FAIL migration/env check: ${e.message}`);
}
if (failed) process.exitCode = 1;
else
  console.log(
    "\nStatic project checks passed. This does not replace dependency install, build, browser, database, or payment tests.",
  );
