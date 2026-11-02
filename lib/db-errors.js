// Detects "database exists but migrations were never applied" so API routes can
// report an actionable 503 instead of a generic 500/400 that hides the cause.
export const schemaMissing = (e) =>
  /no such (table|column)/i.test(String(e?.message || e || ""));
export const SCHEMA_HINT =
  "Ma’lumotlar bazasi tayyor emas. Administrator: npm run db:migrate:local ni ishga tushiring";
// Logs only the error message (never request bodies, passwords, tokens or card data).
export const logError = (where, e) => {
  try {
    console.error(
      "[teja] " + where + ": " + String(e?.message || e).slice(0, 300),
    );
  } catch {}
};
