import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import assert from "node:assert/strict";
import { planMigrations } from "../scripts/migration-plan.mjs";
const files = fs
  .readdirSync("drizzle")
  .filter((f) => /^\d{4}_.+\.sql$/.test(f))
  .sort();
assert.equal(files.length, 11);
const build = (upTo, drop = []) => {
  const db = new DatabaseSync(":memory:");
  for (const f of files.slice(0, upTo))
    db.exec(fs.readFileSync("drizzle/" + f, "utf8"));
  for (const t of drop) db.exec("DROP TABLE " + t);
  return new Map(
    db
      .prepare(
        "SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      )
      .all()
      .map((r) => [r.name, r.sql]),
  );
};
// fresh database: everything pending, nothing baselined
let p = planMigrations(files, new Map(), null);
assert.equal(p.action, "apply");
assert.deepEqual(p.pending, files);
// database filled by the old "d1 execute --file" procedure (no d1_migrations): baseline all, run nothing
p = planMigrations(files, build(11), null);
assert.equal(p.action, "baseline-then-apply");
assert.deepEqual(p.baseline, files);
assert.deepEqual(p.pending, []);
// older database stopped at 0003: baseline 0000-0003, apply 0004-0007
p = planMigrations(files, build(4), null);
assert.deepEqual(p.baseline, files.slice(0, 4));
assert.deepEqual(p.pending, files.slice(4));
// fully tracked: nothing to do
assert.equal(planMigrations(files, build(11), new Set(files)).action, "noop");
// tracked up to 0005, schema at 0005: apply the last two only
p = planMigrations(files, build(6), new Set(files.slice(0, 6)));
assert.equal(p.action, "apply");
assert.deepEqual(p.pending, files.slice(6));
// hand-edited / interrupted databases are refused, never modified
assert.equal(
  planMigrations(
    files,
    build(10, ["card_charges", "listing_drafts", "saved_cards"]),
    null,
  ).action,
  "refuse",
);
assert.equal(
  planMigrations(files, build(10, ["favorites"]), null).action,
  "refuse",
);
assert.equal(
  planMigrations(files, build(10, ["receipt_counters"]), new Set(files)).action,
  "refuse",
);
assert.equal(
  planMigrations(files, build(11), new Set([...files, "0099_unknown.sql"]))
    .action,
  "refuse",
);
console.log(
  "PASS: migration planner (fresh, legacy execute-file database, partial, tracked, inconsistent states)",
);
