export async function catalog(db, params) {
  const page = Math.max(1, Math.min(100000, parseInt(params.get("page")) || 1)),
    limit = Math.max(1, Math.min(60, parseInt(params.get("limit")) || 24));
  const conditions = ["p.active=1", "NOT EXISTS(SELECT 1 FROM users su WHERE su.id=p.owner AND su.selling_paused=1)", "(p.best_before IS NULL OR p.best_before>"+Date.now()+")", params.get("includeSoldOut")==="1" ? "p.stock>=0" : "p.stock>0", "p.until>?"],
    values = [Date.now()];
  if (params.get("q")) {
    conditions.push(
      "(p.title LIKE ? ESCAPE '\\' OR p.shop LIKE ? ESCAPE '\\')",
    );
    const q =
      "%" +
      params
        .get("q")
        .slice(0, 100)
        .replace(/[\\%_]/g, "\\$&") +
      "%";
    values.push(q, q);
  }
  for (const field of ["city", "category", "owner"])
    if (params.get(field)) {
      conditions.push(`p.${field}=?`);
      values.push(params.get(field).slice(0, 100));
    }
  if (Number(params.get("maxPrice")) > 0) {
    conditions.push("p.price<=?");
    values.push(Number(params.get("maxPrice")));
  }
  const sort =
    { price: "p.price ASC", ending: "p.until ASC", new: "p.created DESC" }[
      params.get("sort")
    ] || "p.created DESC";
  const where = conditions.join(" AND ");
  const count = await db
    .prepare("SELECT COUNT(*) total FROM products p WHERE " + where)
    .bind(...values)
    .first();
  const rows = await db
    .prepare(
      `SELECT p.*,u.verified seller_verified,(SELECT ROUND(AVG(rating),1) FROM reviews WHERE product=p.id AND hidden=0) rating,(SELECT COUNT(*) FROM reviews WHERE product=p.id AND hidden=0) review_count FROM products p JOIN users u ON u.id=p.owner WHERE ${where} ORDER BY ${sort},p.id LIMIT ? OFFSET ?`,
    )
    .bind(...values, limit, (page - 1) * limit)
    .all();
  return {
    products: rows.results,
    page,
    limit,
    total: count.total,
    pages: Math.ceil(count.total / limit),
  };
}
