import { env } from "cloudflare:workers";
const xml = (s) =>
  String(s).replace(
    /[<>&'\"]/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        "'": "&apos;",
        '"': "&quot;",
      })[c],
  );
export async function GET() {
  const rows = (
    await env.DB.prepare(
      "SELECT id FROM products WHERE active=1 AND until>? LIMIT 45000",
    )
      .bind(Date.now())
      .all()
  ).results;
  const base = env.PUBLIC_SITE_URL || "http://localhost:5173";
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      ["/", ...rows.map((p) => "/p/" + p.id)]
        .map(
          (path) =>
            "<url><loc>" + xml(new URL(path, base).href) + "</loc></url>",
        )
        .join("") +
      "</urlset>",
    { headers: { "Content-Type": "application/xml" } },
  );
}
